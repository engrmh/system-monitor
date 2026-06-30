'use strict';

const os = require('node:os');

const { getStaticInfo } = require('../../utils/monitoring/system');
const { calculateCPUUsage } = require('../../utils/monitoring/cpu');
const { collectMemory } = require('../../utils/monitoring/memory');
const { calculateNetworkUsage } = require('../../utils/monitoring/network');
const { collectDiskUsage } = require('../../utils/monitoring/disk');
const { collectLogsWithTail } = require('../../utils/monitoring/logs');
const { collectProcessMetrics } = require('../../utils/monitoring/process');
const { getEventLoopLag } = require('../../utils/monitoring/eventLoop');
const { getConnectionStats } = require('../../utils/monitoring/connections');
const { collectGpuMetrics } = require('../../utils/monitoring/gpu');

async function getMonitoringData() {
  const staticInfo = getStaticInfo();

  const mem = collectMemory();
  const cpu = calculateCPUUsage();
  const network = await calculateNetworkUsage();
  const disk = await collectDiskUsage();
  const logs = await collectLogsWithTail({
    lines: 50,
    customPaths: ['/var/log/nginx/access.log', '/var/log/app.log'],
  });

  const processMetrics = collectProcessMetrics();
  const eventLoop = getEventLoopLag();
  const connections = getConnectionStats();
  const gpu = await collectGpuMetrics();

  return {
    cpuCoresCount: staticInfo?.cpu?.cores ?? os.cpus().length,
    cpuModel: staticInfo?.cpu?.model ?? 'Unknown',
    arch: staticInfo?.cpu?.architecture,
    hostname: staticInfo?.os?.hostname,
    machine: staticInfo?.os?.machine,
    platform: staticInfo?.os?.platform,
    tmpDir: staticInfo?.os?.tmpDir,
    osType: staticInfo?.os?.type,
    networkData: network?.interfaces ?? null,
    totalmem: Math.ceil(mem?.system?.totalGB),
    freeMem: mem?.system?.freeGB,
    usedMem: mem?.system?.usedGB,
    percent: mem?.system?.usedPercent,
    uptime: (os.uptime() / 3600).toFixed(2),
    cpuPercent: cpu?.totalPercent ?? null,
    cpuPerCore: cpu?.perCore ?? null,
    disk: disk ?? null,
    throughput: network?.throughput ?? null,
    logs: logs ?? null,
    updateTime: new Date(),
    process: processMetrics,
    eventLoop,
    connections,
    gpu,
  };
}

exports.getMonitoringData = getMonitoringData;

exports.getMonitoring = async (socket) => {
  try {
    const data = await getMonitoringData();
    socket.emit('monitoring', data);
  } catch (err) {
    console.error('[monitoring] Failed:', err.message);
  }
};
