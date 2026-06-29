'use strict';

const os = require('node:os');

/**
 * CPU usage is calculated by comparing two snapshots of os.cpus() tick counters.
 *
 * Each CPU core reports time spent in these states (in ms):
 *   user   — time running user-space code
 *   nice   — time running low-priority user code
 *   sys    — time running kernel code
 *   idle   — time doing nothing
 *   irq    — time handling hardware interrupts
 *
 * Total ticks = user + nice + sys + idle + irq
 * Used ticks  = Total - idle
 *
 * Usage % = (ΔUsed / ΔTotal) * 100
 *
 * A single snapshot is meaningless — we need delta between two points in time.
 */

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

    // Guard against division by zero on first tick or stalled cores
    const usagePercent = deltaTotal === 0 ? 0 : (deltaUsed / deltaTotal) * 100;

    return +usagePercent.toFixed(1);
  });
}

/**
 * Call this every interval.
 * Returns null on first call (no previous sample to diff against).
 */
function calculateCPUUsage() {
  try {
    const currentSample = takeCPUSample();

    if (!previousCPUSample) {
      previousCPUSample = currentSample;
      return null; // Not enough data yet
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
