const WebSocket = require('ws');
const { sessions } = require('../state');

const SYNC_COOLDOWN_MS = 5000;

function requestSync(session) {
  const now = Date.now();
  const pluginIsOpen = session.ws && session.ws.readyState === WebSocket.OPEN;

  if (pluginIsOpen && now - (session.lastSyncTime || 0) > SYNC_COOLDOWN_MS) {
    session.lastSyncTime = now;
    session.ws.send(JSON.stringify({ type: 'sync' }));
  }
}

function registerEventRoutes(app) {
  app.get('/api/events', (request, response) => {
    const code = request.query.code?.toUpperCase();
    if (!code) {
      response.status(400).send('Missing Link Code');
      return;
    }

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('Access-Control-Allow-Origin', '*');

    if (!sessions.has(code)) {
      sessions.set(code, { ws: null, clients: new Set(), aircraft: new Map(), atcList: [] });
    }

    const session = sessions.get(code);
    session.clients.add(response);

    const status = session.ws ? 'plugin_connected' : 'plugin_disconnected';
    const payload = { status, code, controller: session.controller };
    response.write(`event: gateway_status\ndata: ${JSON.stringify(payload)}\n\n`);

    requestSync(session);

    request.on('close', () => {
      session.clients.delete(response);
      response.end();
    });
  });
}

module.exports = { registerEventRoutes };
