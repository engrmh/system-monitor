# Realtime System Monitor Dashboard

A desktop application for real-time system telemetry, built with **Electron +
Node.js + Socket.IO + Tailwind CSS + Chart.js**. Monitors CPU, memory, disk,
network, GPU, process health, and system logs — all streamed live via WebSocket
to a responsive browser UI.

## Features

| Feature                | Description                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| **CPU Monitoring**     | Overall usage percentage, radial gauge, per-core breakdown bars, live line chart              |
| **Memory Metrics**     | Total / Used / Free with progress bar and usage percentage                                    |
| **Disk Usage**         | Per-mount storage with progress bars (Linux `df`, macOS `df`, Windows PowerShell)             |
| **Network Interfaces** | IPv4 / IPv6 detection, virtual interface filtering                                            |
| **Network Throughput** | Live RX/TX KB/s per interface with time-series chart (`/proc/net/dev`, `netstat`, PowerShell) |
| **GPU Metrics**        | GPU Monitoring: temperature, utilization, memory, power, fan speed, clocks                    |
| **Node Process**       | PID, uptime, CPU%, RSS, heap, external memory, array buffers                                  |
| **Runtime Health**     | Event loop lag (sampled every 500ms), active/total WebSocket connections                      |
| **System Info**        | Hostname, platform, uptime, temp directory                                                    |
| **Logs & Journal**     | Tail system log files + `journalctl` units (Linux), cross-platform log collection             |
| **Health Status**      | Auto-computed HEALTHY / WARNING / CRITICAL based on CPU, memory, disk, event loop thresholds  |

---

## 📸 Dashboard Preview

![Dashboard Preview](images/dash.png)

---

## Tech Stack

**Frontend**

- Vanilla JavaScript (ES Modules)
- Vite
- Tailwind CSS v4
- Chart.js (CPU history + network throughput line charts)
- Socket.IO Client
- Lucide Icons
- Toastify.js

**Backend**

- Node.js + Express
- Socket.IO (1-second broadcast interval)
- `os` module for system metrics
- `nvidia-smi` for GPU metrics (optional)
- `journalctl` / `tail` for log collection
- Mongoose (prepared for optional persistence)

## Project Structure

```
realtime_system_monitoring/
├── front/                    # Vite + Tailwind frontend
│   ├── index.html
│   ├── vite.config.ts
│   └── assets/
│       ├── css/style.css
│       └── js/script.js      # Single-file SPA logic
├── back/                     # Express + Socket.IO backend
│   ├── .env                  # PORT & clientOrigin config
│   └── src/
│       ├── server.js          # Entry point
│       ├── app.js             # Express app
│       ├── configs/
│       │   ├── socket.js      # Socket.IO server + 1s broadcast
│       │   └── db.js          # MongoDB connection (optional)
│       ├── controllers/
│       │   └── monitoring/
│       │       └── monitoring.controller.js
│       └── utils/monitoring/
│           ├── cpu.js         # Delta-based CPU usage calculation
│           ├── memory.js      # System + process memory
│           ├── disk.js        # Cross-platform disk usage
│           ├── network.js     # Interfaces + throughput
│           ├── gpu.js         # NVIDIA GPU via nvidia-smi
│           ├── logs.js        # Log files + journalctl
│           ├── process.js     # Node.js process metrics
│           ├── eventLoop.js   # Event loop lag measurement
│           ├── connections.js # WebSocket connection tracking
│           ├── resourceUsage.js
│           └── system.js      # Static system info
├── images/
├── package.json              # Root scripts (setup, start)
├── LICENSE
└── README.md
```

## Getting Started

### Prerequisites

- Node.js >= 18
- npm
- (Optional) NVIDIA GPU with `nvidia-smi` for GPU metrics

### Install

```bash
git clone https://github.com/engrmh/system-monitor.git
cd system-monitor
npm run setup
```

### Configure

Create `back/.env`:

```env
PORT=4000
clientOrigin="http://localhost:5173"
```

### Run (Web)

```bash
npm start
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

Individual commands:

```bash
npm run start:back   # Backend only
npm run start:front  # Frontend only
```

## WebSocket Protocol

The backend broadcasts a `monitoring` event every **1 second**:

```js
socket.on('monitoring', (data) => {
  // CPU
  data.cpuPercent       // number (0-100)
  data.cpuPerCore       // number[]
  data.cpuModel         // string
  data.cpuCoresCount    // number
  data.arch             // string

  // Memory
  data.totalmem         // GB
  data.usedMem          // GB
  data.freeMem          // GB
  data.percent          // usage %

  // Disk
  data.disk[]           // { mount, totalGB, usedGB, freeGB, usedPercent }

  // Network
  data.networkData      // { iface: [{ family, address }] }
  data.throughput       // { iface: { rxKBps, txKBps } }

  // GPU
  data.gpu              // { available, name, temperature, utilization, memory, power, ... }

  // Process
  data.process          // { pid, uptime, cpu, memory }

  // Runtime
  data.eventLoop        // { lagMs }
  data.connections      // { active, total }

  // Logs
  data.logs             // { logs[], journal[], timestamp }

  // System
  data.hostname, data.platform, data.uptime, data.tmpDir, data.updateTime
});
```

Max 100 concurrent clients. Client receives cached data immediately on connect.

## Architecture

- **Backend** collects metrics from `os`, `child_process` (`nvidia-smi`,
  `journalctl`, `tail`, `df`), and Node.js internals. Disk results are cached
  for 30s. Network throughput is calculated via delta between samples.
- **Frontend** is a single `script.js` connecting to the WebSocket, rendering
  all metrics into a Tailwind grid layout with two Chart.js line charts.
- **Health level** is computed client-side: CRITICAL at CPU >= 85%, memory >=
  90%, disk >= 90%, event loop lag >= 40ms; WARNING at lower thresholds.
- **Electron** wraps the whole stack into a native desktop window with no
  external dependencies at runtime.

## Platform Support

| Component | Linux                 | macOS                 | Windows                      |
| --------- | --------------------- | --------------------- | ---------------------------- |
| CPU       | `os.cpus()`           | `os.cpus()`           | `os.cpus()`                  |
| Memory    | `os.totalmem/freemem` | `os.totalmem/freemem` | `os.totalmem/freemem`        |
| Disk      | `df -kP`              | `df -k`               | PowerShell `Get-CimInstance` |
| Network   | `/proc/net/dev`       | `netstat -ib`         | PowerShell `Get-NetAdapter`  |
| GPU       | `nvidia-smi`          | `nvidia-smi`          | `nvidia-smi`                 |
| Logs      | `tail` + `journalctl` | `tail`                | PowerShell Event Log         |

## Author

**Mohammad Hosein Salimbahrami** — [GitHub](https://github.com/engrmh) ·
[Telegram](https://t.me/engr_mh) ·
[LinkedIn](https://www.linkedin.com/in/mohammad-hosein-salimbahrami)

## License

MIT
