'use strict';

const os = require('node:os');
const fs = require('node:fs/promises');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

let previousNetSample = null;
let previousSampleTime = null;

async function readNetBytesLinux() {
  try {
    const raw = await fs.readFile('/proc/net/dev', 'utf8');
    const lines = raw.trim().split('\n').slice(2);
    const result = {};

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const name = parts[0].replace(':', '');
      const rx = parseInt(parts[1], 10);
      const tx = parseInt(parts[9], 10);
      if (!isNaN(rx) && !isNaN(tx)) {
        result[name] = { rx, tx };
      }
    }
    return result;
  } catch {
    return null;
  }
}

async function readNetBytesDarwin() {
  try {
    const { stdout } = await execFileAsync('netstat', ['-ib']);
    const lines = stdout.trim().split('\n');
    const header = lines[0];
    const result = {};

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length < 10) continue;

      const name = parts[0];
      const iface = os.networkInterfaces()[name];
      if (!iface || iface.some((a) => a.internal)) continue;

      const ibyteIdx = header.indexOf('Ibytes');
      const obyteIdx = header.indexOf('Obytes');
      if (ibyteIdx === -1 || obyteIdx === -1) continue;

      const ibyteCol = header.slice(0, ibyteIdx).split(/\s+/).length - 1;
      const obyteCol = header.slice(0, obyteIdx).split(/\s+/).length - 1;

      const rx = parseInt(parts[ibyteCol], 10);
      const tx = parseInt(parts[obyteCol], 10);
      if (!isNaN(rx) && !isNaN(tx)) {
        if (!result[name]) result[name] = { rx: 0, tx: 0 };
        result[name].rx += rx;
        result[name].tx += tx;
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

async function readNetBytesWin32() {
  try {
    const { stdout } = await execFileAsync('powershell', [
      '-NoProfile', '-Command',
      'Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | Select-Object Name,ReceivedBytes,SentBytes | ConvertTo-Json',
    ]);
    const adapters = JSON.parse(stdout);
    const list = Array.isArray(adapters) ? adapters : [adapters];
    const result = {};

    for (const a of list) {
      if (a.Name && a.ReceivedBytes != null) {
        result[a.Name] = { rx: a.ReceivedBytes, tx: a.SentBytes };
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

async function readNetBytes() {
  switch (process.platform) {
    case 'linux': return readNetBytesLinux();
    case 'darwin': return readNetBytesDarwin();
    case 'win32': return readNetBytesWin32();
    default: return null;
  }
}

function getActiveInterfaces() {
  const ifaces = os.networkInterfaces();
  const result = {};

  for (const [name, addresses] of Object.entries(ifaces)) {
    const active = addresses
      .filter((a) => !a.internal)
      .map((a) => ({ family: a.family, address: a.address }));

    if (active.length > 0) {
      result[name] = active;
    }
  }

  return result;
}

async function calculateNetworkUsage() {
  try {
    const now = Date.now();
    const current = await readNetBytes();
    const activeIfaces = getActiveInterfaces();

    if (!current) {
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

    const elapsed = (now - previousSampleTime) / 1000;
    const throughput = {};

    for (const [name, data] of Object.entries(current)) {
      const prev = previousNetSample[name];
      if (!prev) continue;

      const rxDelta = data.rx - prev.rx;
      const txDelta = data.tx - prev.tx;

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
