'use strict';

const os = require('node:os');
const process = require('node:process');


function getStaticInfo() {
  try {
    const cpus = os.cpus();

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
        machine: os.machine?.() ?? os.arch(),
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
