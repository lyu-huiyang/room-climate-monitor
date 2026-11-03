import json
import sqlite3
import time
from collections.abc import Callable, Iterator
from contextlib import asynccontextmanager, contextmanager
from typing import Annotated, Literal

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from rcm import __version__, readings, rooms, static
from rcm.config import Settings
from rcm.db import connect, migrate
from rcm.validation import MAX_READINGS, MAX_SENSORS, ValidationError, parse_upload

MAX_BODY_BYTES = 64 * 1024

type RangeName = Literal["8h", "24h", "7d"]


class SensorOut(BaseModel):
    t: float
    h: float


class LatestOut(BaseModel):
    ts: int
    age_s: int
    sensors: dict[str, SensorOut]
    rssi: int | None


class ComfortOut(BaseModel):
    t: tuple[float, float]
    h: tuple[float, float]


class RoomOut(BaseModel):
    id: str
    name: str
    comfort: ComfortOut
    latest: LatestOut | None


class HistoryOut(BaseModel):
    range: RangeName
    bucket_s: int
    sensors: list[str]
    points: list[list[int | float | None]]


class UploadResult(BaseModel):
    accepted: int
    rejected: int


UPLOAD_BODY = {
    "required": True,
    "content": {
        "application/json": {
            "schema": {
                "type": "object",
                "required": ["readings"],
                "properties": {
                    "readings": {
                        "type": "array",
                        "minItems": 1,
                        "maxItems": MAX_READINGS,
                        "items": {
                            "type": "object",
                            "required": ["ts", "sensors"],
                            "properties": {
                                "ts": {"type": "integer", "description": "Unix seconds"},
                                "sensors": {
                                    "type": "object",
                                    "maxProperties": MAX_SENSORS,
                                    "additionalProperties": {
                                        "type": "object",
                                        "required": ["t", "h"],
                                        "properties": {"t": {"type": "number"}, "h": {"type": "number"}},
                                    },
                                },
                                "rssi": {"type": "integer"},
                            },
                        },
                    }
                },
            },
            "example": {
                "readings": [
                    {
                        "ts": 1792308900,
                        "sensors": {"sht40": {"t": 24.31, "h": 52.1}, "aht20": {"t": 24.55, "h": 50.8}},
                        "rssi": -58,
                    }
                ]
            },
        }
    },
}


def _room_out(room: rooms.Room, latest: readings.Latest | None) -> RoomOut:
    return RoomOut.model_validate(
        {
            "id": room.id,
            "name": room.name,
            "comfort": {"t": room.comfort_t, "h": room.comfort_h},
            "latest": latest,
        }
    )


def create_app(settings: Settings, clock: Callable[[], int] = lambda: int(time.time())) -> FastAPI:
    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        conn = connect(settings.db_path)
        try:
            migrate(conn)
        finally:
            conn.close()
        yield

    app = FastAPI(
        title="room-climate-monitor",
        version=__version__,
        openapi_url="/api/openapi.json",
        docs_url="/api/docs",
        redoc_url=None,
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.clock = clock

    @contextmanager
    def db() -> Iterator[sqlite3.Connection]:
        conn = connect(settings.db_path)
        try:
            yield conn
        finally:
            conn.close()

    def find_room(conn: sqlite3.Connection, room_id: str) -> rooms.Room:
        room = rooms.get_room(conn, room_id) if rooms.is_valid_room_id(room_id) else None
        if room is None:
            raise HTTPException(404, "room not found")
        return room

    @app.exception_handler(sqlite3.OperationalError)
    async def db_unavailable(_request: Request, _exc: sqlite3.OperationalError) -> JSONResponse:
        return JSONResponse({"detail": "database unavailable, retry later"}, status_code=503)

    @app.exception_handler(RequestValidationError)
    async def bad_request(_request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse({"detail": "invalid request parameters"}, status_code=400)

    @app.get("/api/health")
    def health() -> dict[str, bool | str]:
        return {"ok": True, "version": __version__}

    @app.get("/api/rooms")
    def list_rooms() -> list[RoomOut]:
        now = clock()
        with db() as conn:
            return [_room_out(r, readings.latest(conn, r.id, now)) for r in rooms.list_rooms(conn)]

    @app.get("/api/rooms/{room_id}", responses={404: {"description": "Room not found"}})
    def get_room(room_id: str) -> RoomOut:
        with db() as conn:
            room = find_room(conn, room_id)
            return _room_out(room, readings.latest(conn, room.id, clock()))

    @app.get(
        "/api/rooms/{room_id}/history",
        responses={400: {"description": "Bad range"}, 404: {"description": "Room not found"}},
    )
    def get_history(room_id: str, range: RangeName = "24h") -> HistoryOut:
        with db() as conn:
            room = find_room(conn, room_id)
            return HistoryOut.model_validate(readings.history(conn, room.id, range, clock()))

    async def read_limited(request: Request) -> bytes:
        declared = request.headers.get("content-length", "")
        if declared.isdigit() and int(declared) > MAX_BODY_BYTES:
            raise HTTPException(413, "body too large")
        body = bytearray()
        async for chunk in request.stream():
            body += chunk
            if len(body) > MAX_BODY_BYTES:
                raise HTTPException(413, "body too large")
        return bytes(body)

    async def drain(request: Request) -> None:
        """Read and discard the body (within the size limit) before rejecting.

        Answering and closing while a device is still writing its body makes the device's HTTP
        client fail the write (status -3) instead of reading our 404/401.
        """
        try:
            await read_limited(request)
        except HTTPException:
            pass  # over the limit: stop reading; the 404/401 still stands

    @app.post(
        "/api/rooms/{room_id}/readings",
        openapi_extra={"requestBody": UPLOAD_BODY},
        responses={
            400: {"description": "Malformed body"},
            401: {"description": "Missing or wrong device key"},
            404: {"description": "Room not found"},
            413: {"description": "Body over 64 KB"},
            503: {"description": "Database busy, retry later"},
        },
    )
    async def upload(
        room_id: str,
        request: Request,
        x_device_key: Annotated[str | None, Header()] = None,
    ) -> UploadResult:
        def check_room() -> rooms.Room:
            with db() as conn:
                return find_room(conn, room_id)

        try:
            room = await run_in_threadpool(check_room)
        except HTTPException:
            await drain(request)
            raise
        if x_device_key is None or not rooms.verify_key(room, x_device_key):
            await drain(request)
            raise HTTPException(401, "missing or wrong device key")
        raw = await read_limited(request)
        try:
            payload = json.loads(raw)
        except ValueError, RecursionError:
            raise HTTPException(400, "body is not valid JSON") from None
        try:
            items, rejected = parse_upload(payload, clock())
        except ValidationError as e:
            raise HTTPException(400, str(e)) from None

        def store() -> None:
            with db() as conn:
                readings.put_readings(conn, room.id, items)

        await run_in_threadpool(store)
        return UploadResult(accepted=len(items), rejected=rejected)

    static.mount(app, settings.static_dir)
    return app
