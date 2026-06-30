# Dashboard zur Systemüberwachung in Echtzeit

Eine Desktop-Anwendung für Systemtelemetrie in Echtzeit, entwickelt mit
**Node.js + Socket.IO + Tailwind CSS + Chart.js**. Sie überwacht CPU,
Arbeitsspeicher, Festplatte, Netzwerk, GPU, Prozesszustand und Systemprotokolle
— alles live per WebSocket an eine responsive Browser-Oberfläche gestreamt.

## Funktionen

| Funktion                   | Beschreibung                                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **CPU-Überwachung**        | Gesamtauslastung in Prozent, Radialanzeige, Balkenaufschlüsselung pro Kern, Live-Liniendiagramm                                     |
| **Speichermetriken**       | Gesamt / Belegt / Frei mit Fortschrittsbalken und Nutzungsprozentsatz                                                               |
| **Festplattennutzung**     | Speicher pro Mountpoint mit Fortschrittsbalken (Linux `df`, macOS `df`, Windows PowerShell)                                         |
| **Netzwerkschnittstellen** | IPv4-/IPv6-Erkennung, Filterung virtueller Schnittstellen                                                                           |
| **Netzwerkdurchsatz**      | Live-RX/TX in KB/s pro Schnittstelle mit Zeitreihendiagramm (`/proc/net/dev`, `netstat`, PowerShell)                                |
| **GPU-Metriken**           | GPU-Überwachung: Temperatur, Auslastung, Speicher, Leistungsaufnahme, Lüftergeschwindigkeit, Taktfrequenzen                         |
| **Node-Prozess**           | PID, Laufzeit, CPU%, RSS, Heap, externer Speicher, Array-Buffer                                                                     |
| **Laufzeitgesundheit**     | Event-Loop-Latenz (alle 500 ms gemessen), aktive/gesamte WebSocket-Verbindungen                                                     |
| **Systeminformationen**    | Hostname, Plattform, Uptime, temporäres Verzeichnis                                                                                 |
| **Logs & Journal**         | Anhängen an System-Logdateien + `journalctl`-Units (Linux), plattformübergreifende Log-Erfassung                                    |
| **Gesundheitsstatus**      | Automatische Berechnung von HEALTHY / WARNING / CRITICAL basierend auf CPU-, Speicher-, Festplatten- und Event-Loop-Schwellenwerten |

---

## 📸 Dashboard-Vorschau

![Dashboard Preview](../images/dash.png)

---

## Tech-Stack

**Frontend**

- Vanilla JavaScript (ES-Module)
- Vite
- Tailwind CSS v4
- Chart.js (CPU-Verlauf + Liniendiagramme für Netzwerkdurchsatz)
- Socket.IO Client
- Lucide Icons
- Toastify.js

**Backend**

- Node.js + Express
- Socket.IO (Broadcast-Intervall von 1 Sekunde)
- `os`-Modul für Systemmetriken
- `nvidia-smi` für GPU-Metriken (optional)
- `journalctl` / `tail` für Log-Erfassung
- Mongoose (vorbereitet für optionale Persistenz)

## Projektstruktur

```text
realtime_system_monitoring/
├── front/                    # Vite + Tailwind Frontend
│   ├── index.html
│   ├── vite.config.ts
│   └── assets/
│       ├── css/style.css
│       └── js/script.js      # SPA-Logik in einer Datei
├── back/                     # Express + Socket.IO Backend
│   ├── .env                  # PORT- & clientOrigin-Konfiguration
│   └── src/
│       ├── server.js          # Einstiegspunkt
│       ├── app.js             # Express-App
│       ├── configs/
│       │   ├── socket.js      # Socket.IO-Server + 1s-Broadcast
│       │   └── db.js          # MongoDB-Verbindung (optional)
│       ├── controllers/
│       │   └── monitoring/
│       │       └── monitoring.controller.js
│       └── utils/monitoring/
│           ├── cpu.js         # Delta-basierte CPU-Auslastungsberechnung
│           ├── memory.js      # System- + Prozessspeicher
│           ├── disk.js        # Plattformübergreifende Festplattennutzung
│           ├── network.js     # Schnittstellen + Durchsatz
│           ├── gpu.js         # NVIDIA-GPU über nvidia-smi
│           ├── logs.js        # Logdateien + journalctl
│           ├── process.js     # Node.js-Prozessmetriken
│           ├── eventLoop.js   # Messung der Event-Loop-Latenz
│           ├── connections.js # Tracking von WebSocket-Verbindungen
│           ├── resourceUsage.js
│           └── system.js      # Statische Systeminformationen
├── images/
├── package.json              # Root-Skripte (setup, start)
├── LICENSE
└── README.md
```

## Erste Schritte

### Voraussetzungen

- Node.js >= 18
- npm
- (Optional) NVIDIA-GPU mit `nvidia-smi` für GPU-Metriken

### Installation

```bash
git clone https://github.com/engrmh/system-monitor.git
cd system-monitor
npm run setup
```

### Konfiguration

Erstelle `back/.env`:

```env
PORT=4000
clientOrigin="http://localhost:5173"
```

### Starten (Web)

```bash
npm start
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

Einzelne Befehle:

```bash
npm run start:back   # Nur Backend
npm run start:front  # Nur Frontend
```

## WebSocket-Protokoll

Das Backend sendet alle **1 Sekunde** ein `monitoring`-Event:

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

Maximal 100 gleichzeitige Clients. Beim Verbindungsaufbau erhält der Client
sofort die zwischengespeicherten Daten.

## Architektur

- **Das Backend** sammelt Metriken aus `os`, `child_process` (`nvidia-smi`,
  `journalctl`, `tail`, `df`) und Node.js-Interna. Festplattenergebnisse werden
  30 Sekunden lang zwischengespeichert. Der Netzwerkdurchsatz wird über die
  Differenz zwischen den Samples berechnet.
- **Das Frontend** besteht aus einer einzigen `script.js`, die sich mit dem
  WebSocket verbindet und alle Metriken in einem Tailwind-Grid mit zwei
  Chart.js-Liniendiagrammen rendert.
- **Der Gesundheitsstatus** wird clientseitig berechnet: CRITICAL bei CPU >= 85
  %, Speicher >= 90 %, Festplatte >= 90 %, Event-Loop-Latenz >= 40 ms; WARNING
  bei niedrigeren Schwellenwerten.

## Plattformunterstützung

| Komponente | Linux                 | macOS                 | Windows                      |
| ---------- | --------------------- | --------------------- | ---------------------------- |
| CPU        | `os.cpus()`           | `os.cpus()`           | `os.cpus()`                  |
| Memory     | `os.totalmem/freemem` | `os.totalmem/freemem` | `os.totalmem/freemem`        |
| Disk       | `df -kP`              | `df -k`               | PowerShell `Get-CimInstance` |
| Network    | `/proc/net/dev`       | `netstat -ib`         | PowerShell `Get-NetAdapter`  |
| GPU        | `nvidia-smi`          | `nvidia-smi`          | `nvidia-smi`                 |
| Logs       | `tail` + `journalctl` | `tail`                | PowerShell Event Log         |

## Autor

**Mohammad Hosein Salimbahrami** — [GitHub](https://github.com/engrmh) ·
[Telegram](https://t.me/engr_mh) ·
[LinkedIn](https://www.linkedin.com/in/mohammad-hosein-salimbahrami)

## Lizenz

MIT
