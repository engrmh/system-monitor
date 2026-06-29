'use strict';

const os = require('node:os');

const { getStaticInfo } = require('../../utils/monitoring/system');
const { calculateCPUUsage } = require('../../utils/monitoring/cpu');
const { collectMemory } = require('../../utils/monitoring/memory');
const { calculateNetworkUsage } = require('../../utils/monitoring/network');
const { collectDiskUsage } = require('../../utils/monitoring/disk');

exports.getMonitoring = async (socket) => {
  const staticInfo = getStaticInfo();

  // Prime the CPU sampler — first call only stores baseline, returns null
  await calculateCPUUsage();

  const mem = collectMemory();
  const cpu = calculateCPUUsage();
  const network = calculateNetworkUsage();
  const disk = await collectDiskUsage();

  const cpus = os.cpus();

  const monitoringData = {
    // --- static ---
    cpuCorsCount: cpus.length,
    cpuModel: cpus[0]?.model ?? 'Unknown',
    arch: staticInfo?.cpu?.architecture,
    hostname: staticInfo?.os?.hostname,
    machine: staticInfo?.os?.machine,
    platform: staticInfo?.os?.platform,
    tmpDir: staticInfo?.os?.tmpDir,
    osType: staticInfo?.os?.type,
    networkData: network?.interfaces ?? null,

    // --- dynamic ---
    totalmem: mem?.system?.totalGB,
    freeMem: mem?.system?.freeGB,
    usedMem: mem?.system?.usedGB,
    percent: mem?.system?.usedPercent,
    uptime: (os.uptime() / 3600).toFixed(2),
    cpuPercent: cpu?.totalPercent ?? null,
    cpuPerCore: cpu?.perCore ?? null,
    disk: disk ?? null,
    throughput: network?.throughput ?? null,
    updateTime: new Date(),
  };

  socket.emit('monitoring', monitoringData);
};
