const RPC = require('discord-rpc');
const clientId = '1471575709893005445';

let rpc = null;
let startTimestamp = null;
let lastUpdateData = null;
let lastUpdateTime = 0;
const THROTTLE_INTERVAL = 15000; // 15 seconds

function initRPC() {
    if (rpc) return;

    rpc = new RPC.Client({ transport: 'ipc' });

    rpc.on('ready', () => {
        console.log('[RPC] Discord RPC connected');
        updatePresence();
    });

    rpc.login({ clientId }).catch(err => {
        console.error('[RPC] Failed to connect to Discord:', err.message);
        rpc = null;
    });
}

function updatePresence(data = {}) {
    if (!rpc) return;

    const now = Date.now();
    const { details = 'Awaiting Connection', state = 'Ready for traffic', callsign = null } = data;

    const isSameData = lastUpdateData && lastUpdateData.details === details && lastUpdateData.state === state;
    if (isSameData || (now - lastUpdateTime < THROTTLE_INTERVAL)) {
        return;
    }

    lastUpdateData = { details, state };
    lastUpdateTime = now;

    if (callsign && !startTimestamp) {
        startTimestamp = new Date();
    } else if (!callsign) {
        startTimestamp = null;
    }

    rpc.setActivity({
        details,
        state,
        startTimestamp,
        largeImageKey: 'icon',
        largeImageText: 'StripCol',
        instance: false,
    }).catch(err => {
        console.error('[RPC] Failed to set activity:', err.message);
    });
}

function clearRPC() {
    if (rpc) {
        rpc.clearActivity();
        rpc.destroy();
        rpc = null;
        startTimestamp = null;
    }
}

module.exports = {
    initRPC,
    updatePresence,
    clearRPC
};
