'use strict';

let activeClients = 0;
let totalClients = 0;

function trackConnection() {
  activeClients++;
  totalClients++;
}

function trackDisconnection() {
  activeClients = Math.max(0, activeClients - 1);
}

function getConnectionStats() {
  return { active: activeClients, total: totalClients };
}

module.exports = { trackConnection, trackDisconnection, getConnectionStats };
