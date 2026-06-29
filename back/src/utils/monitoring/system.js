'use strict';

const os = require('node:os');
const process = require('node:process');

/**
 * Collects static system info — run once, cache result.
 * MAC addresses, username, home dir are intentionally excluded.
 */
function getStaticInfo() {
  try {
    const cpus = os.cpus();

    // Only interface names — no IPs, no MACs
    const networkNames = Object.keys(os.networkInterfaces());

    return {
      cpu: {
        model: cpus[0]?.model ?? 'Unknown',
        cores: cpus.length,
        architecture: os.arch(),
        speedMHz: cpus[0]?.speed ?? null,
      },
      os: {
        hostname: os.hostname(),
        platform: os.platform(),
        type: os.type(),
        release: os.release(),
        machine: os.machine?.() ?? os.arch(), // os.machine() is Node 18.9+
        tmpDir: os.tmpdir(),
      },
      memory: {
        totalGB: +(os.totalmem() / 1024 ** 3).toFixed(2),
      },
      network: {
        interfaceNames: networkNames,
      },
      process: {
        pid: process.pid,
        nodeVersion: process.version,
      },
    };
  } catch (err) {
    console.error('[static] Failed to collect static info:', err.message);
    return null;
  }
}

module.exports = { getStaticInfo };
