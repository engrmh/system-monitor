import Chart from 'chart.js/auto';
import { io } from 'socket.io-client';
import Toastify from 'toastify-js';

const $ = document;

/* -------------------- Elements -------------------- */

// Header / status
const statusDot = $.getElementById('statusDot');
const statusText = $.getElementById('statusText');
const healthStatus = $.getElementById('healthStatus');

// CPU
const cpuModel = $.getElementById('cpuModel');
const cpuCores = $.getElementById('cpuCores');
const cpuArch = $.getElementById('cpuArch');
const cpuPercent = $.getElementById('cpuPercent');
const cpuGauge = $.getElementById('cpuGauge');
const coresContainer = $.getElementById('coresContainer');
const cpuChartCanvas = $.getElementById('cpuChart');

// Memory
const totalMem = $.getElementById('totalMem');
const usedMem = $.getElementById('usedMem');
const freeMem = $.getElementById('freeMem');
const memProgress = $.getElementById('memProgress');
const memPercent = $.getElementById('memPercent');

// Disk / Network
const diskContainer = $.getElementById('diskContainer');
const networkList = $.getElementById('networkList');
const throughputList = $.getElementById('throughputList');
const networkChartCanvas = $.getElementById('networkChart');

// System
const hostname = $.getElementById('hostname');
const platform = $.getElementById('platform');
const uptime = $.getElementById('uptime');
const tmpDir = $.getElementById('tmpDir');
const updateTime = $.getElementById('updateTime');

// Process
const procPid = $.getElementById('procPid');
const procUptime = $.getElementById('procUptime');
const procCpuPercent = $.getElementById('procCpuPercent');
const procRss = $.getElementById('procRss');
const procHeapTotal = $.getElementById('procHeapTotal');
const procHeapUsed = $.getElementById('procHeapUsed');
const procExternal = $.getElementById('procExternal');
const procArrayBuffers = $.getElementById('procArrayBuffers');

// Runtime health
const eventLoopLag = $.getElementById('eventLoopLag');
const connActive = $.getElementById('connActive');
const connTotal = $.getElementById('connTotal');

// Logs
const logsContainer = $.getElementById('logsContainer');
const journalContainer = $.getElementById('journalContainer');
const logsTimestamp = $.getElementById('logsTimestamp');

// GPU (list mode)
const gpuAvailable = $.getElementById('gpuAvailable');
const gpuCount = $.getElementById('gpuCount');
const gpuDevicesContainer = $.getElementById('gpuDevicesContainer');

/* -------------------- Helpers -------------------- */

const f1 = (n) => (Number.isFinite(Number(n)) ? Number(n).toFixed(1) : '0.0');
const f2 = (n) => (Number.isFinite(Number(n)) ? Number(n).toFixed(2) : '0.00');

function setStatus(state, text) {
  if (statusText) statusText.textContent = text;
  if (statusDot) {
    statusDot.className =
      'w-2 h-2 rounded-full ' +
      (state === 'online'
        ? 'bg-green-500'
        : state === 'offline'
          ? 'bg-red-500'
          : 'bg-yellow-400');
  }
}

function setHealth(data) {
  const cpu = Number(data.cpuPercent ?? 0);
  const mem = Number(data.percent ?? 0);
  const lag = Number(data.eventLoop?.lagMs ?? 0);
  const maxDisk = Array.isArray(data.disk)
    ? Math.max(...data.disk.map((d) => Number(d.usedPercent ?? 0)))
    : 0;

  let level = 'HEALTHY';
  let cls = 'text-green-600';

  if (cpu >= 85 || mem >= 90 || maxDisk >= 90 || lag >= 40) {
    level = 'CRITICAL';
    cls = 'text-red-600';
  } else if (cpu >= 70 || mem >= 75 || maxDisk >= 80 || lag >= 15) {
    level = 'WARNING';
    cls = 'text-amber-600';
  }

  if (healthStatus) {
    healthStatus.textContent = level;
    healthStatus.className = `text-sm font-bold ${cls}`;
  }
}

function isVirtualIface(name = '') {
  return /^(lo|docker\d*|br-|veth|virbr|tun|tap|vmnet|zt)/i.test(name);
}

function getDisplayInterfaces(networkData = {}, showVirtual = false) {
  return Object.entries(networkData).filter(([name]) =>
    showVirtual ? true : !isVirtualIface(name),
  );
}

function pickActiveInterface(throughput = {}) {
  const entries = Object.entries(throughput);
  if (!entries.length) return null;

  const active = entries
    .filter(([name]) => name !== 'lo')
    .sort(
      (a, b) =>
        (b[1]?.rxKBps ?? 0) +
        (b[1]?.txKBps ?? 0) -
        ((a[1]?.rxKBps ?? 0) + (a[1]?.txKBps ?? 0)),
    );

  if (active.length && (active[0][1]?.rxKBps > 0 || active[0][1]?.txKBps > 0)) {
    return active[0][0];
  }

  return entries.find(([name]) => name === 'wlp0s20f3')?.[0] || entries[0][0];
}

function fmtClockTime(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('en-US', { hour12: false });
}

/* -------------------- Charts -------------------- */

const MAX_POINTS = 40;

const cpuChart = cpuChartCanvas
  ? new Chart(cpuChartCanvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'CPU %',
            data: [],
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37,99,235,0.15)',
            fill: true,
            tension: 0.25,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: { mode: 'index', intersect: false },
        },
        scales: {
          x: { ticks: { maxTicksLimit: 6 } },
          y: { min: 0, max: 100, ticks: { stepSize: 20 } },
        },
      },
    })
  : null;

const networkChart = networkChartCanvas
  ? new Chart(networkChartCanvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'RX KB/s',
            data: [],
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6,182,212,0.15)',
            fill: true,
            tension: 0.25,
            pointRadius: 0,
          },
          {
            label: 'TX KB/s',
            data: [],
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245,158,11,0.15)',
            fill: true,
            tension: 0.25,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: false,
        plugins: {
          legend: { display: true },
          tooltip: { mode: 'index', intersect: false },
        },
        scales: {
          x: { ticks: { maxTicksLimit: 6 } },
          y: { beginAtZero: true },
        },
      },
    })
  : null;

function pushChartPoint(chart, values, label) {
  if (!chart) return;
  chart.data.labels.push(label);
  chart.data.datasets.forEach((ds, idx) => ds.data.push(values[idx] ?? 0));

  if (chart.data.labels.length > MAX_POINTS) {
    chart.data.labels.shift();
    chart.data.datasets.forEach((ds) => ds.data.shift());
  }
  chart.update('none');
}

/* -------------------- Socket -------------------- */

const isDev = window.location.port === '5173';
const SOCKET_URL = isDev ? 'http://localhost:4000' : window.location.origin;

const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  setStatus('online', 'Connected');
  Toastify({
    text: 'Connected to monitoring server',
    duration: 2200,
    gravity: 'top',
    position: 'right',
    style: { background: '#2563eb' },
  }).showToast();
});

socket.on('disconnect', () => {
  setStatus('offline', 'Disconnected');
  Toastify({
    text: 'Socket disconnected',
    duration: 2200,
    gravity: 'top',
    position: 'right',
    style: { background: '#ef4444' },
  }).showToast();
});

socket.on('connect_error', () => {
  setStatus('offline', 'Connection Error');
});

/* -------------------- Main Event -------------------- */

socket.on('monitoring', (data) => {
  const cpu = Number(data.cpuPercent ?? 0);
  const nowLabel = new Date().toLocaleTimeString('en-US', { hour12: false });

  // CPU
  if (cpuPercent) cpuPercent.textContent = `${f1(cpu)}%`;
  if (cpuGauge) {
    const deg = Math.max(0, Math.min(100, cpu)) * 3.6;
    cpuGauge.style.background = `conic-gradient(#2563eb ${deg}deg,#e2e8f0 ${deg}deg)`;
  }
  if (cpuModel) cpuModel.textContent = data.cpuModel || '-';
  if (cpuCores) cpuCores.textContent = data.cpuCoresCount ?? '-';
  if (cpuArch) cpuArch.textContent = data.arch || '-';
  pushChartPoint(cpuChart, [cpu], nowLabel);

  if (Array.isArray(data.cpuPerCore) && coresContainer) {
    coresContainer.innerHTML = '';
    data.cpuPerCore.forEach((usage, i) => {
      const u = Number(usage ?? 0);
      const el = $.createElement('div');
      el.className = 'bg-slate-50 rounded-xl p-3 space-y-2';
      el.innerHTML = `
        <div class="flex justify-between text-xs font-semibold">
          <span>Core ${i + 1}</span>
          <span>${f1(u)}%</span>
        </div>
        <div class="h-2 bg-slate-200 rounded overflow-hidden">
          <div class="h-2 bg-emerald-500" style="width:${Math.max(0, Math.min(100, u))}%"></div>
        </div>
      `;
      coresContainer.appendChild(el);
    });
  }

  // Memory
  const memPct = Number(data.percent ?? 0);
  if (totalMem) totalMem.textContent = `${f2(data.totalmem)} GB`;
  if (usedMem) usedMem.textContent = `${f2(data.usedMem)} GB`;
  if (freeMem) freeMem.textContent = `${f2(data.freeMem)} GB`;
  if (memPercent) memPercent.textContent = `${f1(memPct)}%`;
  if (memProgress)
    memProgress.style.width = `${Math.max(0, Math.min(100, memPct))}%`;

  // Disk
  if (Array.isArray(data.disk) && diskContainer) {
    diskContainer.innerHTML = '';
    data.disk.forEach((d) => {
      const p = Number(d.usedPercent ?? 0);
      const el = $.createElement('div');
      el.className = 'space-y-1';
      el.innerHTML = `
        <div class="flex justify-between text-sm">
          <span class="font-medium">${d.mount}</span>
          <span class="text-slate-500">${f1(p)}%</span>
        </div>
        <div class="h-2 bg-slate-200 rounded">
          <div class="h-2 bg-orange-500 rounded" style="width:${Math.max(0, Math.min(100, p))}%"></div>
        </div>
        <div class="text-xs text-slate-500">${f2(d.usedGB)} / ${f2(d.totalGB)} GB</div>
      `;
      diskContainer.appendChild(el);
    });
  }

  // Network interfaces
  if (data.networkData && networkList) {
    networkList.innerHTML = '';
    const ifaces = getDisplayInterfaces(data.networkData, false);

    if (!ifaces.length) {
      networkList.innerHTML = `<div class="text-sm text-slate-500">No physical interfaces</div>`;
    } else {
      for (const [name, items] of ifaces) {
        const ipv4 = items.find((x) => x.family === 'IPv4');
        const ipv6List = items
          .filter((x) => x.family === 'IPv6')
          .map((x) => x.address);
        const el = $.createElement('div');
        el.className =
          'flex justify-between items-start bg-slate-50 rounded-lg p-3 text-sm';
        el.innerHTML = `
          <div class="flex items-center gap-2">
            <i data-lucide="network" class="w-4 h-4 text-slate-500"></i>
            <span class="font-semibold">${name}</span>
          </div>
          <div class="text-right">
            <div class="text-blue-600">${ipv4?.address || '-'}</div>
            <div class="text-xs text-slate-400 max-w-[260px] break-all">${ipv6List[0] || ''}</div>
          </div>
        `;
        networkList.appendChild(el);
      }
    }
  }

  // Throughput
  if (data.throughput && throughputList) {
    throughputList.innerHTML = '';
    const tEntries = Object.entries(data.throughput).filter(
      ([name]) => !isVirtualIface(name),
    );

    if (!tEntries.length) {
      throughputList.innerHTML = `<div class="text-sm text-slate-500">No throughput data</div>`;
    } else {
      tEntries.forEach(([iface, t]) => {
        const el = $.createElement('div');
        el.className =
          'flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm';
        el.innerHTML = `
          <span class="font-medium">${iface}</span>
          <span class="text-slate-600">RX: ${f2(t.rxKBps)} | TX: ${f2(t.txKBps)}</span>
        `;
        throughputList.appendChild(el);
      });
    }

    const filtered = Object.fromEntries(tEntries);
    const activeIface = pickActiveInterface(filtered);
    if (activeIface && networkChart) {
      const rx = Number(filtered[activeIface]?.rxKBps ?? 0);
      const tx = Number(filtered[activeIface]?.txKBps ?? 0);
      networkChart.data.datasets[0].label = `${activeIface} RX KB/s`;
      networkChart.data.datasets[1].label = `${activeIface} TX KB/s`;
      pushChartPoint(networkChart, [rx, tx], nowLabel);
    }
  }

  // System
  if (hostname) hostname.textContent = data.hostname || '-';
  if (platform)
    platform.textContent = `${data.platform || '-'} (${data.osType || '-'})`;
  if (uptime) uptime.textContent = data.uptime ? `${data.uptime} h` : '-';
  if (tmpDir) tmpDir.textContent = data.tmpDir || '-';
  if (updateTime) updateTime.textContent = fmtClockTime(data.updateTime);

  // Process
  if (data.process) {
    if (procPid) procPid.textContent = data.process.pid ?? '-';
    if (procUptime) procUptime.textContent = f1(data.process.uptime ?? 0);
    if (procCpuPercent)
      procCpuPercent.textContent = `${f2(data.process.cpu?.percent ?? 0)}%`;
    if (procRss)
      procRss.textContent = `${f2(data.process.memory?.rss ?? 0)} MB`;
    if (procHeapTotal)
      procHeapTotal.textContent = `${f2(data.process.memory?.heapTotal ?? 0)} MB`;
    if (procHeapUsed)
      procHeapUsed.textContent = `${f2(data.process.memory?.heapUsed ?? 0)} MB`;
    if (procExternal)
      procExternal.textContent = `${f2(data.process.memory?.external ?? 0)} MB`;
    if (procArrayBuffers)
      procArrayBuffers.textContent = `${f2(data.process.memory?.arrayBuffers ?? 0)} MB`;
  }

  // Runtime
  if (eventLoopLag)
    eventLoopLag.textContent = `${f2(data.eventLoop?.lagMs ?? 0)} ms`;
  if (connActive) connActive.textContent = data.connections?.active ?? 0;
  if (connTotal) connTotal.textContent = data.connections?.total ?? 0;

  // Logs + Journal
  if (data.logs) {
    if (logsContainer && Array.isArray(data.logs.logs)) {
      logsContainer.innerHTML = '';
      data.logs.logs.forEach((l) => {
        const hasError = !!l.error;
        const missingFile = /No such file or directory/i.test(l.error || '');
        const el = $.createElement('div');
        el.className = 'border rounded-xl p-3 bg-slate-50';

        const linesHtml = (l.lines || [])
          .map(
            (line) =>
              `<div class="font-mono text-xs text-slate-700">${line}</div>`,
          )
          .join('');

        el.innerHTML = `
          <div class="flex justify-between items-start gap-3">
            <div class="text-sm font-semibold break-all">${l.file}</div>
            <span class="text-xs px-2 py-1 rounded-full ${
              hasError
                ? 'bg-red-100 text-red-600'
                : 'bg-emerald-100 text-emerald-700'
            }">${hasError ? (missingFile ? 'Missing File' : 'Error') : 'OK'}</span>
          </div>
          ${
            hasError
              ? `<pre class="mt-2 text-xs text-red-600 whitespace-pre-wrap">${missingFile ? 'Log file not found on host.' : l.error}</pre>`
              : `<div class="mt-2 space-y-1">${linesHtml || '<div class="text-xs text-slate-500">No lines</div>'}</div>`
          }
        `;
        logsContainer.appendChild(el);
      });
    }

    if (journalContainer && Array.isArray(data.logs.journal)) {
      journalContainer.innerHTML = '';
      data.logs.journal.forEach((j) => {
        const el = $.createElement('div');
        el.className = 'border rounded-xl p-3 bg-white';
        el.innerHTML = `
          <div class="flex items-center justify-between">
            <div class="text-sm font-semibold">${j.unit || '-'}</div>
            <div class="text-xs text-slate-500">Total: ${j.totalLines ?? 0}</div>
          </div>
          <div class="mt-2 text-xs text-slate-600 space-y-1">
            ${
              j.lines?.length
                ? j.lines
                    .map((line) => `<div class="font-mono">${line}</div>`)
                    .join('')
                : '<div class="text-slate-400">No entries</div>'
            }
          </div>
        `;
        journalContainer.appendChild(el);
      });
    }

    if (logsTimestamp)
      logsTimestamp.textContent = fmtClockTime(data.logs.timestamp);
  }

  // GPU (new object: gpu.devices[])
  if (data.gpu) {
    if (gpuAvailable)
      gpuAvailable.textContent = data.gpu.available
        ? 'Available'
        : 'Not Available';
    if (gpuCount) gpuCount.textContent = data.gpu.count ?? 0;

    if (gpuDevicesContainer) {
      gpuDevicesContainer.innerHTML = '';
      const devices = Array.isArray(data.gpu.devices) ? data.gpu.devices : [];

      if (!devices.length) {
        gpuDevicesContainer.innerHTML = `<div class="text-sm text-slate-500">No GPU devices</div>`;
      } else {
        devices.forEach((d, i) => {
          const el = $.createElement('div');
          el.className = 'border rounded-xl p-4 bg-slate-50 space-y-2';
          el.innerHTML = `
            <div class="flex items-center justify-between">
              <div class="font-semibold text-sm">${d.name || `GPU ${i + 1}`}</div>
              <div class="text-xs px-2 py-1 rounded bg-slate-200 text-slate-700 uppercase">${d.vendor || '-'}</div>
            </div>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>Temp: <span class="font-semibold">${d.temperature != null ? `${d.temperature} °C` : '-'}</span></div>
              <div>Util: <span class="font-semibold">${d.utilization?.gpu != null ? `${d.utilization.gpu}%` : '-'}</span></div>
              <div>Mem Util: <span class="font-semibold">${d.utilization?.memory != null ? `${d.utilization.memory}%` : '-'}</span></div>
              <div>P-State: <span class="font-semibold">${d.pstate || '-'}</span></div>
              <div>Mem: <span class="font-semibold">${
                d.memory?.usedMB != null && d.memory?.totalMB != null
                  ? `${d.memory.usedMB}/${d.memory.totalMB} MB`
                  : '-'
              }</span></div>
              <div>Power: <span class="font-semibold">${d.power?.drawW != null ? `${f2(d.power.drawW)} W` : '-'}</span></div>
              <div>Fan: <span class="font-semibold">${d.fanSpeed != null ? `${d.fanSpeed}%` : '-'}</span></div>
              <div>Clocks: <span class="font-semibold">${
                d.clocks?.graphicsMHz != null && d.clocks?.memoryMHz != null
                  ? `GFX ${d.clocks.graphicsMHz} / MEM ${d.clocks.memoryMHz} MHz`
                  : d.clocks?.currentMHz != null
                    ? `${d.clocks.currentMHz} MHz`
                    : '-'
              }</span></div>
            </div>
          `;
          gpuDevicesContainer.appendChild(el);
        });
      }
    }
  }

  setHealth(data);

  if (!window.__lucide_done__) {
    lucide.createIcons();
    window.__lucide_done__ = true;
  }
});

lucide.createIcons();
