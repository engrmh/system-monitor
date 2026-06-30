'use strict';

const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const DEFAULT_LOG_PATHS = {
  linux: [
    '/var/log/syslog',
    '/var/log/auth.log',
    '/var/log/kern.log',
    '/var/log/dmesg',
    '/var/log/boot.log',
    '/var/log/dpkg.log',
    '/var/log/gpu-manager.log',
    '/var/log/Xorg.0.log',
    '/var/log/ufw.log',
  ],
  linux_journal: [
    { unit: 'kernel', priority: 'err', lines: 50 },
    { unit: 'sshd', priority: 'warning', lines: 30 },
    { unit: 'NetworkManager', priority: 'warning', lines: 30 },
    { unit: 'systemd', priority: 'err', lines: 30 },
    { unit: 'gpu-manager', priority: 'warning', lines: 20 },
  ],
  darwin: [
    '/var/log/system.log',
    '/var/log/install.log',
    '/var/log/kernel.log',
    '/var/log/assertions.log',
  ],
  win32_events: [
    { log: 'System', count: 50 },
    { log: 'Application', count: 50 },
    { log: 'Security', count: 30 },
  ],
};

function collectLogs(options = {}) {
  const { customPaths = [], lines = 100, filters = [] } = options;

  try {
    const platform = process.platform;
    const logPaths =
      customPaths.length > 0 ? customPaths : DEFAULT_LOG_PATHS[platform] || [];

    if (logPaths.length === 0) {
      return {
        logs: [],
        message: 'No log paths configured for this platform',
        timestamp: new Date().toISOString(),
      };
    }

    const logs = logPaths.map((filePath) => {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        let logLines = content.split('\n').filter((line) => line.trim());

        if (filters.length > 0) {
          const patterns = filters.map((f) => new RegExp(f, 'i'));
          logLines = logLines.filter((line) =>
            patterns.some((pattern) => pattern.test(line)),
          );
        }

        const recentLines = logLines.slice(-lines);

        return {
          file: filePath,
          lines: recentLines,
          totalLines: logLines.length,
        };
      } catch (err) {
        return {
          file: filePath,
          lines: [],
          error: err.code === 'EACCES' ? 'Permission denied' : err.message,
        };
      }
    });

    return {
      logs,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[collectLogs] Error:', err.message);
    return null;
  }
}

async function collectLogsWithTail(options = {}) {
  const { customPaths = [], lines = 100 } = options;

  if (process.platform === 'win32') {
    return collectWindowsLogs(lines);
  }

  try {
    const platform = process.platform;
    const logPaths =
      customPaths.length > 0 ? customPaths : DEFAULT_LOG_PATHS[platform] || [];

    const logs = await Promise.all(
      logPaths.map(async (filePath) => {
        try {
          const { stdout } = await execFileAsync('tail', [
            '-n',
            String(lines),
            filePath,
          ]);
          const logLines = stdout.split('\n').filter((line) => line.trim());

          let size = null;
          try {
            const stats = await fsPromises.stat(filePath);
            size = (stats.size / 1024).toFixed(2) + ' KB';
          } catch {}

          return {
            file: filePath,
            lines: logLines,
            totalLines: logLines.length,
            ...(size && { size }),
          };
        } catch (err) {
          return {
            file: filePath,
            lines: [],
            error: err.code === 'EACCES' ? 'Permission denied' : err.message,
          };
        }
      }),
    );

    const journal = process.platform === 'linux' ? await collectJournalLogs() : [];

    return {
      logs,
      journal,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[collectLogsWithTail] Error:', err.message);
    return null;
  }
}

async function collectWindowsLogs(lines) {
  const eventLogs = DEFAULT_LOG_PATHS.win32_events;

  try {
    const logs = await Promise.all(
      eventLogs.map(async ({ log, count }) => {
        try {
          const { stdout } = await execFileAsync('wevtutil', [
            'qe', log,
            `/c:${count}`,
            '/f:text',
            '/rd:true',
          ]);

          const entries = stdout.split('\n\n').filter((e) => e.trim());

          return {
            source: `EventLog: ${log}`,
            lines: entries.slice(-count),
            totalLines: entries.length,
          };
        } catch (err) {
          return {
            source: `EventLog: ${log}`,
            lines: [],
            error: err.message,
          };
        }
      }),
    );

    return {
      logs,
      journal: [],
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[collectWindowsLogs] Error:', err.message);
    return null;
  }
}

async function collectJournalLogs() {
  const journalPaths = DEFAULT_LOG_PATHS.linux_journal;
  if (!journalPaths) return [];

  const results = await Promise.all(
    journalPaths.map(async ({ unit, priority, lines }) => {
      try {
        const args = [
          '--no-pager',
          '--quiet',
          '--output=short-iso',
          '-p', priority,
          '-n', String(lines),
          '-u', unit,
          '--since', '1 hour ago',
        ];

        const { stdout } = await execFileAsync('journalctl', args);
        const logLines = stdout.split('\n').filter((l) => l.trim());

        return {
          source: `journalctl -u ${unit}`,
          unit,
          lines: logLines,
          totalLines: logLines.length,
        };
      } catch (err) {
        return {
          source: `journalctl -u ${unit}`,
          unit,
          lines: [],
          error: err.message,
        };
      }
    }),
  );

  return results;
}

module.exports = {
  collectLogs,
  collectLogsWithTail,
  collectJournalLogs,
};
