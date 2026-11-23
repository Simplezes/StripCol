const MAX_LOGS = 1000;
const logs = [];

const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
};

function getTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 23);
}

function formatArgument(argument) {
  return typeof argument === 'object' ? JSON.stringify(argument, null, 2) : String(argument);
}

function addLog(type, args) {
  logs.push({ timestamp: getTimestamp(), type, message: args.map(formatArgument).join(' ') });
  if (logs.length > MAX_LOGS) logs.shift();
}

function captureConsole() {
  for (const type of Object.keys(originalConsole)) {
    console[type] = (...args) => {
      addLog(type, args);
      originalConsole[type].apply(console, args);
    };
  }
}

module.exports = { logs, captureConsole };
