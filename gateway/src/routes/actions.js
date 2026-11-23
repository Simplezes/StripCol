const WebSocket = require('ws');
const { sessions } = require('../state');
const { sendRpcUpdate } = require('../discordBridge');

const ALLOWED_ACTIONS = new Set([
  'set-squawk',
  'set-departureTime',
  'set-assigned-mach',
  'set-assigned-speed',
  'set-direct-point',
  'set-final-alt',
  'set-cleared-alt',
  'set-assigned-heading',
  'set-star',
  'set-sid',
  'ATC-transfer',
  'accept-handoff',
  'refuse-handoff',
  'end-tracking',
  'get-nearby-aircraft',
  'assume-aircraft',
]);

function registerActionRoutes(app) {
  app.post('/api/rpc-update', (request, response) => {
    const { code, state } = request.body;
    if (!code) {
      response.status(400).json({ success: false, message: 'Missing Link Code' });
      return;
    }

    const session = sessions.get(code.toUpperCase());
    if (!session) {
      response.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    session.rpcManualState = state;
    sendRpcUpdate(code.toUpperCase());
    response.json({ success: true });
  });

  app.post('/api/:action', (request, response) => {
    const { action } = request.params;
    if (!ALLOWED_ACTIONS.has(action)) {
      response.status(404).json({ success: false, message: 'Unknown action' });
      return;
    }

    const { code, ...payload } = request.body;
    if (!code) {
      response.status(400).json({ success: false, message: 'Missing Link Code' });
      return;
    }

    const session = sessions.get(code.toUpperCase());
    if (!session || !session.ws) {
      response.status(412).json({ success: false, message: 'Euroscope plugin not connected for this code' });
      return;
    }

    session.lastActivity = Date.now();

    if (session.ws.readyState !== WebSocket.OPEN) {
      response.status(503).json({ success: false, message: 'Plugin connection not open' });
      return;
    }

    session.ws.send(JSON.stringify({ type: action, ...payload }));
    response.json({ success: true });
  });
}

module.exports = { registerActionRoutes };
