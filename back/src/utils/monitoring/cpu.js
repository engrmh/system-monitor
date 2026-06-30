'use strict';

const os = require('node:os');

let previousCPUSample = null;

function takeCPUSample() {
  return os.cpus().map((core) => {
    const times = core.times;
    const total = times.user + times.nice + times.sys + times.idle + times.irq;
    return { idle: times.idle, total };
  });
}

function calculateDelta(prev, curr) {
  return curr.map((core, i) => {
    const deltaTotal = core.total - prev[i].total;
    const deltaIdle = core.idle - prev[i].idle;
    const deltaUsed = deltaTotal - deltaIdle;
    const usagePercent = deltaTotal === 0 ? 0 : (deltaUsed / deltaTotal) * 100;

    return +usagePercent.toFixed(1);
  });
}

function calculateCPUUsage() {
  try {
    const currentSample = takeCPUSample();

    if (!previousCPUSample) {
      previousCPUSample = currentSample;
      return null;
    }

    const perCore = calculateDelta(previousCPUSample, currentSample);
    previousCPUSample = currentSample;

    const total = perCore.reduce((sum, v) => sum + v, 0) / perCore.length;

    return {
      totalPercent: +total.toFixed(1),
      perCore,
    };
  } catch (err) {
    console.error('[cpu] Failed to calculate CPU usage:', err.message);
    return null;
  }
}

module.exports = { calculateCPUUsage };
