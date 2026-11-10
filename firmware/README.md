# room-climate-monitor firmware

[中文](#中文) · [English](#english)

---

## 中文

ESP32-C3 SuperMini 固件：每 10 秒读取 SHT40 和 AHT20，每分钟把读数上报到服务端的 `POST /api/rooms/{房间 ID}/readings`。断网时在板子上缓存最多 3 小时（1080 条），恢复后自动补传。

### 硬件和接线

| 器件 | 接法 |
|---|---|
| ESP32-C3 SuperMini | 主板 |
| SHT40 | SDA → GPIO6，SCL → GPIO7，3V3，GND |
| AHT20 | 和 SHT40 共用同一路 I²C：SDA → GPIO6，SCL → GPIO7，3V3，GND |

两个传感器地址不同（SHT40 为 0x44~0x46，AHT20 为 0x38），可以并在一起。板载指示灯保持常灭。

### 准备

1. 安装 [PlatformIO Core](https://docs.platformio.org/) 6.2.0，例如 `uv tool install --python 3.12.16 platformio==6.2.0`。
2. 在服务端注册房间，记下打印出的设备密钥（只显示一次）：

   ```bash
   docker compose exec app rcm room add living-room --name 客厅
   ```

### 配置

```bash
cd firmware
cp include/secrets.example.h include/secrets.h
```

编辑 `include/secrets.h`：

| 项 | 说明 |
|---|---|
| `WIFI_SSID`、`WIFI_PASS` | 2.4 GHz Wi-Fi |
| `SERVER_URL` | 服务端地址，`http://` 或 `https://` 开头，例如 `http://192.168.1.10:8080` |
| `ROOM_ID` | 上一步注册的房间 ID |
| `DEVICE_KEY` | 上一步打印的设备密钥 |
| `ENABLE_SHT40`、`ENABLE_AHT20` | 可选；只接了一个传感器时，把另一个设为 0 |
| `WIFI_TX_POWER` | 可选；连不上 Wi-Fi 时试试 `WIFI_POWER_8_5dBm` |

> **不要提交 `secrets.h`**，它含有 Wi-Fi 密码和设备密钥，仓库的 `.gitignore` 已经忽略它。房间 ID 格式不对、服务器地址不以 `http://` 或 `https://` 开头或者太长、两个传感器都关掉、Wi-Fi 名称或设备密钥还是示例里的占位值时，编译会直接报错。

#### 多块板子

每个房间一块板子时，给每块板子单独保留一份配置，文件名带上房间 ID，烧录时用环境变量 `RCM_ROOM` 选择：

```bash
cp include/secrets.example.h include/secrets.living-room.h   # 客厅的配置
cp include/secrets.example.h include/secrets.bedroom.h       # 卧室的配置
RCM_ROOM=bedroom pio run -e supermini -t upload --upload-port <串口>
```

- `secrets.<房间 ID>.h` 同样被 git 忽略。
- 设置了 `RCM_ROOM` 时只读这份文件，文件里的 `ROOM_ID` 必须等于 `RCM_ROOM`，否则编译报错，避免把一个房间的配置烧进另一个房间的板子。改了配置文件或者换了房间，直接重新烧录即可，会自动重新编译。
- 不设置 `RCM_ROOM` 时照旧使用 `secrets.h`。
- fish 里写法相同；Windows PowerShell 里先执行 `$env:RCM_ROOM="bedroom"`，用完后 `Remove-Item Env:RCM_ROOM`。

### 烧录和看日志

**烧录前确认连的是要烧的那块板子**，家里其他房间的板子烧错了就会停止上报：

1. 只用 USB 连接这一块板子，用 `pio device list` 找到它的串口。
2. 先看几秒日志：`pio device monitor -b 115200 -p <串口>`。已经在运行本固件的板子会打印 `upload: …/api/rooms/<房间 ID>/readings`，核对房间 ID；出现别的房间或者旧固件的日志，说明插错了，停下。新板子没有输出是正常的。
3. 烧录时指定串口：

```bash
pio run -e supermini -t upload --upload-port <串口>   # 编译并烧录；多块板子时前面加 RCM_ROOM=<房间 ID>
pio device monitor -b 115200 -p <串口>                # 看串口日志，Ctrl+C 退出
```

第一次编译会下载 ESP32 平台和工具链，需要几分钟。

| 日志 | 含义 |
|---|---|
| `boot: reset reason …, buffer restored/reset with N readings` | 启动；`restored` 表示重启前的缓存还在 |
| `upload: http://…/api/rooms/living-room/readings` | 本板的上报地址 |
| `sample …: sht40=ok aht20=ok rssi=-58 buffered=3` | 每 10 秒一行；`missing` 是这次没读到，`disabled` 是配置里关掉了 |
| `upload: sent 6, 0 left` | 上报成功 |
| `upload: HTTP 404, will retry` | 房间没注册或 ID 写错；数据保留，注册后自动补传 |
| `upload: HTTP 401, dropped N readings` | 设备密钥不对（服务端是否执行过 `rcm room rotate-key`？）；改好配置后重新烧录 |
| `upload: HTTP -1, will retry` | 连不上服务端（负数是网络错误）；数据保留 |

串口里输入大写 `R` 会让板子重启。每次开机必须先联网完成对时才开始采样；Wi-Fi 断开超过 5 分钟会重连，30 分钟没有一次成功上报会自动重启。

### 排障

- **一直不出现 `sample` 行**：还没对时成功，检查 Wi-Fi 名称和密码、路由器是否开了 2.4 GHz。
- **连不上 Wi-Fi**：部分 SuperMini 天线匹配差，打开 `WIFI_TX_POWER`。
- **某个传感器一直 `missing`**：检查接线和供电；确实没接就在配置里关掉它。
- **`https://` 地址返回负数**：证书校验或握手失败；局域网里建议直接用 `http://`。
- **Linux 上打不开串口**：把自己加入 `dialout` 组（部分发行版是 `uucp`）后重新登录。
- **烧录时连不上板子**：按住板子上的 BOOT 键再插 USB，进入下载模式后重新烧录。
- **烧录后看不到日志**：板子重启时 USB 串口会重新出现，重新运行 `pio device monitor`。
- **关掉串口监视器后板子不再上报**：拔掉 USB 重新上电。正式使用时用普通的 USB 电源供电，不要接在电脑上。

### 开发

```bash
pio test -e native     # 与硬件无关的部分（缓存、上报内容、策略、地址校验）的单元测试
pio run -e supermini   # 编译；没有 secrets.h 时使用示例配置
```

---

## English

Firmware for an ESP32-C3 SuperMini: reads an SHT40 and an AHT20 every 10 seconds and posts the readings once a minute to the server's `POST /api/rooms/{room id}/readings`. While offline it buffers up to 3 hours (1080 readings) on the board and backfills them once the server is reachable again.

### Hardware and wiring

| Part | Connection |
|---|---|
| ESP32-C3 SuperMini | main board |
| SHT40 | SDA → GPIO6, SCL → GPIO7, 3V3, GND |
| AHT20 | shares the same I²C bus: SDA → GPIO6, SCL → GPIO7, 3V3, GND |

The two sensors have different addresses (SHT40 0x44–0x46, AHT20 0x38). The on-board LED stays off.

### Prepare

1. Install [PlatformIO Core](https://docs.platformio.org/) 6.2.0, for example `uv tool install --python 3.12.16 platformio==6.2.0`.
2. Register the room on the server and note the device key it prints once:

   ```bash
   docker compose exec app rcm room add living-room --name "Living room"
   ```

### Configure

```bash
cd firmware
cp include/secrets.example.h include/secrets.h
```

Edit `include/secrets.h`:

| Setting | Meaning |
|---|---|
| `WIFI_SSID`, `WIFI_PASS` | 2.4 GHz Wi-Fi |
| `SERVER_URL` | server address starting with `http://` or `https://`, e.g. `http://192.168.1.10:8080` |
| `ROOM_ID` | the room id you registered |
| `DEVICE_KEY` | the device key printed by `rcm room add` |
| `ENABLE_SHT40`, `ENABLE_AHT20` | optional; set the missing sensor to 0 if only one is connected |
| `WIFI_TX_POWER` | optional; try `WIFI_POWER_8_5dBm` if Wi-Fi will not connect |

> **Never commit `secrets.h`**: it holds your Wi-Fi password and the device key, and `.gitignore` already excludes it. A malformed room id, a server address without `http://` or `https://` or one that is too long, both sensors turned off, or a Wi-Fi name or device key still set to the example placeholder stop the build with an error.

#### Several boards

With one board per room, keep one configuration per board, named after its room id, and pick it with the `RCM_ROOM` environment variable when you flash:

```bash
cp include/secrets.example.h include/secrets.living-room.h   # living room
cp include/secrets.example.h include/secrets.bedroom.h       # bedroom
RCM_ROOM=bedroom pio run -e supermini -t upload --upload-port <port>
```

- `secrets.<room id>.h` files are git-ignored too.
- With `RCM_ROOM` set, only that file is read, and its `ROOM_ID` must equal `RCM_ROOM` or the build fails, so one room's configuration cannot end up on another room's board. After editing a configuration or switching rooms, just flash again; the affected files are rebuilt automatically.
- Without `RCM_ROOM`, `secrets.h` is used as before.
- The same syntax works in fish; in Windows PowerShell run `$env:RCM_ROOM="bedroom"` first and `Remove-Item Env:RCM_ROOM` afterwards.

### Flash and watch the log

**Make sure the connected board is the one you mean to flash**; flashing another room's board stops that room's uploads:

1. Connect only this board over USB and find its port with `pio device list`.
2. Watch the log for a few seconds first: `pio device monitor -b 115200 -p <port>`. A board already running this firmware prints `upload: …/api/rooms/<room id>/readings`; check the room id. If you see another room or an older firmware, stop. A new board printing nothing is normal.
3. Flash with the port named explicitly:

```bash
pio run -e supermini -t upload --upload-port <port>   # build and flash; prefix RCM_ROOM=<room id> for several boards
pio device monitor -b 115200 -p <port>                # serial log, Ctrl+C to quit
```

The first build downloads the ESP32 platform and toolchain and takes a few minutes.

| Log line | Meaning |
|---|---|
| `boot: reset reason …, buffer restored/reset with N readings` | start-up; `restored` means the buffer survived the restart |
| `upload: http://…/api/rooms/living-room/readings` | this board's upload URL |
| `sample …: sht40=ok aht20=ok rssi=-58 buffered=3` | one line every 10 s; `missing` = not read this time, `disabled` = turned off in the config |
| `upload: sent 6, 0 left` | upload succeeded |
| `upload: HTTP 404, will retry` | room not registered or wrong id; data is kept and sent once the room exists |
| `upload: HTTP 401, dropped N readings` | wrong device key (was `rcm room rotate-key` run on the server?); fix the config and flash again |
| `upload: HTTP -1, will retry` | server unreachable (negative = network error); data is kept |

Type a capital `R` in the serial monitor to restart the board. Sampling starts only after the clock is synced over the network on each boot; Wi-Fi is reset after 5 minutes down, and the board restarts after 30 minutes without a successful upload.

### Troubleshooting

- **No `sample` lines**: the clock has not synced yet; check the Wi-Fi name and password and that the router has 2.4 GHz enabled.
- **Wi-Fi will not connect**: some SuperMini boards have a weak antenna match; set `WIFI_TX_POWER`.
- **A sensor stays `missing`**: check its wiring and power, or turn it off in the config if it is not connected.
- **Negative status with an `https://` address**: certificate check or handshake failed; on a LAN, plain `http://` is simpler.
- **Cannot open the serial port on Linux**: add yourself to the `dialout` group (`uucp` on some distributions) and log in again.
- **Upload cannot reach the board**: hold the BOOT button while plugging in USB to enter download mode, then flash again.
- **No log after flashing**: the USB serial port reappears when the board restarts; run `pio device monitor` again.
- **The board stops uploading after you close the serial monitor**: unplug it and power it up again. In daily use, power it from a plain USB charger rather than a computer.

### Development

```bash
pio test -e native     # unit tests for the hardware-free parts (buffer, payload, policy, URL checks)
pio run -e supermini   # build; uses the example config when there is no secrets.h
```

---

## 验收记录 / Acceptance record

2026-11-10 在真机上（ESP32-C3 SuperMini + SHT40 + AHT20，服务端为局域网内的 Docker 部署）验证通过：

- 固件占用 RAM 21.5%、Flash 59.7%。
- 房间未注册时每分钟得到 `HTTP 404, will retry`，读数保留在缓存里，注册后补传。
- 正常运行时每分钟 `upload: sent 6, 0 left`，两个传感器都是 `ok`。
- 服务端停 20 分钟后恢复：缓存的读数在下一个上报时刻分两批（100 + 5）补传完，历史曲线没有缺口。
- `https://` 服务端：TLS 握手和根证书校验成功。
- 软重启后缓存保留；重新烧录后缓存清空。

*Verified on real hardware on 2026-11-10: 404 keeps data for retry, uploads every minute, a 20-minute server outage is backfilled with no gap in the history, `https://` passes the TLS handshake and certificate check, and the buffer survives a soft restart.*
