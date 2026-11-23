const { sessions } = require('./state');

const SESSION_TTL_MS = 1000 * 60 * 60 * 2;
const CLEANUP_INTERVAL_MS = 1000 * 60 * 10;

function startSessionCleanup() {
  setInterval(() => {
    const now = Date.now();
    for (const [code, session] of sessions.entries()) {
      if (now - session.lastActivity > SESSION_TTL_MS) {
        console.log(`[Server] Cleaning up inactive session: ${code}`);
        if (session.ws) session.ws.close();
        sessions.delete(code);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

module.exports = { startSessionCleanup };
