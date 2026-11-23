const { sessions } = require('../state');
const { version } = require('../../../package.json');

function sendStatus(request, response) {
  response.json({
    status: 'online',
    service: 'Gateway Hub',
    version,
    connections: sessions.size,
    uptime: process.uptime(),
  });
}

function registerStatusRoutes(app) {
  app.get('/', sendStatus);
  app.get('/api', sendStatus);
}

module.exports = { registerStatusRoutes };
