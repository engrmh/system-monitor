# Tableau de bord de surveillance système en temps réel

Une application de bureau pour la télémétrie système en temps réel, développée
avec **Electron + Node.js + Socket.IO + Tailwind CSS + Chart.js**. Elle
surveille le CPU, la mémoire, le disque, le réseau, le GPU, l’état des processus
et les journaux système — le tout diffusé en direct via WebSocket vers une
interface navigateur responsive.

## Fonctionnalités

| Fonctionnalité            | Description                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Surveillance du CPU**   | Pourcentage d’utilisation global, jauge radiale, barres détaillées par cœur, graphique linéaire en direct         |
| **Mesures mémoire**       | Total / Utilisé / Libre avec barre de progression et pourcentage d’utilisation                                    |
| **Utilisation du disque** | Stockage par point de montage avec barres de progression (Linux `df`, macOS `df`, Windows PowerShell)             |
| **Interfaces réseau**     | Détection IPv4 / IPv6, filtrage des interfaces virtuelles                                                         |
| **Débit réseau**          | RX/TX en direct en KB/s par interface avec graphique de série temporelle (`/proc/net/dev`, `netstat`, PowerShell) |
| **Mesures GPU**           | Surveillance GPU : température, utilisation, mémoire, puissance, vitesse du ventilateur, fréquences               |
| **Processus Node**        | PID, durée d’exécution, CPU%, RSS, heap, mémoire externe, array buffers                                           |
| **Santé d’exécution**     | Latence de la boucle d’événements (échantillonnée toutes les 500 ms), connexions WebSocket actives/totales        |
| **Informations système**  | Nom d’hôte, plateforme, temps de fonctionnement, répertoire temporaire                                            |
| **Logs & Journal**        | Suivi des fichiers journaux système + unités `journalctl` (Linux), collecte de logs multiplateforme               |
| **État de santé**         | Calcul automatique de HEALTHY / WARNING / CRITICAL selon les seuils CPU, mémoire, disque et event loop            |

---

## 📸 Aperçu du tableau de bord

![Dashboard Preview](../images/dash.png)

---

## Stack technique

**Frontend**

- JavaScript vanilla (modules ES)
- Vite
- Tailwind CSS v4
- Chart.js (historique CPU + graphiques linéaires du débit réseau)
- Socket.IO Client
- Lucide Icons
- Toastify.js

**Backend**

- Node.js + Express
- Socket.IO (diffusion toutes les 1 seconde)
- Module `os` pour les métriques système
- `nvidia-smi` pour les métriques GPU (optionnel)
- `journalctl` / `tail` pour la collecte des logs
- Mongoose (préparé pour une persistance optionnelle)

## Structure du projet

```
realtime_system_monitoring/
├── front/                    # Frontend Vite + Tailwind
│   ├── index.html
│   ├── vite.config.ts
│   └── assets/
│       ├── css/style.css
│       └── js/script.js      # Logique SPA dans un seul fichier
├── back/                     # Backend Express + Socket.IO
│   ├── .env                  # Configuration PORT & clientOrigin
│   └── src/
│       ├── server.js          # Point d’entrée
│       ├── app.js             # Application Express
│       ├── configs/
│       │   ├── socket.js      # Serveur Socket.IO + diffusion chaque 1 s
│       │   └── db.js          # Connexion MongoDB (optionnelle)
│       ├── controllers/
│       │   └── monitoring/
│       │       └── monitoring.controller.js
│       └── utils/monitoring/
│           ├── cpu.js         # Calcul d’utilisation CPU basé sur le delta
│           ├── memory.js      # Mémoire système + processus
│           ├── disk.js        # Utilisation disque multiplateforme
│           ├── network.js     # Interfaces + débit
│           ├── gpu.js         # GPU NVIDIA via nvidia-smi
│           ├── logs.js        # Fichiers logs + journalctl
│           ├── process.js     # Métriques du processus Node.js
│           ├── eventLoop.js   # Mesure de la latence de l’event loop
│           ├── connections.js # Suivi des connexions WebSocket
│           ├── resourceUsage.js
│           └── system.js      # Informations système statiques
├── images/
├── package.json              # Scripts racine (setup, start)
├── LICENSE
└── README.md
```
‍
## Démarrage

### Prérequis

- Node.js >= 18
- npm
- (Optionnel) GPU NVIDIA avec `nvidia-smi` pour les métriques GPU

### Installation

```bash
git clone https://github.com/engrmh/system-monitor.git
cd system-monitor
npm run setup
```
### Configuration

Créez `back/.env` :

```env
PORT=4000
clientOrigin="http://localhost:5173"
```

### Exécution (Web)

```bash
npm start
```

- Frontend : `http://localhost:5173`
- Backend : `http://localhost:4000`

Commandes individuelles :

```bash
npm run start:back   # Backend uniquement
npm run start:front  # Frontend uniquement
```

## Protocole WebSocket

Le backend diffuse un événement `monitoring` toutes les **1 seconde** :

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

Maximum 100 clients simultanés. Le client reçoit immédiatement les données en cache lors de la connexion.

## Architecture

- **Le backend** collecte les métriques depuis `os`, `child_process` (`nvidia-smi`, `journalctl`, `tail`, `df`) et les internals de Node.js. Les résultats disque sont mis en cache pendant 30 s. Le débit réseau est calculé via le delta entre les échantillons.
- **Le frontend** est un unique fichier `script.js` qui se connecte au WebSocket et affiche toutes les métriques dans une grille Tailwind avec deux graphiques linéaires Chart.js.
- **Le niveau de santé** est calculé côté client : CRITICAL à CPU >= 85 %, mémoire >= 90 %, disque >= 90 %, latence event loop >= 40 ms ; WARNING à des seuils inférieurs.

## Prise en charge des plateformes

| Composant | Linux | macOS | Windows |
| --------- | ----- | ----- | ------- |
| CPU | `os.cpus()` | `os.cpus()` | `os.cpus()` |
| Memory | `os.totalmem/freemem` | `os.totalmem/freemem` | `os.totalmem/freemem` |
| Disk | `df -kP` | `df -k` | PowerShell `Get-CimInstance` |
| Network | `/proc/net/dev` | `netstat -ib` | PowerShell `Get-NetAdapter` |
| GPU | `nvidia-smi` | `nvidia-smi` | `nvidia-smi` |
| Logs | `tail` + `journalctl` | `tail` | PowerShell Event Log |

## Auteur

**Mohammad Hosein Salimbahrami** — [GitHub](https://github.com/engrmh) ·
[Telegram](https://t.me/engr_mh) ·
[LinkedIn](https://www.linkedin.com/in/mohammad-hosein-salimbahrami)

## Licence

MIT