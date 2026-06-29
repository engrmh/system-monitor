'use strict';

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const os = require('node:os');

const execFileAsync = promisify(execFile);

/**
 * Disk parsing logic:
 *
 * Linux/macOS — `df -k` outputs:
 *   Filesystem  1K-blocks  Used  Available  Use%  Mounted on
 *   /dev/sda1   51475068   8000  43475068   16%   /
 *
 * We split each line by whitespace, grab columns by index,
 * convert 1K-blocks → GB, and parse the Use% field.
 *
 * Windows — `wmic logicaldisk` outputs CSV-like:
 *   DeviceID  FreeSpace  Size
 *   C:        53687091200  107374182400
 *
 * We parse DeviceID as mount, compute used = Size - FreeSpace.
 */

async function getDiskUsageUnix() {
  // -k = 1K block units, -P = POSIX output (no line wrapping)
  const { stdout } = await execFileAsync('df', ['-kP']);
  const lines = stdout.trim().split('\n').slice(1); // skip header

  return lines
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 6) return null;

      const totalKB = parseInt(parts[1], 10);
      const usedKB = parseInt(parts[2], 10);
      const freeKB = parseInt(parts[3], 10);
      const percentStr = parts[4]; // e.g. "16%"
      const mount = parts[5];

      // Skip pseudo-filesystems (tmpfs, devtmpfs, etc.)
      if (!parts[0].startsWith('/dev/') && mount !== '/') return null;

      const toGB = (kb) => +(kb / 1024 / 1024).toFixed(2);

      return {
        mount,
        totalGB: toGB(totalKB),
        usedGB: toGB(usedKB),
        freeGB: toGB(freeKB),
        usedPercent: parseInt(percentStr, 10),
      };
    })
    .filter(Boolean);
}

async function getDiskUsageWindows() {
  const { stdout } = await execFileAsync('wmic', [
    'logicaldisk',
    'get',
    'DeviceID,FreeSpace,Size',
    '/format:csv',
  ]);

  const lines = stdout
    .trim()
    .split('\n')
    .filter((l) => l.trim());
  // First line is blank node name, second is header
  const dataLines = lines.slice(2);

  return dataLines
    .map((line) => {
      const parts = line.trim().split(',');
      // CSV columns: Node, DeviceID, FreeSpace, Size
      if (parts.length < 4) return null;

      const mount = parts[1]?.trim();
      const free = parseInt(parts[2], 10);
      const total = parseInt(parts[3], 10);

      if (!mount || isNaN(free) || isNaN(total) || total === 0) return null;

      const used = total - free;
      const toGB = (b) => +(b / 1024 ** 3).toFixed(2);

      return {
        mount,
        totalGB: toGB(total),
        usedGB: toGB(used),
        freeGB: toGB(free),
        usedPercent: +((used / total) * 100).toFixed(1),
      };
    })
    .filter(Boolean);
}

async function collectDiskUsage() {
  try {
    const platform = os.platform();

    if (platform === 'win32') {
      return await getDiskUsageWindows();
    } else {
      return await getDiskUsageUnix();
    }
  } catch (err) {
    console.error('[disk] Failed to collect disk usage:', err.message);
    return null;
  }
}

module.exports = { collectDiskUsage };
