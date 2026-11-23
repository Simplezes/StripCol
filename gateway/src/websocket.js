const { WebSocketServer } = require('ws');
const { sessions, broadcastToSession } = require('./state');
const { sendRpcUpdate } = require('./discordBridge');

function buildControllerData(message) {
  return {
    callsign: message.callsign || '',
    name: message.name || '',
    facility: message.facility || 0,
    rating: message.rating || 0,
    positionId: message.positionId || '',
    frequency: message.frequency || '',
  };
}

function detachFromPreviousSession(previousCode, socket) {
  const previousSession = sessions.get(previousCode);
  if (previousSession && previousSession.ws === socket) {
    previousSession.ws = null;
    broadcastToSession(previousCode, { type: 'gateway_status', status: 'plugin_disconnected' });
  }
}

function createSession(socket, controller) {
  return {
    ws: socket,
    clients: new Set(),
    aircraft: new Map(),
    atcList: [],
    controller,
    lastSyncTime: 0,
    rpcManualState: null,
    lastActivity: Date.now(),
    sectorData: null,
  };
}

function handleRegister(socket, message, currentCode) {
  const code = message.code.toUpperCase();
  if (currentCode && currentCode !== code) detachFromPreviousSession(currentCode, socket);

  const controller = buildControllerData(message);
  const existingSession = sessions.get(code);
  const wasConnected = Boolean(existingSession && existingSession.ws);
  const previousPositionId = existingSession?.controller?.positionId || '';

  if (existingSession) {
    existingSession.ws = socket;
    existingSession.controller = controller;
    existingSession.lastActivity = Date.now();
  } else {
    sessions.set(code, createSession(socket, controller));
  }

  if (!wasConnected || controller.positionId !== previousPositionId) {
    broadcastToSession(code, { type: 'gateway_status', status: 'plugin_connected', code, controller });
  }
  sendRpcUpdate(code);
  return code;
}

function applySessionUpdate(session, message) {
  const payload = message.data || message;

  if (message.type === 'aircraft' || message.type === 'fpupdate') {
    if (payload.callsign) session.aircraft.set(payload.callsign, payload);
  } else if (message.type === 'release') {
    if (payload.callsign) session.aircraft.delete(payload.callsign);
  } else if (message.type === 'sector-data') {
    session.sectorData = message.data || null;
  } else if (message.type === 'atclist') {
    session.atcList = message.data || message.atclist || message.atcList || (Array.isArray(message) ? message : []);
  }
}

function handleSessionMessage(code, message) {
  const session = sessions.get(code);
  if (!session) return;

  applySessionUpdate(session, message);
  session.lastActivity = Date.now();
  broadcastToSession(code, message);
  sendRpcUpdate(code);
}

function handleClose(socket, code) {
  const session = code && sessions.get(code);
  if (session && session.ws === socket) {
    session.ws = null;
    broadcastToSession(code, { type: 'gateway_status', status: 'plugin_disconnected' });
    sendRpcUpdate(code);
  }
}

function attachWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (socket) => {
    let currentCode = null;

    socket.on('message', (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage.toString());

        if (message.type === 'register' && message.code) {
          currentCode = handleRegister(socket, message, currentCode);
        } else if (message.type === 'ping') {
          return;
        } else if (currentCode && message.type) {
          handleSessionMessage(currentCode, message);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error.message);
      }
    });

    socket.on('close', () => handleClose(socket, currentCode));
    socket.on('error', (error) => console.error('WebSocket error:', error.message));
  });

  return wss;
}

module.exports = { attachWebSocketServer };
