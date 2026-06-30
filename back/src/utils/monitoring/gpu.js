'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const VENDOR_IDS = {
  '0x8086': 'intel',
  '0x10de': 'nvidia',
  '0x1002': 'amd',
};

let detectedGpus = null;
const toNum = (v) => (v != null ? Number(v) : null);

async function readSysfs(path) {
  try {
    return (await fs.readFile(path, 'utf8')).trim();
  } catch {
    return null;
  }
}

async function detectGpusLinux() {
  const gpus = [];
  try {
    const entries = await fs.readdir('/sys/class/drm');
    const cardDirs = entries.filter((e) => /^card\d+$/.test(e));

    for (const card of cardDirs) {
      try {
        const vendor = (await fs.readFile(`/sys/class/drm/${card}/device/vendor`, 'utf8')).trim();
        const vendorName = VENDOR_IDS[vendor] || 'unknown';

        let name = `${vendorName} gpu`;
        try {
          const uevent = await fs.readFile(`/sys/class/drm/${card}/device/uevent`, 'utf8');
          const match = uevent.match(/PCI_ID=(.+)/);
          if (match) name = `${vendorName} ${match[1]}`;
        } catch {}

        gpus.push({ card, vendor: vendorName, vendorId: vendor, name });
      } catch {}
    }
  } catch {}
  return gpus;
}

async function detectGpusDarwin() {
  const gpus = [];
  try {
    const { stdout } = await execFileAsync('system_profiler', ['SPDisplaysDataType', '-json']);
    const data = JSON.parse(stdout);
    const displays = data?.SPDisplaysDataType || [];

    for (const entry of displays) {
      const chipset = entry._name || entry.sppci_model || 'unknown';
      const vendor = chipset.toLowerCase().includes('nvidia') ? 'nvidia'
        : chipset.toLowerCase().includes('amd') || chipset.toLowerCase().includes('radeon') ? 'amd'
        : 'intel';

      gpus.push({
        card: null,
        vendor,
        name: chipset,
        vram: entry.sppci_vm_size || null,
      });
    }
  } catch {}
  return gpus;
}

async function detectGpusWin32() {
  const gpus = [];
  try {
    const { stdout } = await execFileAsync('powershell', [
      '-NoProfile', '-Command',
      'Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion,VideoProcessor | ConvertTo-Json',
    ]);
    const parsed = JSON.parse(stdout);
    const list = Array.isArray(parsed) ? parsed : [parsed];

    for (const gpu of list) {
      if (!gpu.Name) continue;
      const lower = gpu.Name.toLowerCase();
      const vendor = lower.includes('nvidia') || lower.includes('geforce') || lower.includes('quadro') ? 'nvidia'
        : lower.includes('amd') || lower.includes('radeon') ? 'amd'
        : 'intel';

      gpus.push({
        card: null,
        vendor,
        name: gpu.Name,
        vramMB: gpu.AdapterRAM ? +(gpu.AdapterRAM / 1024 / 1024).toFixed(0) : null,
        driverVersion: gpu.DriverVersion || null,
        videoProcessor: gpu.VideoProcessor || null,
      });
    }
  } catch {}
  return gpus;
}

async function detectGpus() {
  if (detectedGpus) return detectedGpus;

  let gpus;
  switch (process.platform) {
    case 'linux': gpus = await detectGpusLinux(); break;
    case 'darwin': gpus = await detectGpusDarwin(); break;
    case 'win32': gpus = await detectGpusWin32(); break;
    default: gpus = [];
  }

  detectedGpus = gpus;
  return gpus;
}

async function collectNvidiaMetrics() {
  const query = [
    'name', 'temperature.gpu', 'utilization.gpu', 'utilization.memory',
    'memory.total', 'memory.used', 'memory.free',
    'power.draw', 'power.limit', 'fan.speed', 'pstate',
    'clocks.current.graphics', 'clocks.current.memory',
  ];

  const { stdout } = await execFileAsync('nvidia-smi', [
    '--query-gpu=' + query.join(','),
    '--format=csv,noheader,nounits',
  ]);

  return stdout.trim().split('\n').map((line) => {
    const v = line.split(',').map((s) => s.trim());
    return {
      name: v[0],
      temperature: toNum(v[1]),
      utilization: { gpu: toNum(v[2]), memory: toNum(v[3]) },
      memory: { totalMB: toNum(v[4]), usedMB: toNum(v[5]), freeMB: toNum(v[6]) },
      power: { drawW: toNum(v[7]), limitW: toNum(v[8]) },
      fanSpeed: toNum(v[9]),
      pstate: v[10],
      clocks: { graphicsMHz: toNum(v[11]), memoryMHz: toNum(v[12]) },
    };
  });
}

async function collectIntelMetricsLinux(card) {
  const base = `/sys/class/drm/${card}/device/drm/${card}`;
  const [actFreq, curFreq, maxFreq, minFreq, boostFreq, rc6Residency] =
    await Promise.all([
      readSysfs(`${base}/gt_act_freq_mhz`),
      readSysfs(`${base}/gt_cur_freq_mhz`),
      readSysfs(`${base}/gt_max_freq_mhz`),
      readSysfs(`${base}/gt_min_freq_mhz`),
      readSysfs(`${base}/gt_boost_freq_mhz`),
      readSysfs(`${base}/power/rc6_residency_ms`),
    ]);

  return {
    name: 'Intel Integrated GPU',
    clocks: {
      currentMHz: toNum(actFreq),
      requestedMHz: toNum(curFreq),
      maxMHz: toNum(maxFreq),
      minMHz: toNum(minFreq),
      boostMHz: toNum(boostFreq),
    },
    power: { rc6ResidencyMs: toNum(rc6Residency) },
    temperature: null,
    utilization: null,
    memory: null,
  };
}

async function collectAmdMetricsLinux(card) {
  const base = `/sys/class/drm/${card}/device`;
  const [gpuBusy, vramUsed, vramTotal, gpuClock, memClock] = await Promise.all([
    readSysfs(`${base}/gpu_busy_percent`),
    readSysfs(`${base}/mem_info_vram_used`),
    readSysfs(`${base}/mem_info_vram_total`),
    readSysfs(`${base}/pp_dpm_sclk`),
    readSysfs(`${base}/pp_dpm_mclk`),
  ]);

  let currentClock = null;
  if (gpuClock) {
    const active = gpuClock.split('\n').find((l) => l.includes('*'));
    if (active) { const m = active.match(/(\d+)Mhz/); if (m) currentClock = Number(m[1]); }
  }

  let currentMemClock = null;
  if (memClock) {
    const active = memClock.split('\n').find((l) => l.includes('*'));
    if (active) { const m = active.match(/(\d+)Mhz/); if (m) currentMemClock = Number(m[1]); }
  }

  const vramUsedMB = vramUsed != null ? +(vramUsed / 1024 / 1024).toFixed(2) : null;
  const vramTotalMB = vramTotal != null ? +(vramTotal / 1024 / 1024).toFixed(2) : null;

  return {
    name: 'AMD GPU',
    utilization: { gpu: toNum(gpuBusy) },
    memory: {
      usedMB: vramUsedMB,
      totalMB: vramTotalMB,
      freeMB: vramUsedMB != null && vramTotalMB != null ? +(vramTotalMB - vramUsedMB).toFixed(2) : null,
    },
    clocks: { graphicsMHz: currentClock, memoryMHz: currentMemClock },
    temperature: null,
    power: null,
  };
}

async function collectAmdMetricsDarwin() {
  try {
    const { stdout } = await execFileAsync('system_profiler', ['SPDisplaysDataType', '-json']);
    const data = JSON.parse(stdout);
    const displays = data?.SPDisplaysDataType || [];
    const amdEntry = displays.find((d) =>
      (d._name || '').toLowerCase().includes('amd') || (d._name || '').toLowerCase().includes('radeon'),
    );

    if (!amdEntry) return null;

    return {
      name: amdEntry._name || 'AMD GPU',
      vram: amdEntry.sppci_vm_size || null,
      temperature: null,
      utilization: null,
      memory: null,
      clocks: null,
    };
  } catch {
    return null;
  }
}

async function collectGpuMetrics() {
  try {
    const gpus = await detectGpus();

    if (gpus.length === 0) {
      return { available: false, count: 0, devices: [] };
    }

    const devices = [];

    const hasNvidia = gpus.some((g) => g.vendor === 'nvidia');
    if (hasNvidia) {
      try {
        const nvidiaData = await collectNvidiaMetrics();
        for (let i = 0; i < nvidiaData.length; i++) {
          devices.push({ vendor: 'nvidia', ...nvidiaData[i] });
        }
      } catch (err) {
        devices.push({ vendor: 'nvidia', error: err.message });
      }
    }

    for (const gpu of gpus) {
      if (gpu.vendor === 'nvidia') continue;

      try {
        let data;
        if (gpu.vendor === 'intel') {
          data = process.platform === 'linux' && gpu.card
            ? await collectIntelMetricsLinux(gpu.card)
            : { name: gpu.name, temperature: null, utilization: null, memory: null, clocks: null };
        } else if (gpu.vendor === 'amd') {
          if (process.platform === 'linux' && gpu.card) {
            data = await collectAmdMetricsLinux(gpu.card);
          } else if (process.platform === 'darwin') {
            data = await collectAmdMetricsDarwin();
          } else {
            data = { name: gpu.name, temperature: null, utilization: null, memory: null, clocks: null };
          }
        } else {
          data = { name: gpu.name || 'Unknown GPU' };
        }

        if (data) {
          devices.push({ vendor: gpu.vendor, card: gpu.card, ...data });
        }
      } catch (err) {
        devices.push({ vendor: gpu.vendor, card: gpu.card, error: err.message });
      }
    }

    return { available: devices.length > 0, count: devices.length, devices };
  } catch (err) {
    console.error('[gpu] Failed to collect GPU metrics:', err.message);
    return { available: false, error: err.message };
  }
}

module.exports = { collectGpuMetrics };
