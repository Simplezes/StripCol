module.exports = `<!DOCTYPE html>
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
