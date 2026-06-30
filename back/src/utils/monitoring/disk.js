'use strict';

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const os = require('node:os');

const execFileAsync = promisify(execFile);

let diskCache = null;
let diskCacheTime = 0;
const DISK_CACHE_TTL_MS = 30_000;

const toGB_kb = (kb) => +(kb / 1024 / 1024).toFixed(2);
const toGB_bytes = (b) => +(b / 1024 ** 3).toFixed(2);

async function getDiskUsageLinux() {
  const { stdout } = await execFileAsync('df', ['-kP']);
  const lines = stdout.trim().split('\n').slice(1);

  return lines
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 6) return null;

      const totalKB = parseInt(parts[1], 10);
      const usedKB = parseInt(parts[2], 10);
      const freeKB = parseInt(parts[3], 10);
      const percentStr = parts[4];
      const mount = parts[5];
      if (!parts[0].startsWith('/dev/') && mount !== '/') return null;

      return {
        mount,
        totalGB: toGB_kb(totalKB),
        usedGB: toGB_kb(usedKB),
        freeGB: toGB_kb(freeKB),
        usedPercent: parseInt(percentStr, 10),
      };
    })
    .filter(Boolean);
}

async function getDiskUsageDarwin() {
  const { stdout } = await execFileAsync('df', ['-k']);
  const lines = stdout.trim().split('\n').slice(1);

  return lines
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 9) return null;

      const filesystem = parts[0];
      const totalKB = parseInt(parts[1], 10);
      const usedKB = parseInt(parts[2], 10);
      const freeKB = parseInt(parts[3], 10);
      const mount = parts[8];

      if (isNaN(totalKB) || totalKB === 0) return null;
      if (!filesystem.startsWith('/dev/')) return null;

      return {
        mount,
        totalGB: toGB_kb(totalKB),
        usedGB: toGB_kb(usedKB),
        freeGB: toGB_kb(freeKB),
        usedPercent: +((usedKB / totalKB) * 100).toFixed(0),
      };
    })
    .filter(Boolean);
}

async function getDiskUsageWindows() {
  const { stdout } = await execFileAsync('powershell', [
    '-NoProfile', '-Command',
    'Get-CimInstance Win32_LogicalDisk | Where-Object {$_.DriveType -eq 3} | Select-Object DeviceID,FreeSpace,Size | ConvertTo-Json',
  ]);

  const parsed = JSON.parse(stdout);
  const drives = Array.isArray(parsed) ? parsed : [parsed];

  return drives
    .map((d) => {
      const mount = d.DeviceID;
      const free = parseInt(d.FreeSpace, 10);
      const total = parseInt(d.Size, 10);

      if (!mount || isNaN(free) || isNaN(total) || total === 0) return null;

      const used = total - free;

      return {
        mount,
        totalGB: toGB_bytes(total),
        usedGB: toGB_bytes(used),
        freeGB: toGB_bytes(free),
        usedPercent: +((used / total) * 100).toFixed(1),
      };
    })
    .filter(Boolean);
}

async function collectDiskUsage() {
  try {
    const now = Date.now();
    if (diskCache && (now - diskCacheTime) < DISK_CACHE_TTL_MS) {
      return diskCache;
    }

    let data;
    switch (os.platform()) {
      case 'linux':
        data = await getDiskUsageLinux();
        break;
      case 'darwin':
        data = await getDiskUsageDarwin();
        break;
      case 'win32':
        data = await getDiskUsageWindows();
        break;
      default:
        data = null;
    }

    diskCache = data;
    diskCacheTime = now;
    return data;
  } catch (err) {
    console.error('[disk] Failed to collect disk usage:', err.message);
    return null;
  }
}

module.exports = { collectDiskUsage };
