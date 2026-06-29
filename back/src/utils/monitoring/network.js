'use strict';

const os = require('node:os');
const fs = require('node:fs');

/**
 * Network RX/TX tracking.
 *
 * On Linux: /proc/net/dev gives per-interface byte counters.
 * On macOS/Windows: no reliable built-in source → return null gracefully.
 *
 * We store previous byte counts and compute bytes/sec delta.
 */

let previousNetSample = null;
let previousSampleTime = null;

/**
 * Reads /proc/net/dev and returns { ifaceName: { rx, tx } } in bytes.
 * Returns null if file is unavailable (non-Linux).
 */
function readProcNetDev() {
  try {
    const raw = fs.readFileSync('/proc/net/dev', 'utf8');
    const lines = raw.trim().split('\n').slice(2); // skip 2 header lines

    const result = {};

    for (const line of lines) {
      // Format: "  eth0:  1234  5  0  0  0  0  0  0  5678  3  0  0  0  0  0  0"
      const parts = line.trim().split(/\s+/);
      const name = parts[0].replace(':', '');
      const rx = parseInt(parts[1], 10); // bytes received
      const tx = parseInt(parts[9], 10); // bytes transmitted

      if (!isNaN(rx) && !isNaN(tx)) {
        result[name] = { rx, tx };
      }
    }

    return result;
  } catch {
    return null; // Not Linux or permission denied
  }
}

/**
 * Returns active (non-internal) interface names and addresses (no MACs).
 */
function getActiveInterfaces() {
  const ifaces = os.networkInterfaces();
  const result = {};

  for (const [name, addresses] of Object.entries(ifaces)) {
    const active = addresses
      .filter((a) => !a.internal)
      .map((a) => ({ family: a.family, address: a.address })); // MAC excluded

    if (active.length > 0) {
      result[name] = active;
    }
  }

  return result;
}

function calculateNetworkUsage() {
  try {
    const now = Date.now();
    const current = readProcNetDev();

    const activeIfaces = getActiveInterfaces();

    if (!current) {
      // macOS / Windows fallback — interface list only, no throughput
      return {
        interfaces: activeIfaces,
        throughput: null,
        note: 'Throughput not available on this platform',
      };
    }

    if (!previousNetSample) {
      previousNetSample = current;
      previousSampleTime = now;
      return { interfaces: activeIfaces, throughput: null };
    }

    const elapsed = (now - previousSampleTime) / 1000; // seconds
    const throughput = {};

    for (const [name, data] of Object.entries(current)) {
      const prev = previousNetSample[name];
      if (!prev) continue;

      const rxDelta = data.rx - prev.rx;
      const txDelta = data.tx - prev.tx;

      // Guard against counter resets (reboot/overflow)
      if (rxDelta < 0 || txDelta < 0) continue;

      throughput[name] = {
        rxKBps: +(rxDelta / elapsed / 1024).toFixed(2),
        txKBps: +(txDelta / elapsed / 1024).toFixed(2),
      };
    }

    previousNetSample = current;
    previousSampleTime = now;

    return { interfaces: activeIfaces, throughput };
  } catch (err) {
    console.error('[network] Failed:', err.message);
    return null;
  }
}

module.exports = { calculateNetworkUsage };
