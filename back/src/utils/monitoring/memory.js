'use strict';

const os = require('node:os');
const process = require('node:process');

function collectMemory() {
  try {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;

    const toGB = (bytes) => +(bytes / 1024 ** 3).toFixed(2);
    const toMB = (bytes) => +(bytes / 1024 ** 2).toFixed(2);

    const procMem = process.memoryUsage();

    return {
      system: {
        totalGB: toGB(total),
        freeGB: toGB(free),
        usedGB: toGB(used),
        usedPercent: +((used / total) * 100).toFixed(1),
      },
      process: {
        rss: toMB(procMem.rss),
        heapTotal: toMB(procMem.heapTotal),
        heapUsed: toMB(procMem.heapUsed),
        external: toMB(procMem.external),
      },
    };
  } catch (err) {
    console.error('[memory] Failed to collect memory:', err.message);
    return null;
  }
}

module.exports = { collectMemory };
