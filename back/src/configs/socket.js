const { Server } = require('socket.io');
const { getMonitoringData } = require('../controllers/monitoring/monitoring.controller');
const { trackConnection, trackDisconnection } = require('../utils/monitoring/connections');

const MAX_CONNECTIONS = 100;
const BROADCAST_INTERVAL_MS = 1000;

exports.socketIo = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.clientOrigin,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    allowEIO3: true,
    transports: ['websocket', 'polling'],
  });

  let latestData = null;
  let clientCount = 0;

  const broadcastInterval = setInterval(async () => {
    try {
      latestData = await getMonitoringData();
      io.emit('monitoring', latestData);
    } catch (err) {
      console.error('[socket] Broadcast failed:', err.message);
    }
  }, BROADCAST_INTERVAL_MS);

  io.on('connection', (socket) => {
    if (clientCount >= MAX_CONNECTIONS) {
      socket.emit('error', { message: 'Connection limit reached' });
      socket.disconnect(true);
      return;
    }

    clientCount++;
    trackConnection();
    console.log(`Client connected: ${socket.id} (${clientCount} active)`);

    if (latestData) {
      socket.emit('monitoring', latestData);
    }

    socket.on('disconnect', () => {
      clientCount = Math.max(0, clientCount - 1);
      trackDisconnection();
      console.log(`Client disconnected: ${socket.id} (${clientCount} active)`);
    });
  });

  process.on('SIGTERM', () => {
    clearInterval(broadcastInterval);
    io.close();
  });
};
