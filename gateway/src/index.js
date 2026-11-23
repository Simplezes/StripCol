const http = require('http');
const cors = require('cors');
const express = require('express');
const { version } = require('../../package.json');
const { captureConsole } = require('./logger');
const { attachWebSocketServer } = require('./websocket');
const { startSessionCleanup } = require('./sessionCleanup');
const { registerStatusRoutes } = require('./routes/status');
const { registerEventRoutes } = require('./routes/events');
const { registerLogRoutes } = require('./routes/logs');
const { registerSessionDataRoutes } = require('./routes/sessionData');
const { registerActionRoutes } = require('./routes/actions');

const PORT = process.env.PORT || 3000;
const IS_BOUND_TO_PARENT = process.env.STRIPCOL_PARENT_BOUND === '1';
const SERVER_IP = process.argv[2] || '127.0.0.1';

captureConsole();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

registerStatusRoutes(app);
registerEventRoutes(app);
registerLogRoutes(app);
registerSessionDataRoutes(app);
registerActionRoutes(app);

const httpServer = http.createServer(app);
attachWebSocketServer(httpServer);
startSessionCleanup();

if (IS_BOUND_TO_PARENT) {
  process.stdin.resume();
  process.stdin.on('close', () => process.exit(0));
}

console.log('Gateway Hub starting...');
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Gateway Hub (V${version}) listening on ${SERVER_IP}:${PORT} (bound to 0.0.0.0)`);
});
