'use strict';

const process = require('node:process');

const SAMPLE_INTERVAL_MS = 500;
let currentLagMs = null;

function startEventLoopMonitor() {
  function measure() {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const delta = Number(process.hrtime.bigint() - start) / 1e6;
      currentLagMs = +delta.toFixed(3);
      setTimeout(measure, SAMPLE_INTERVAL_MS).unref();
    });
  }
  measure();
}

function getEventLoopLag() {
  return { lagMs: currentLagMs };
}

module.exports = { startEventLoopMonitor, getEventLoopLag };
