const { logs } = require('../logger');
const logsPage = require('./logsPage');

const LOOPBACK_ADDRESSES = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

function requireLocalhost(request, response, next) {
  if (LOOPBACK_ADDRESSES.includes(request.socket.remoteAddress)) {
    next();
    return;
  }
  response.status(403).json({ error: 'Forbidden' });
}

function registerLogRoutes(app) {
  app.get('/api/logs.html', requireLocalhost, (request, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.send(logsPage);
  });

  app.get('/api/logs', requireLocalhost, (request, response) => response.json({ logs }));

  app.post('/api/logs/clear', requireLocalhost, (request, response) => {
    logs.length = 0;
    response.json({ success: true });
  });
}

module.exports = { registerLogRoutes };
