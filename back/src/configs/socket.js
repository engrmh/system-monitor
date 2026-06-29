const { Server } = require('socket.io');
const {
  getMonitoring,
} = require('../controllers/monitoring/monitoring.controller');

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

  io.on('connection', (socket) => {
    console.log('Socket.io Started');
    // console.log(socket.id);

    const interval = setInterval(() => {
      getMonitoring(socket);
    }, 1000);

    socket.on('get-monitoring', () => {
      getMonitoring(socket);
    });

    socket.on('disconnect', () => {
      console.log('user disconnected');
      clearInterval(interval);
    });
  });
};
