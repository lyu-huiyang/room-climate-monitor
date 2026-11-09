# room-climate-monitor 服务端与前端 — 设计文档

- 日期：2026-11-09
- 范围：自托管服务端（`server/`）和前端工程（`web/`）

## 1. 背景与目标

room-climate-monitor 是一个开源的家庭房间温湿度监控项目。每个房间放一块 ESP32 开发板，接一个或多个温湿度传感器，通过局域网把读数上报给自托管的服务端；家人用手机浏览器查看各个房间的实时读数和历史曲线。

它的前身是作者的一个私有单房间原型，设备端的校验、降采样和断网补传逻辑已经在真实设备上运行验证过。这里重写为通用、可自托管的版本。固件的设计见 [firmware.md](firmware.md)。

**成功标准：**

1. 用一个 Docker 容器就能运行：服务端同时提供上报接口、查询接口和前端页面，数据保存在挂载卷里的 SQLite 文件中。
2. 用命令行 `rcm` 注册多个房间，每个房间有独立的设备密钥。设备按 `POST /api/rooms/{room_id}/readings` 上报 1~4 个任意命名的传感器的读数。
3. 前端首页列出所有房间的当前读数和在线状态；房间详情页显示每个传感器的读数、传感器之间的一致性，以及 8 小时 / 24 小时 / 7 天的温湿度曲线。
4. 前端支持深色模式、中英文切换，可以安装到手机桌面（PWA）。
5. 后端测试、前端单元和组件测试、端到端测试、Docker 构建都由同一个检查脚本跑通，持续集成也用这个脚本。

## 2. 已定决策

| 项 | 决策 |
|---|---|
| 部署形态 | 只支持自托管：Docker + SQLite |
| 后端 | Python 3.14 + FastAPI + SQLite；依赖用 uv 管理 |
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS 4；路由用 React Router，数据获取用 TanStack Query，图表用 ECharts，多语言用 react-i18next，PWA 用 vite-plugin-pwa |
| 前后端类型 | 后端由 FastAPI 生成 OpenAPI；前端用 `openapi-typescript` 生成类型，用 `openapi-fetch` 发请求 |
| 房间 | 在后端注册：唯一 ID、显示名称、舒适区间、独立的设备密钥 |
| 房间管理 | 只用命令行 `rcm`，没有管理接口和管理页面，网页始终只读 |
| 传感器 | 通用化：每条读数可以有 1~4 个传感器，名称为 `[a-z0-9_]{1,16}`，每个传感器有温度和湿度 |
| 网页访问保护 | 应用本身不做认证，交给反向代理（Traefik、Caddy 等）的用户名密码认证。上报接口单独用设备密钥校验 |
| 数据保留 | 永久保存，没有自动过期 |

**不做的事：** 告警和推送、数据导出、多个房间叠加对比、网页上的房间管理、旧数据导入。

## 3. 整体结构

```
room-climate-monitor/
├── server/     # Python 3.14 + FastAPI：接口、命令行 rcm、SQLite
├── web/        # React 前端工程
├── firmware/   # ESP32 固件
├── deploy/     # Dockerfile、compose 示例、反向代理示例
├── scripts/    # check.sh 等
└── docs/
```

运行时只有一个容器、一个端口（容器内 8080）：

```
ESP32 ──HTTP POST /api/rooms/{id}/readings（X-Device-Key）──┐
                                                             ├─▶ FastAPI（uvicorn，1 个工作进程）─▶ SQLite（/data）
浏览器 ──HTTPS──▶ 反向代理（用户名密码认证）──▶ GET / 和 /api/… ┘
```

- FastAPI 提供 `/api/*` 接口，并提供前端构建出的静态文件。
- 请求路径不以 `/api/` 开头、也不是一个存在的静态文件时，返回 `index.html`，由前端路由处理。
- 只用 1 个工作进程：SQLite 同一时间只能有一个写入者，这个项目的负载也很低。

## 4. 接口

| 方法和路径 | 作用 | 鉴权 |
|---|---|---|
| `POST /api/rooms/{room_id}/readings` | 设备上报 | `X-Device-Key` 请求头，每个房间独立 |
| `GET /api/rooms` | 所有房间，包含各自的最新读数 | 无，由反向代理保护 |
| `GET /api/rooms/{room_id}` | 单个房间，包含最新读数 | 同上 |
| `GET /api/rooms/{room_id}/history?range=8h\|24h\|7d` | 分桶后的历史曲线 | 同上 |
| `GET /api/health` | 健康检查，返回 `{"ok": true, "version": "…"}` | 无 |
| `GET /api/openapi.json` | 接口描述 | 无 |

`room_id` 的格式为 `[a-z0-9-]{1,32}`，用 `re.fullmatch` 校验，避免末尾带换行这类输入被放过。

### 4.1 上报 `POST /api/rooms/{room_id}/readings`

```json
{
  "readings": [
    { "ts": 1792308900,
      "sensors": { "sht40": {"t": 24.31, "h": 52.10}, "aht20": {"t": 24.55, "h": 50.80} },
      "rssi": -58 }
  ]
}
```

**校验顺序与返回码：**

1. `room_id` 格式不对，或者房间不存在：`404`。
2. 缺少 `X-Device-Key`，或者它的 SHA-256 和房间记录的哈希不一致：`401`。比较时按字节用常量时间比较，所以非 ASCII 的密钥也只会返回 401，不会让程序出错。
3. 请求体超过 64 KB：`413`。
4. 不是合法的 JSON（包括嵌套过深），或者结构不对：`400`。结构要求：顶层是对象；`readings` 是数组，长度 1~100。
5. **每条读数单独校验**，不合格的计入 `rejected`，不影响同一批里的其他读数：
   - `ts` 必须是整数（布尔值不算），并且在 `[now − 7 天, now + 5 分钟]` 范围内；
   - `sensors` 是对象，最多 4 个键，键名符合 `[a-z0-9_]{1,16}`；
   - 每个传感器的 `t` 必须在 [-20, 60] 之间，`h` 必须在 [0, 100] 之间，并且都是数字，不能是 NaN 或布尔值。不合格的传感器单独丢弃，数值保留 2 位小数；
   - 一个有效传感器都没有的读数，整条拒收；
   - `rssi` 可选，必须是 [-127, 0] 范围内的整数，不合格就忽略；
   - 同一批里 `ts` 重复的，保留最后一条，前面的计入 `rejected`。
6. 写入数据库：同一房间、时间、传感器已存在时直接覆盖，所以重复上报是安全的。返回 `200 {"accepted": n, "rejected": m}`。
7. 数据库忙或出错：`503`，由设备下一分钟重试。

### 4.2 房间信息 `GET /api/rooms`、`GET /api/rooms/{room_id}`

```json
{
  "id": "living-room",
  "name": "客厅",
  "comfort": {"t": [22, 26], "h": [40, 60]},
  "latest": {
    "ts": 1792308900, "age_s": 42,
    "sensors": {"sht40": {"t": 24.31, "h": 52.10}, "aht20": {"t": 24.55, "h": 50.80}},
    "rssi": -58
  }
}
```

- `GET /api/rooms` 返回房间数组，按 `id` 排序。
- `latest`：取最近 30 天内这个房间最新的那个时间点，以及这个时间点上的所有传感器读数。30 天内没有数据时为 `null`。`age_s` 不会小于 0。
- 房间不存在：`404`。

### 4.3 历史 `GET /api/rooms/{room_id}/history`

| range | 时间跨度 | 桶宽 |
|---|---|---|
| `8h` | 8 小时 | 60 秒 |
| `24h`（默认） | 24 小时 | 60 秒 |
| `7d` | 7 天 | 15 分钟 |

```json
{ "range": "24h", "bucket_s": 60, "sensors": ["aht20", "sht40"],
  "points": [[1792308900, 24.55, 50.80, 24.31, 52.10]] }
```

- **查询范围**：`[now − 跨度, now + 300 秒]`。
- **分桶求平均**：按 `(ts − ts % 桶宽, 传感器)` 分组求平均，保留 2 位小数，用 SQL 完成。
- **`sensors`**：查询范围内出现过的传感器名称，按名称排序。
- **`points`**：每个点依次是桶的起始时间，然后按 `sensors` 的顺序排列每个传感器的温度和湿度；这个桶里没有某个传感器的数据时填 `null`。没有任何数据的桶不输出，前端会在断档处让曲线断开。
- `range` 取值不对：`400`；房间不存在：`404`。

## 5. 数据库

```sql
CREATE TABLE rooms (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  key_hash      TEXT NOT NULL,
  comfort_t_min REAL NOT NULL DEFAULT 22, comfort_t_max REAL NOT NULL DEFAULT 26,
  comfort_h_min REAL NOT NULL DEFAULT 40, comfort_h_max REAL NOT NULL DEFAULT 60,
  created_at    INTEGER NOT NULL
);

CREATE TABLE readings (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  ts      INTEGER NOT NULL,
  sensor  TEXT NOT NULL,
  t       REAL NOT NULL,
  h       REAL NOT NULL,
  rssi    INTEGER,
  PRIMARY KEY (room_id, ts, sensor)
) WITHOUT ROWID;
```

- **连接参数**：`journal_mode=WAL`、`synchronous=NORMAL`、`foreign_keys=ON`、`busy_timeout=5000`。
- **数据文件**：由 `RCM_DB_PATH` 指定，容器内默认 `/data/rcm.sqlite3`。
- **表结构版本**：用 `PRAGMA user_version` 记录，启动时按顺序执行未执行过的升级步骤。第一版的版本号是 1。
- **容量估算**：每 10 秒一条读数、每个房间 2 个传感器时，一个房间一年约 630 万行。查 7 天的历史大约要扫 12 万行，走主键范围扫描。

## 6. 命令行 `rcm`

用标准库 `argparse` 实现，不引入额外依赖；入口在 `server/` 包的 `rcm` 命令。

| 命令 | 作用 |
|---|---|
| `rcm room add <id> --name <name> [--comfort-temp 22-26] [--comfort-humidity 40-60]` | 注册房间，打印设备密钥，**只显示这一次** |
| `rcm room list` | 列出 ID、名称、舒适区间、最新数据时间、读数行数，不显示密钥 |
| `rcm room rename <id> <name>` | 修改显示名称 |
| `rcm room set-comfort <id> [--temp a-b] [--humidity a-b]` | 修改舒适区间，要求最小值小于最大值 |
| `rcm room rotate-key <id>` | 生成新密钥并打印，旧密钥立即失效 |
| `rcm room delete <id> [--yes]` | 删除房间及其全部读数；不加 `--yes` 时要求重新输入房间 ID 确认 |
| `rcm backup <path>` | 用 SQLite 的在线备份接口备份，运行中也可以执行 |
| `rcm serve [--host 0.0.0.0] [--port 8080]` | 启动 uvicorn，作为容器的默认启动命令 |

- **设备密钥**：`secrets.token_urlsafe(24)` 生成；数据库里存 SHA-256 的十六进制字符串。
- **出错处理**：房间 ID 格式不对、房间已存在或不存在、区间写法不对时，打印中文和英文的错误信息，退出码非 0。

## 7. 前端

### 7.1 页面

| 路径 | 内容 |
|---|---|
| `/` | **房间总览**：每个房间一张卡片，显示有效传感器读数的平均温湿度、新鲜度（"N 秒前"，超过 5 分钟没有数据显示红色"已离线"）、一致性标记（✓ 或 ⚠）。只有一个房间时直接跳到它的详情页；还没有房间时，显示如何用 `rcm` 注册房间 |
| `/rooms/:roomId` | **房间详情**：每个传感器一张读数卡片；一致性一行（两个及以上传感器时显示最大温差和最大湿差，温差 ≤ 1°C 且湿差 ≤ 5% 显示"✓ 一致"）；范围切换（8 小时 / 24 小时 / 7 天，默认 24 小时）；温度和湿度两张图，每个传感器一条线，按房间的舒适区间画色带 |
| 其他 | 404 页面，带返回首页的链接 |

### 7.2 工程结构

```
web/src/
├── main.tsx          # 路由、QueryClient、i18n 初始化
├── api/              # schema.d.ts（生成）、client.ts（openapi-fetch）
├── hooks/            # useRooms、useRoom、useHistory
├── lib/              # 纯函数：freshness、agreement、historyToSeries、format
├── components/       # RoomCard、SensorCard、AgreementBadge、RangeTabs、ClimateChart、StatusDot、Layout、LanguageToggle
├── pages/            # OverviewPage、RoomPage、NotFoundPage
├── i18n/             # zh-CN.json、en.json
└── styles/           # Tailwind 入口和主题变量
```

### 7.3 关键行为

- **刷新**：房间数据每 60 秒刷新一次，历史数据每 5 分钟刷新一次；窗口重新获得焦点、网络恢复时立即刷新；失败自动重试。
- **传感器颜色**：按传感器名称排序后固定分配：蓝 `#2a78d6`（深色模式 `#3987e5`）、橙 `#eb6834`（`#d95926`），第三、第四个依次用参考色板的第 3、4 个颜色。同一个传感器在各处颜色都一样。
- **图表**：ECharts 按需引入折线图、网格、提示框、图例、标记区域和 Canvas 渲染器。时间轴按浏览器所在时区显示；手机宽度下刻度数量设为 3，避免标签重叠；不提供缩放滑块和手势缩放；断档处曲线断开。
- **深色模式**：颜色定义成 CSS 变量，接入 Tailwind 4 的主题，跟随系统的深浅色设置。
- **多语言**：默认跟随浏览器语言（以 `zh` 开头的显示中文，其余显示英文）；页面上可以手动切换，选择保存在 `localStorage` 里（读写失败时不影响使用）。
- **PWA**：提供应用清单和图标；Service Worker 只缓存构建出的静态文件，`/api/*` 一律从网络获取，不缓存。

### 7.4 开发

- 一个终端运行后端 `rcm serve`，另一个终端运行 `pnpm dev`；Vite 开发服务器把 `/api` 代理到 `http://127.0.0.1:8080`。
- `pnpm gen:api`：从后端导出 `openapi.json`，再生成 `src/api/schema.d.ts`。

## 8. 打包与部署

- **Dockerfile**（多阶段构建）：
  1. `node:26.13.0-alpine` 构建前端；
  2. `python:3.14.10-slim` + uv 安装后端运行依赖（`uv sync --frozen --no-dev`），复制前端构建结果。

  以非 root 用户运行，`VOLUME /data`，`EXPOSE 8080`，`HEALTHCHECK` 用 Python 标准库请求 `/api/health`，`CMD ["rcm", "serve"]`。镜像目标体积：压缩后（即拉取时下载的大小）150 MB 以内。解压后的体积主要由 `python:3.14.10-slim` 基础镜像决定（基础镜像本身约 161 MB），不作为目标。
- **`deploy/compose.yaml`**：一个服务；数据挂载 `./data:/data`；端口默认发布为 `127.0.0.1:8080:8080`，注释说明局域网设备上报时改成 `局域网IP:8080:8080`；`restart: unless-stopped`。
- **反向代理示例**：`deploy/traefik/`（路由加用户名密码认证中间件）、`deploy/caddy/Caddyfile`（自动 HTTPS 加用户名密码认证）。
- **备份**：README 说明如何用 `rcm backup` 配合宿主机定时任务每天备份。
- **安全说明**：应用本身没有网页认证，**暴露到公网前必须在反向代理上加认证**；局域网 HTTP 上报是明文的，设备密钥在同一网络里可以被抓包看到。

## 9. 测试与检查

| 部分 | 工具 | 覆盖 |
|---|---|---|
| 后端 | ruff、pytest + FastAPI 测试客户端，每个测试用临时 SQLite 文件 | 第 4 节的每条校验规则和返回码；分桶求平均和 `null` 填充；最新读数（含 30 天窗口、`age_s` 不小于 0）；静态文件和前端路由回退；命令行各子命令（含删除确认、更换密钥后旧密钥失效）；备份；表结构初始化和版本号 |
| 前端单元和组件 | Vitest + Testing Library | freshness、agreement、historyToSeries（含断档插空）；RoomCard 离线显示；SensorCard 读取失败显示；RangeTabs 切换 |
| 端到端 | Playwright | 用临时数据库启动后端，用 `rcm` 注册两个房间并上报读数，然后走一遍：首页 → 房间详情 → 切换范围 → 切换语言；只有一个房间时自动跳转 |
| 一键检查 | `scripts/check.sh` | 依次运行后端 ruff 和 pytest、前端 ESLint、tsc、Vitest，检查 `schema.d.ts` 是否和后端一致，构建前端，运行 Playwright |
| 持续集成 | GitHub Actions | 运行 `scripts/check.sh`，再构建 Docker 镜像，启动容器确认健康检查通过 |
