import { io } from 'socket.io-client';
import Toastify from 'toastify-js';

const $ = document;

// Elements
const statusDot = $.getElementById('statusDot');
const statusText = $.getElementById('statusText');

const cpuModel = $.getElementById('cpuModel');
const cpuCores = $.getElementById('cpuCores');
const cpuArch = $.getElementById('cpuArch');
const cpuPercent = $.getElementById('cpuPercent');
const cpuGauge = $.getElementById('cpuGauge');

const coresContainer = $.getElementById('coresContainer');

const diskContainer = $.getElementById('diskContainer');
const networkList = $.getElementById('networkList');

const totalMem = $.getElementById('totalMem');
const usedMem = $.getElementById('usedMem');
const freeMem = $.getElementById('freeMem');
const memProgress = $.getElementById('memProgress');
const memPercent = $.getElementById('memPercent');

const hostname = $.getElementById('hostname');
const platform = $.getElementById('platform');
const uptime = $.getElementById('uptime');
const tmpDir = $.getElementById('tmpDir');
const updateTime = $.getElementById('updateTime');

// SOCKET

const socket = io('http://localhost:4000', {
  transports: ['websocket', 'polling'],
});

function setStatus(state, text) {
  statusText.textContent = text;

  statusDot.className =
    'w-2 h-2 rounded-full ' +
    (state === 'online'
      ? 'bg-green-500'
      : state === 'offline'
        ? 'bg-red-500'
        : 'bg-yellow-400');
}

// CONNECTION EVENTS

socket.on('connect', () => {
  setStatus('online', 'Connected');

  Toastify({
    text: 'Connected to monitoring server',
    duration: 3000,
    gravity: 'top',
    position: 'right',
    style: {
      background: '#2563eb',
    },
  }).showToast();
});

socket.on('disconnect', () => {
  setStatus('offline', 'Disconnected');

  Toastify({
    text: 'Socket disconnected',
    duration: 3000,
    gravity: 'top',
    position: 'right',
    style: {
      background: '#ef4444',
    },
  }).showToast();
});

socket.on('connect_error', () => {
  setStatus('offline', 'Connection Error');
});

// MAIN DATA EVENT

socket.on('monitoring', (data) => {
  /* CPU OVERVIEW */

  const cpu = data.cpuPercent || 0;

  cpuPercent.textContent = cpu + '%';

  const deg = cpu * 3.6;

  cpuGauge.style.background = `conic-gradient(#2563eb ${deg}deg,#e2e8f0 ${deg}deg)`;

  cpuModel.textContent = data.cpuModel || '-';
  cpuCores.textContent = data.cpuCoresCount || data.cpuCorsCount || '-';
  cpuArch.textContent = data.arch || '-';

  /* PER CORE */

  if (Array.isArray(data.cpuPerCore)) {
    coresContainer.innerHTML = '';

    data.cpuPerCore.forEach((usage, i) => {
      const el = $.createElement('div');

      el.className = 'bg-slate-50 rounded-xl p-3 space-y-2';

      el.innerHTML = `
        <div class="flex justify-between text-xs font-semibold">
          <span>Core ${i}</span>
          <span>${usage}%</span>
        </div>

        <div class="h-2 bg-slate-200 rounded overflow-hidden">
          <div class="h-2 bg-emerald-500"
          style="width:${usage}%"></div>
        </div>
      `;

      coresContainer.appendChild(el);
    });
  }

  /* MEMORY */

  const memPct = parseFloat(data.percent) || 0;

  totalMem.textContent = `${Math.ceil(data.totalmem || 0)} GB`;
  usedMem.textContent = `${data.usedMem || 0} GB`;
  freeMem.textContent = `${data.freeMem || 0} GB`;

  memPercent.textContent = memPct.toFixed(1) + '%';
  memProgress.style.width = memPct + '%';

  /* DISKS */

  if (Array.isArray(data.disk)) {
    diskContainer.innerHTML = '';

    data.disk.forEach((d) => {
      const el = $.createElement('div');

      el.className = 'space-y-1';

      el.innerHTML = `
        <div class="flex justify-between text-sm">
          <span class="font-medium">${d.mount}</span>
          <span class="text-slate-500">${d.usedPercent}%</span>
        </div>

        <div class="h-2 bg-slate-200 rounded">
          <div class="h-2 bg-orange-500 rounded"
          style="width:${d.usedPercent}%"></div>
        </div>
      `;

      diskContainer.appendChild(el);
    });
  }

  /* NETWORK */

  if (data.networkData) {
    networkList.innerHTML = '';

    for (const [name, items] of Object.entries(data.networkData)) {
      const ipv4 = items.find((x) => x.family === 'IPv4');
      const ipv6 = items.find((x) => x.family === 'IPv6');

      const el = $.createElement('div');

      el.className =
        'flex justify-between items-center bg-slate-50 rounded-lg p-3 text-sm';

      el.innerHTML = `
        <div class="flex items-center gap-2 ">
          <i data-lucide="network" class="w-4 h-4 text-slate-500"></i>
          <span class="font-semibold">${name}</span>
        </div>

        <div class="text-right">
          <div class="text-blue-600">${ipv4?.address || '-'}</div>
          <div class="text-xs text-slate-400 truncate max-w-[140px]">${ipv6?.address || ''}</div>
        </div>
      `;

      networkList.appendChild(el);
    }

    lucide.createIcons();
  }

  /* SYSTEM */

  hostname.textContent = data.hostname || '-';
  platform.textContent = data.platform || '-';
  uptime.textContent = data.uptime ? `${data.uptime} h` : '-';
  tmpDir.textContent = data.tmpDir || '-';

  /* UPDATE TIME */

  if (data.updateTime && updateTime) {
    const date = new Date(data.updateTime);

    updateTime.textContent = date.toLocaleTimeString('en-US', {
      hour12: false,
    });
  }
});

// initial icon render
lucide.createIcons();
