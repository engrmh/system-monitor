require('dotenv').config();
const app = require('./app');
const { createServer } = require('node:http');
const { socketIo } = require('./configs/socket');
const  connectToDB = require('./configs/db')

const server = createServer(app);
const port = process.env.PORT;

socketIo(server);
connectToDB()

server.listen(port, () => {
  console.log(`Server Started on port: ${port}`);
});
