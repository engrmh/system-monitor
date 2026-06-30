'use strict';

const process = require('node:process');

let previousCPUUsage = null;
let previousCPUTime = null;

function collectProcessMetrics() {
  try {
    const mem = process.memoryUsage();
    const toMB = (b) => +(b / 1024 ** 2).toFixed(2);

    const now = process.hrtime.bigint();
    const currentCPU = process.cpuUsage();

    let cpuPercent = null;
    if (previousCPUUsage && previousCPUTime) {
      const elapsedNs = Number(now - previousCPUTime);
      const elapsedUs = elapsedNs / 1000;
      const userDelta = currentCPU.user - previousCPUUsage.user;
      const systemDelta = currentCPU.system - previousCPUUsage.system;
      cpuPercent = +(((userDelta + systemDelta) / elapsedUs) * 100).toFixed(2);
    }

    previousCPUUsage = currentCPU;
    previousCPUTime = now;

    return {
      pid: process.pid,
      uptime: +process.uptime().toFixed(1),
      memory: {
        rss: toMB(mem.rss),
        heapTotal: toMB(mem.heapTotal),
        heapUsed: toMB(mem.heapUsed),
        external: toMB(mem.external),
        arrayBuffers: toMB(mem.arrayBuffers),
      },
      cpu: {
        userMs: +(currentCPU.user / 1000).toFixed(2),
        systemMs: +(currentCPU.system / 1000).toFixed(2),
        percent: cpuPercent,
      },
    };
  } catch (err) {
    console.error('[process] Failed:', err.message);
    return null;
  }
}

module.exports = { collectProcessMetrics };
