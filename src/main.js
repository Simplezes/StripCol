const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const { autoUpdater } = require('electron-updater');
const rpc = require('./rpc');

const net = require('net');

let serverProcess;
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

function getStoredSettings() {
    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
        }
    } catch (e) {
        console.error("Failed to load settings from file:", e);
    }
    return { serverIp: '127.0.0.1' };
}

function saveStoredSettings(settings) {
    try {
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    } catch (e) {
        console.error("Failed to save settings to file:", e);
    }
}

let storedSettings = getStoredSettings();
let currentServerIp = storedSettings.serverIp;
let isServerHost = false;
let failoverInterval = null;

function checkServerRunning(port, host) {
    return new Promise((resolve) => {
        const client = new net.Socket();
        client.setTimeout(1000);
        client.on('connect', () => {
            client.destroy();
            resolve(true);
        });
        client.on('timeout', () => {
            client.destroy();
            resolve(false);
        });
        client.on('error', () => {
            client.destroy();
            resolve(false);
        });
        client.connect(port, host);
    });
}

async function startServer(ip) {
    const newIp = ip || '127.0.0.1';

    // If we're already the host, don't restart unless IP changed
    if (isServerHost && serverProcess && newIp === currentServerIp) return;

    currentServerIp = newIp;
    const isRunning = await checkServerRunning(3000, currentServerIp);

    if (isRunning) {
        console.log(`Server detected on ${currentServerIp}:3000. Joining as backup.`);
        if (serverProcess) {
            serverProcess.kill();
            serverProcess = null;
        }
        isServerHost = false;
    } else {
        console.log(`No server detected on ${currentServerIp}:3000. Starting local server...`);
        if (serverProcess) {
            serverProcess.kill();
        }

        serverProcess = fork(path.join(__dirname, 'server.js'), [currentServerIp]);

        serverProcess.on('message', (msg) => {
            if (msg.type === 'rpc_update') {
                rpc.updatePresence(msg.data);
            } else if (msg.type === 'rpc_clear') {
                rpc.updatePresence();
            }
        });

        isServerHost = true;
        console.log(`Server started on IP: ${currentServerIp} (PID: ${serverProcess.pid})`);
    }

    startFailoverWatchdog();
}

function startFailoverWatchdog() {
    if (failoverInterval) clearInterval(failoverInterval);

    failoverInterval = setInterval(async () => {
        if (!isServerHost) {
            const isRunning = await checkServerRunning(3000, currentServerIp);
            if (!isRunning) {
                console.log("Active server lost. Attempting failover...");
                startServer(currentServerIp);
            }
        }
    }, 10000);
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'client/images/icon.png')
    });

    win.loadFile(path.join(__dirname, 'client/index.html'));

    // win.webContents.openDevTools();
}

app.whenReady().then(() => {
    startServer(currentServerIp);

    rpc.initRPC();

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

ipcMain.handle('get-version', () => {
    return require('../package.json').version;
});

ipcMain.on('restart-server', (event, ip) => {
    console.log(`Forced server restart/refresh requested with IP: ${ip}`);
    currentServerIp = ip;
    saveStoredSettings({ serverIp: ip });
    startServer(ip);
});

ipcMain.on('save-settings', (event, settings) => {
    if (settings && settings.serverIp) {
        saveStoredSettings(settings);
    }
});

autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('update-available', info);
    });
});

autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available.');
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('update-not-available', info);
    });
});

autoUpdater.on('error', (err) => {
    console.error('Error in auto-updater:', err);
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('update-error', err.message);
    });
});

autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    console.log(log_message);
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('download-progress', progressObj);
    });
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded');
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('update-downloaded', info);
    });
});

ipcMain.handle('check-for-updates', async () => {
    try {
        const result = await autoUpdater.checkForUpdates();
        return { success: true, result };
    } catch (error) {
        console.error('Manual update check failed:', error);
        return { error: error.message };
    }
});

ipcMain.handle('start-update', () => {
    autoUpdater.quitAndInstall();
    return { success: true };
});

ipcMain.on('open-external', (event, url) => {
    require('electron').shell.openExternal(url);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('quit', () => {
    rpc.clearRPC();
    if (serverProcess) {
        serverProcess.kill();
    }
});
