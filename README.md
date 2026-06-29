# 🖥️ Realtime System Monitor Dashboard

A modern, real-time telemetry dashboard built with **Node.js + Socket.IO +
Tailwind CSS + Lucide Icons**.

This project provides live monitoring of system resources including:

- CPU usage (overall + per-core)
- Memory consumption
- Disk utilization
- Network interfaces
- General system information

Designed with a clean SaaS-style light UI.

---

## 📸 Dashboard Preview

![Dashboard Preview](images/dash.png)

---

## 🚀 Tech Stack

**Frontend**

- Vanilla JavaScript (ES Modules)
- Tailwind CSS v4
- Lucide Icons
- Toastify.js
- Socket.IO Client

**Backend**

- Node.js
- Express.js
- CORS
- Socket.IO
- OS module (for system metrics)

---

## ⚙️ Features

### ✅ Realtime CPU Monitoring

- Total CPU usage
- Radial gauge indicator
- Per-core usage bars

### ✅ Memory Metrics

- Total / Used / Free memory
- Live progress bar

### ✅ Disk Usage

- Mounted volumes
- Usage percentage
- Visual progress bars

### ✅ Network Interfaces

- IPv4 / IPv6 detection
- Clean interface listing

### ✅ System Information

- Hostname
- Platform
- Uptime
- Temp directory

### ✅ Live Connection Status

- Online / Offline indicator
- Toast notifications

---

## 🛠 Installation & Start

### 1️⃣ Clone the repository

```bash
git clone https://github.com/engrmh/system-monitor.git
cd system-monitor
```

### 2️⃣ Install dependencies

```bash
npm setup
```

### 3️⃣ Create .env file in back folder and write below in it

```txt
PORT=4000
clientOrigin="http://localhost:5173"
```

### 4️⃣ Start

```bash
npm start
```

Project will run at:

```
http://localhost:5173
```

---

## 🔌 WebSocket Event

The backend emits:

```js
socket.emit('monitoring', {
  cpuPercent,
  cpuPerCore,
  totalmem,
  usedMem,
  freeMem,
  percent,
  disk,
  networkData,
  hostname,
  platform,
  uptime,
  tmpDir,
  updateTime,
});
```

Frontend listens to:

```js
socket.on('monitoring', handler);
```

---

## 🎨 UI Philosophy

This project avoids custom CSS as much as possible and relies on:

- Utility-first styling (Tailwind)
- Component-like DOM rendering
- Lightweight dependency footprint

The goal was to keep it:

- Fast
- Minimal
- Maintainable
- Extensible

---

## 🧠 Why This Project?

This dashboard demonstrates:

- Real-time WebSocket communication
- Dynamic DOM rendering
- Clean UI architecture
- System-level metric handling
- Lightweight frontend engineering

---

## 📄 License

MIT License

---

## 👨‍💻 Author

Mohammad Hosein Salimbahrami

GitHub: https://github.com/engrmh
