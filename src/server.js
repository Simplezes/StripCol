const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;
const http = require('http');
const path = require('path');
const fs = require('fs');

let sectorsData = {};
try {
  const sectorsPath = path.join(__dirname, 'client', 'assets', 'sectors.json');
  if (fs.existsSync(sectorsPath)) {
    sectorsData = JSON.parse(fs.readFileSync(sectorsPath, 'utf8'));
    console.log('[Server] Loaded sectors.json for RPC categorization');
  }
} catch (err) {
  console.error('[Server] Failed to load sectors.json:', err.message);
}


const app = express();
const SERVER_IP = process.argv[2] || '127.0.0.1';

app.use(cors({
  origin: [`http://${SERVER_IP}:5500`, 'http://localhost:5500', `http://${SERVER_IP}:3000`, 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());


const sessions = new Map();

app.get(['/', '/api'], (req, res) => {
  res.json({
    status: 'online',
    service: 'Gateway Hub',
    version: '1.0.2',
    connections: sessions.size,
    uptime: process.uptime()
  });
});

// Logging System
const logs = [];
const MAX_LOGS = 1000;

const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
};

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 23);
}

function addLog(type, args) {
  const timestamp = getTimestamp();
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');

  logs.push({ timestamp, type, message });
  if (logs.length > MAX_LOGS) logs.shift();
}

console.log = function (...args) { addLog('log', args); originalConsole.log.apply(console, args); };
console.error = function (...args) { addLog('error', args); originalConsole.error.apply(console, args); };
console.warn = function (...args) { addLog('warn', args); originalConsole.warn.apply(console, args); };
console.info = function (...args) { addLog('info', args); originalConsole.info.apply(console, args); };


const server = http.createServer(app);
const wss = new WebSocketServer({ server });

console.log('Gateway Hub starting...');

wss.on('connection', (ws, req) => {
  const headers = req.headers;
  const ip = headers['x-forwarded-for'] || req.socket.remoteAddress || req.connection?.remoteAddress;
  console.log(`[WS] Incoming Connection | IP: ${ip} | Path: ${req.url}`);
  console.log(`[WS] Headers: ${JSON.stringify(headers)}`);

  let currentCode = null;

  ws.on('message', (message) => {
    try {
      const raw = message.toString();
      const msg = JSON.parse(raw);

      if (msg.type === 'register' && msg.code) {
        const code = msg.code.toUpperCase();
        if (currentCode && currentCode !== code) {
          console.log(`Socket switching from ${currentCode} to ${code}`);
          // Clean up old session if this socket was attached to it
          const oldSession = sessions.get(currentCode);
          if (oldSession && oldSession.ws === ws) {
            oldSession.ws = null;
            broadcastToSession(currentCode, { type: 'gateway_status', status: 'plugin_disconnected' });
          }
        }

        currentCode = code;
        const controllerData = {
          callsign: msg.callsign || "",
          name: msg.name || "",
          facility: msg.facility || 0,
          rating: msg.rating || 0,
          positionId: msg.positionId || "",
          frequency: msg.frequency || ""
        };
        const session = sessions.get(currentCode);
        const wasConnected = !!(session && session.ws);

        if (!sessions.has(currentCode)) {
          sessions.set(currentCode, {
            ws,
            clients: new Set(),
            aircraft: new Map(),
            atcList: [],
            controller: controllerData,
            lastSyncTime: 0
          });
        } else {
          session.ws = ws;
          session.controller = controllerData;
        }

        if (!wasConnected) {
          console.log(`Session initiated with code: ${code}`);
          console.log(`Plugin ${currentCode} connected`);
          broadcastToSession(currentCode, {
            type: 'gateway_status',
            status: 'plugin_connected',
            code: currentCode,
            controller: controllerData
          });
        }
        sendRPCUpdate(currentCode);

      }
      else if (msg.type === 'ping') {
        return;
      }
      else if (currentCode && msg.type) {
        console.log(`[WS] Received message type: ${msg.type} for code: ${currentCode}`);
        const session = sessions.get(currentCode);
        if (!session) return;

        if (msg.type === 'aircraft' || msg.type === 'fpupdate') {
          const acData = msg.data || msg;
          if (acData.callsign) session.aircraft.set(acData.callsign, acData);
        } else if (msg.type === 'release') {
          const acData = msg.data || msg;
          if (acData.callsign) session.aircraft.delete(acData.callsign);
        } else if (msg.type === 'atclist') {
          session.atcList = msg.data || msg.atclist || msg.atcList || (Array.isArray(msg) ? msg : []);
        }

        broadcastToSession(currentCode, msg);
        sendRPCUpdate(currentCode);
      }

    } catch (e) {
      console.error('Error parsing WebSocket message:', e.message);
      console.error('Raw message:', message.toString());
    }
  });

  ws.on('close', (code, reason) => {
    const reasonStr = reason ? reason.toString() : 'no reason';
    if (currentCode) {
      console.log(`[WS] Plugin ${currentCode} disconnected (Code: ${code}, Reason: ${reasonStr})`);
      const session = sessions.get(currentCode);
      if (session && session.ws === ws) {
        session.ws = null;
        broadcastToSession(currentCode, { type: 'gateway_status', status: 'plugin_disconnected' });
        sendRPCUpdate(currentCode);
      }
    } else {
      console.log(`[WS] Anonymous plugin disconnected (Code: ${code}, Reason: ${reasonStr})`);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });
});

function sendRPCUpdate(code) {
  const session = sessions.get(code);
  if (!session || !session.controller || !session.controller.callsign) {
    if (process.send) process.send({ type: 'rpc_clear' });
    return;
  }

  const callsign = session.controller.callsign || "";
  const facility = parseInt(session.controller.facility);
  const positionId = session.controller.positionId || "";

  // localIcao detection: handle 4-letter prefixes (SKBO_TWR) or 3-letter (BAQ_TWR)
  let localIcao = "";
  const icaoMatch = callsign.match(/^([A-Z]{3,4})/);
  if (icaoMatch) localIcao = icaoMatch[1].toUpperCase();

  const isAerodrome = [1, 2, 3, 4].includes(facility);
  const sectorInfo = sectorsData[positionId];

  let dep = 0, arr = 0, ovr = 0;

  session.aircraft.forEach(ac => {
    const acDep = (ac.departure || "").toUpperCase();
    const acArr = (ac.arrival || "").toUpperCase();

    let type = "overfly";
    if (isAerodrome) {
      if (acDep === localIcao) type = "departure";
      else if (acArr === localIcao) type = "arrival";
    } else if (sectorInfo && sectorInfo.airports) {
      if (sectorInfo.airports.includes(acDep)) type = "departure";
      else if (sectorInfo.airports.includes(acArr)) type = "arrival";
    }

    if (type === "departure") dep++;
    else if (type === "arrival") arr++;
    else ovr++;
  });

  const facilityMap = {
    1: "FSS",
    2: "DEL",
    3: "GND",
    4: "TWR",
    5: "APP",
    6: "CTR"
  };
  const facilityName = facilityMap[facility] || "ATC";

  if (process.send) {
    process.send({
      type: 'rpc_update',
      data: {
        details: `Controlling ${facilityName} (${callsign})`,
        state: `${dep} Dep / ${arr} Arr / ${ovr} Ovr`,
        callsign: callsign
      }
    });
  }
}

function broadcastToSession(code, message) {
  const session = sessions.get(code);
  if (!session || !session.clients) return;

  const type = message.type;
  // Unwrap data if it was wrapped by plugin
  const data = message.data || message;

  const sseData = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;

  session.clients.forEach((clientInfo, clientRes) => {
    try {
      clientRes.write(sseData);
    } catch (e) {
      session.clients.delete(clientRes);
    }
  });
}



// API Endpoints

// Endpoint to check pairing
app.get('/api/pair/:code', (req, res) => {
  const code = req.params.code?.toUpperCase();
  const session = sessions.get(code);
  if (session && session.ws) {
    res.json({ success: true, message: "Paired" });
  } else {
    res.json({ success: false, message: "Euroscope plugin not found for this code." });
  }
});

app.get('/api/events', (req, res) => {
  const code = req.query.code?.toUpperCase();

  if (!code) {
    res.status(400).send('Missing Link Code');
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!sessions.has(code)) {
    sessions.set(code, { ws: null, clients: new Set(), aircraft: new Map(), atcList: [] });
  }

  const session = sessions.get(code);
  // Track SSE client
  session.clients.add(res);

  // Send initial status (always allowed)
  const status = session.ws ? 'plugin_connected' : 'plugin_disconnected';
  res.write(`event: gateway_status\ndata: ${JSON.stringify({ status, code, controller: session.controller })}\n\n`);

  // Trigger sync if plugin is connected and not synced recently (5s cooldown)
  const now = Date.now();
  if (session.ws && session.ws.readyState === WebSocket.OPEN) {
    if (now - (session.lastSyncTime || 0) > 5000) {
      session.lastSyncTime = now;
      session.ws.send(JSON.stringify({ type: 'sync' }));
    }
  }

  req.on('close', () => {
    session.clients.delete(res);
    res.end();
  });
});

// Getter for assumed aircraft
app.get('/api/assumed', (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: "Missing code" });

  const session = sessions.get(code.toUpperCase());
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(Array.from(session.aircraft.values()));
});

// Getter for ATC list
app.get('/api/ATC-list', (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: "Missing code" });

  const session = sessions.get(code.toUpperCase());
  if (!session) {
    console.warn(`[API] ATC-list requested for non-existent session: ${code}`);
    return res.status(404).json({ error: "Session not found" });
  }

  console.log(`[API] ATC-list requested for ${code}. Returning ${session.atcList.length} items.`);
  res.json(session.atcList);
});

// --- LOGGING ---

app.get('/api/logs.html', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Server Logs - StripCol</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Consolas', 'Monaco', 'Courier New', monospace; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #e0e0e0; padding: 20px; min-height: 100vh; }
    .container { max-width: 1400px; margin: 0 auto; }
    header { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border-radius: 12px; padding: 20px 30px; margin-bottom: 20px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); }
    h1 { font-size: 28px; font-weight: 600; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 8px; }
    .status { display: flex; gap: 20px; font-size: 13px; color: #a0a0a0; }
    .status-item { display: flex; align-items: center; gap: 8px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; animation: pulse 2s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .controls { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border-radius: 12px; padding: 15px 20px; margin-bottom: 20px; border: 1px solid rgba(255, 255, 255, 0.1); display: flex; gap: 15px; align-items: center; flex-wrap: wrap; }
    .btn { padding: 8px 16px; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; font-family: inherit; }
    .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); }
    .btn-secondary { background: rgba(255, 255, 255, 0.1); color: #e0e0e0; border: 1px solid rgba(255, 255, 255, 0.2); }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.15); }
    .filter-group { display: flex; gap: 10px; align-items: center; }
    .checkbox-label { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; user-select: none; }
    input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; }
    .log-container { background: rgba(0, 0, 0, 0.3); border-radius: 12px; padding: 20px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); max-height: calc(100vh - 280px); overflow-y: auto; }
    .log-entry { padding: 10px 15px; margin-bottom: 8px; border-radius: 6px; border-left: 3px solid; font-size: 13px; line-height: 1.6; transition: all 0.2s; animation: slideIn 0.3s ease-out; }
    @keyframes slideIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
    .log-entry:hover { background: rgba(255, 255, 255, 0.05); transform: translateX(5px); }
    .log-entry.log { background: rgba(59, 130, 246, 0.1); border-left-color: #3b82f6; }
    .log-entry.error { background: rgba(239, 68, 68, 0.1); border-left-color: #ef4444; }
    .log-entry.warn { background: rgba(251, 191, 36, 0.1); border-left-color: #fbbf24; }
    .log-entry.info { background: rgba(34, 197, 94, 0.1); border-left-color: #22c55e; }
    .log-timestamp { color: #9ca3af; margin-right: 12px; font-weight: 500; }
    .log-type { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-right: 12px; }
    .log-type.log { background: #3b82f6; color: white; }
    .log-type.error { background: #ef4444; color: white; }
    .log-type.warn { background: #fbbf24; color: #1a1a2e; }
    .log-type.info { background: #22c55e; color: white; }
    .log-message { color: #e0e0e0; word-wrap: break-word; white-space: pre-wrap; }
    .empty-state { text-align: center; padding: 60px 20px; color: #6b7280; }
    .empty-state-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.5; }
    .log-container::-webkit-scrollbar { width: 10px; }
    .log-container::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
    .log-container::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 10px; }
    .log-container::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); border-radius: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🖥️ Server Console Logs</h1>
      <div class="status">
        <div class="status-item"><div class="status-dot"></div><span>Live Monitoring</span></div>
        <div class="status-item"><span>Status: Online</span></div>
        <div class="status-item"><span id="log-count">0 logs</span></div>
        <div class="status-item"><span id="last-update">Never</span></div>
      </div>
    </header>
    <div class="controls">
      <button class="btn btn-primary" onclick="refreshLogs()">🔄 Refresh Now</button>
      <button class="btn btn-secondary" onclick="clearLogs()">🗑️ Clear Logs</button>
      <button class="btn btn-secondary" onclick="toggleAutoRefresh()"><span id="auto-refresh-text">⏸️ Pause Auto-Refresh</span></button>
      <div class="filter-group">
        <span style="color: #9ca3af; font-size: 13px;">Show:</span>
        <label class="checkbox-label"><input type="checkbox" id="filter-log" checked onchange="applyFilters()"><span>Log</span></label>
        <label class="checkbox-label"><input type="checkbox" id="filter-error" checked onchange="applyFilters()"><span>Error</span></label>
        <label class="checkbox-label"><input type="checkbox" id="filter-warn" checked onchange="applyFilters()"><span>Warn</span></label>
        <label class="checkbox-label"><input type="checkbox" id="filter-info" checked onchange="applyFilters()"><span>Info</span></label>
      </div>
    </div>
    <div class="log-container" id="log-container">
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div>No logs yet. Waiting for server activity...</div>
      </div>
    </div>
  </div>
  <script>
    let autoRefresh = true;
    let refreshInterval;
    let allLogs = [];
    async function fetchLogs() {
      try {
        const response = await fetch('/api/logs');
        const data = await response.json();
        allLogs = data.logs;
        renderLogs();
        updateStats();
      } catch (error) { console.error('Failed to fetch logs:', error); }
    }
    function renderLogs() {
      const container = document.getElementById('log-container');
      const filters = { log: document.getElementById('filter-log').checked, error: document.getElementById('filter-error').checked, warn: document.getElementById('filter-warn').checked, info: document.getElementById('filter-info').checked };
      const filteredLogs = allLogs.filter(log => filters[log.type]);
      if (filteredLogs.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div>No logs match filters.</div></div>';
        return;
      }
      container.innerHTML = filteredLogs.map(log => \`
        <div class="log-entry \${log.type}">
          <span class="log-timestamp">\${log.timestamp}</span>
          <span class="log-type \${log.type}">\${log.type}</span>
          <span class="log-message">\${escapeHtml(log.message)}</span>
        </div>
      \`).join('');
      container.scrollTop = container.scrollHeight;
    }
    function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
    function updateStats() { document.getElementById('log-count').textContent = \`\${allLogs.length} logs\`; document.getElementById('last-update').textContent = \`Updated: \${new Date().toLocaleTimeString()}\`; }
    function refreshLogs() { fetchLogs(); }
    function clearLogs() { if (confirm('Clear all logs?')) { fetch('/api/logs/clear', { method: 'POST' }).then(() => fetchLogs()); } }
    function toggleAutoRefresh() { autoRefresh = !autoRefresh; const btn = document.getElementById('auto-refresh-text'); if (autoRefresh) { btn.textContent = '⏸️ Pause Auto-Refresh'; startAutoRefresh(); } else { btn.textContent = '▶️ Resume Auto-Refresh'; stopAutoRefresh(); } }
    function startAutoRefresh() { if (refreshInterval) clearInterval(refreshInterval); refreshInterval = setInterval(fetchLogs, 2000); }
    function stopAutoRefresh() { if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; } }
    function applyFilters() { renderLogs(); }
    fetchLogs(); startAutoRefresh();
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

app.get('/api/logs', (req, res) => res.json({ logs }));
app.post('/api/logs/clear', (req, res) => { logs.length = 0; console.log('Logs cleared'); res.json({ success: true }); });

// --- COMMANDS ---

const commands = [
  'set-final-alt', 'set-cleared-alt', 'set-assigned-heading', 'set-direct-point',
  'set-assigned-mach', 'set-squawk', 'set-departureTime', 'set-assigned-speed',
  'set-sid', 'set-star', 'ATC-transfer', 'accept-handoff', 'refuse-handoff',
  'end-tracking', 'assume-aircraft', 'get-nearby-aircraft'
];

commands.forEach(cmd => {
  app.post(`/api/${cmd}`, (req, res) => {
    const { code, ...payload } = req.body;
    if (!code) return res.status(400).json({ success: false, message: "Missing Link Code" });

    const session = sessions.get(code.toUpperCase());
    if (!session || !session.ws) {
      console.warn(`[API] ${cmd} failed for code ${code}: Plugin not connected`);
      return res.status(412).json({ success: false, message: "Euroscope plugin not connected for this code" });
    }

    if (session.ws.readyState === WebSocket.OPEN) {
      console.log(`[API] ${cmd} for ${payload.callsign || 'unknown'} (Code: ${code})`);
      session.ws.send(JSON.stringify({ type: cmd, ...payload }));
      res.json({ success: true });
    } else {
      res.status(503).json({ success: false, message: "Plugin connection not open" });
    }
  });
});


app.post('/api/:action', (req, res) => {
  const action = req.params.action;
  const { code, ...payload } = req.body;

  if (!code) {
    console.warn(`[API] ${action} failed: Missing Link Code`);
    return res.status(400).json({ success: false, message: "Missing Link Code" });
  }

  const session = sessions.get(code.toUpperCase());
  if (!session || !session.ws) {
    console.warn(`[API] ${action} failed for code ${code}: Plugin not connected`);
    return res.status(412).json({ success: false, message: "Euroscope plugin not connected for this code" });
  }

  console.log(`[API] ${action} for ${payload.callsign || 'unknown'} (Code: ${code})`);

  if (session.ws.readyState === WebSocket.OPEN) {
    const command = JSON.stringify({ type: action, ...payload });
    session.ws.send(command);
    return res.json({ success: true });
  }
  else {
    console.warn(`[API] ${action} failed: Plugin WS not open`);
    res.status(503).json({ success: false, message: "Plugin connection not open" });
  }
});

// Special case for GET point-time since it's used in strips.js
app.get('/api/point-time', (req, res) => {
  const { code, callsign, points } = req.query;
  if (!code) return res.status(400).send('Missing Link Code');

  const session = sessions.get(code.toUpperCase());
  if (!session) return res.json([]);

  // Check if we have aircraft data for this callsign
  const ac = session.aircraft.get(callsign);
  if (ac) {
    // Return ETAs from the cached aircraft data
    // Filter by point name if provided (case-insensitive)
    const pts = points ? points.split(',').map(p => p.toUpperCase()) : [];

    // Search both arrival and departure points
    const allPoints = [
      ...(ac.arrivalPoints || []),
      ...(ac.departurePoints || [])
    ];

    const result = allPoints.filter(p =>
      pts.length === 0 || pts.includes((p.name || "").toUpperCase())
    );
    return res.json(result);
  }

  res.json([]);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, SERVER_IP, () => {
  console.log(`Gateway Hub (V1.0.2) listening on ${SERVER_IP}:${PORT}`);
});
