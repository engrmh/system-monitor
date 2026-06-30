const express = require('express');
const cors = require('cors');
const { startEventLoopMonitor } = require('./utils/monitoring/eventLoop');

const app = express()


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}))

startEventLoopMonitor();

module.exports = app