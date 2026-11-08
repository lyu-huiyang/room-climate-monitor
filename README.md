# room-climate-monitor

[中文](#中文) · [English](#english)

---

## 中文

一个自托管的家庭房间温湿度监控。每个房间放一块 ESP32 开发板，接 1~4 个温湿度传感器，通过局域网把读数上报给服务端；家里人用手机浏览器查看各房间的实时读数和历史曲线。

- **服务端**：Python 3.14 + FastAPI + SQLite，一个容器、一个端口，同时提供上报接口、查询接口和网页。
- **网页**：React，可安装到手机桌面（PWA），支持深色模式和中英文切换。
- **命令行 `rcm`**：注册房间、修改名称和舒适区间、更换设备密钥、备份。

### 快速开始（Docker Compose）

```bash
git clone https://github.com/lyu-huiyang/room-climate-monitor.git
cd room-climate-monitor/deploy
mkdir -p data && sudo chown 10001:10001 data   # 容器以 uid 10001 运行
docker compose up -d --build
curl http://127.0.0.1:8080/api/health
```

浏览器打开 `http://127.0.0.1:8080` 就能看到网页。还没有房间时，页面会提示注册房间的命令。

- **数据目录**：必须让 uid 10001 可写。忘了 `chown` 时容器会反复重启，`docker compose logs app` 会提示原因；也可以改用命名卷，见 `deploy/compose.yaml` 里的注释。
- **局域网上报**：默认只监听 `127.0.0.1:8080`，局域网里的板子连不上。在 `deploy/compose.yaml` 里取消注释服务器局域网地址那一行（例如 `192.168.1.10:8080:8080`），保留 `127.0.0.1` 那一行，然后再执行一次 `docker compose up -d`。之后手机也可以直接打开 `http://192.168.1.10:8080`。
- **时区**：`rcm room list` 默认按 UTC 显示时间，在 compose 里设置 `TZ` 可以改成本地时间。网页总是按手机的时区显示。

开发中：注册房间用 `docker compose exec app rcm room add <房间 ID> --name <名称>`，固件稍后加入。

---

## English

A self-hosted temperature and humidity monitor for the rooms of a home. Each room gets an ESP32 board with one to four sensors that post readings over the LAN; the family checks live values and history charts from a phone browser.

- **Server**: Python 3.14 + FastAPI + SQLite. One container and one port serve the upload API, the read API and the web app.
- **Web app**: React, installable as a PWA, with dark mode and a Chinese/English switch.
- **`rcm` CLI**: register rooms, rename them, set comfort ranges, rotate device keys, back up.

### Quick start (Docker Compose)

```bash
git clone https://github.com/lyu-huiyang/room-climate-monitor.git
cd room-climate-monitor/deploy
mkdir -p data && sudo chown 10001:10001 data   # the container runs as uid 10001
docker compose up -d --build
curl http://127.0.0.1:8080/api/health
```

Open `http://127.0.0.1:8080` in a browser. Until a room exists, the page shows the command that registers one.

- **Data directory**: uid 10001 must be able to write to it. If you skip the `chown`, the container keeps restarting and `docker compose logs app` says why. A named volume works too; see the comments in `deploy/compose.yaml`.
- **Uploads from the LAN**: by default the app listens on `127.0.0.1:8080` only, so boards on the LAN cannot reach it. In `deploy/compose.yaml`, uncomment the line with the server's LAN address (for example `192.168.1.10:8080:8080`), keep the `127.0.0.1` line, and run `docker compose up -d` again. Phones can then open `http://192.168.1.10:8080` directly.
- **Time zone**: `rcm room list` shows times in UTC unless you set `TZ` in the compose file. The web app always uses the phone's time zone.

Work in progress: register a room with `docker compose exec app rcm room add <room id> --name <name>`; the firmware comes next.

## License

[MIT](LICENSE)
