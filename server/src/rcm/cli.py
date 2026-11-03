"""The `rcm` command line (docs/design/server-web.md §6)."""

import argparse
import json
import re
import sqlite3
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

from rcm import __version__, readings, rooms
from rcm.config import Settings
from rcm.db import connect, migrate

_RANGE_RE = re.compile(r"(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)")


class CliError(Exception):
    """A user-facing error: (Chinese, English) message and exit code."""

    def __init__(self, zh: str, en: str, code: int = 1) -> None:
        super().__init__(f"{zh} / {en}")
        self.code = code


def _range(text: str) -> tuple[float, float]:
    match = _RANGE_RE.fullmatch(text)
    if not match:
        raise argparse.ArgumentTypeError(f"区间写法应为 a-b / range must look like a-b: {text}")
    low, high = float(match[1]), float(match[2])
    if not low < high:
        raise argparse.ArgumentTypeError(f"最小值必须小于最大值 / min must be below max: {text}")
    return low, high


def _fmt_range(value: tuple[float, float]) -> str:
    return f"{value[0]:g}-{value[1]:g}"


def _fmt_ts(ts: int | None) -> str:
    return "-" if ts is None else datetime.fromtimestamp(ts).astimezone().strftime("%Y-%m-%d %H:%M:%S")


def _width(text: str) -> int:
    """Terminal display width: CJK and other wide characters take two columns."""
    return sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in text)


def _not_found(room_id: str) -> CliError:
    return CliError("房间不存在", f"room not found: {room_id}")


def _open() -> sqlite3.Connection:
    conn = connect(Settings.from_env().db_path)
    migrate(conn)
    return conn


def _print_key(key: str) -> None:
    print("设备密钥（只显示这一次，请写进设备配置）/ device key (shown only once):")
    print(key)


def cmd_room_add(args: argparse.Namespace) -> None:
    if not rooms.is_valid_room_id(args.id):
        raise CliError(
            "房间 ID 只能包含小写字母、数字和连字符，最长 32 个字符",
            f"room id must match [a-z0-9-]{{1,32}}: {args.id}",
            code=2,
        )
    conn = _open()
    try:
        room, key = rooms.create_room(conn, args.id, args.name, args.comfort_temp, args.comfort_humidity)
    except rooms.RoomExists:
        raise CliError("房间已存在", f"room already exists: {args.id}") from None
    finally:
        conn.close()
    print(f"已创建房间 / room created: {room.id} ({room.name})")
    _print_key(key)


def cmd_room_list(_args: argparse.Namespace) -> None:
    conn = _open()
    try:
        rows = [
            (
                r.id,
                r.name,
                _fmt_range(r.comfort_t),
                _fmt_range(r.comfort_h),
                _fmt_ts(readings.latest_ts(conn, r.id)),
                str(readings.count_readings(conn, r.id)),
            )
            for r in rooms.list_rooms(conn)
        ]
    finally:
        conn.close()
    if not rows:
        print("还没有房间，用 `rcm room add` 注册 / no rooms yet, add one with `rcm room add`")
        return
    header = ("ID", "NAME", "TEMP", "HUMIDITY", "LATEST", "READINGS")
    widths = [max(_width(row[i]) for row in (header, *rows)) for i in range(len(header))]
    for row in (header, *rows):
        print("  ".join(v + " " * (w - _width(v)) for v, w in zip(row, widths, strict=True)).rstrip())


def _with_room(fn):
    def run(args: argparse.Namespace) -> None:
        conn = _open()
        try:
            fn(conn, args)
        except rooms.RoomNotFound:
            raise _not_found(args.id) from None
        finally:
            conn.close()

    return run


@_with_room
def cmd_room_rename(conn: sqlite3.Connection, args: argparse.Namespace) -> None:
    rooms.rename_room(conn, args.id, args.name)
    print(f"已改名 / renamed: {args.id} → {args.name}")


@_with_room
def cmd_room_set_comfort(conn: sqlite3.Connection, args: argparse.Namespace) -> None:
    rooms.set_comfort(conn, args.id, comfort_t=args.temp, comfort_h=args.humidity)
    room = rooms.get_room(conn, args.id)
    print(f"舒适区间 / comfort: {_fmt_range(room.comfort_t)} °C, {_fmt_range(room.comfort_h)} %")


@_with_room
def cmd_room_rotate_key(conn: sqlite3.Connection, args: argparse.Namespace) -> None:
    key = rooms.rotate_key(conn, args.id)
    print(f"旧密钥已失效 / old key revoked: {args.id}")
    _print_key(key)


def cmd_room_delete(args: argparse.Namespace) -> None:
    conn = _open()
    try:
        if rooms.get_room(conn, args.id) is None:
            raise _not_found(args.id)
        if not args.yes:
            print(
                f"将删除房间 {args.id} 及其全部读数，输入房间 ID 确认 / "
                f"this deletes {args.id} and all its readings; type the room id to confirm: ",
                end="",
                flush=True,
            )
            if sys.stdin.readline().strip() != args.id:
                raise CliError("输入不一致，已取消", "confirmation did not match, cancelled")
        rooms.delete_room(conn, args.id)
    finally:
        conn.close()
    print(f"已删除 / deleted: {args.id}")


def cmd_backup(args: argparse.Namespace) -> None:
    dest = Path(args.path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    src = _open()
    dst = sqlite3.connect(dest)
    try:
        src.backup(dst)
        # A self-contained single file, independent of the live database's WAL mode.
        dst.execute("PRAGMA journal_mode=DELETE")
    finally:
        dst.close()
        src.close()
    print(f"已备份 / backed up: {dest}")


def cmd_serve(args: argparse.Namespace) -> None:
    import uvicorn

    uvicorn.run("rcm.main:app", host=args.host, port=args.port, workers=1)


def cmd_openapi(_args: argparse.Namespace) -> None:
    from rcm.api import create_app

    print(json.dumps(create_app(Settings.from_env()).openapi(), ensure_ascii=False, indent=2))


def build_parser() -> argparse.ArgumentParser:
    env = Settings.from_env()
    parser = argparse.ArgumentParser(prog="rcm", description="room-climate-monitor")
    parser.add_argument("--version", action="version", version=__version__)
    sub = parser.add_subparsers(dest="command", required=True)

    room = sub.add_parser("room", help="manage rooms").add_subparsers(dest="room_command", required=True)
    p = room.add_parser("add", help="register a room and print its device key")
    p.add_argument("id")
    p.add_argument("--name", required=True)
    p.add_argument("--comfort-temp", type=_range, default=(22.0, 26.0), metavar="A-B")
    p.add_argument("--comfort-humidity", type=_range, default=(40.0, 60.0), metavar="A-B")
    p.set_defaults(func=cmd_room_add)

    room.add_parser("list", help="list rooms").set_defaults(func=cmd_room_list)

    p = room.add_parser("rename", help="change a room's display name")
    p.add_argument("id")
    p.add_argument("name")
    p.set_defaults(func=cmd_room_rename)

    p = room.add_parser("set-comfort", help="change comfort ranges")
    p.add_argument("id")
    p.add_argument("--temp", type=_range, metavar="A-B")
    p.add_argument("--humidity", type=_range, metavar="A-B")
    p.set_defaults(func=cmd_room_set_comfort)

    p = room.add_parser("rotate-key", help="issue a new device key; the old one stops working")
    p.add_argument("id")
    p.set_defaults(func=cmd_room_rotate_key)

    p = room.add_parser("delete", help="delete a room and all its readings")
    p.add_argument("id")
    p.add_argument("--yes", action="store_true", help="skip the confirmation prompt")
    p.set_defaults(func=cmd_room_delete)

    p = sub.add_parser("backup", help="online backup of the database")
    p.add_argument("path")
    p.set_defaults(func=cmd_backup)

    p = sub.add_parser("serve", help="run the HTTP server")
    p.add_argument("--host", default=env.host)
    p.add_argument("--port", type=int, default=env.port)
    p.set_defaults(func=cmd_serve)

    sub.add_parser("openapi", help="print the OpenAPI document (for frontend type generation)").set_defaults(
        func=cmd_openapi
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    try:
        args = parser.parse_args(argv)
    except SystemExit as e:
        return e.code if isinstance(e.code, int) else 1
    if args.command == "room" and args.room_command == "set-comfort" and not (args.temp or args.humidity):
        print("至少指定 --temp 或 --humidity / give --temp and/or --humidity", file=sys.stderr)
        return 2
    try:
        args.func(args)
    except CliError as e:
        print(e, file=sys.stderr)
        return e.code
    except sqlite3.Error as e:
        print(f"数据库错误 / database error: {e}", file=sys.stderr)
        return 1
    return 0
