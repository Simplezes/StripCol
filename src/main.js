const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');

require('dotenv').config({
  path: process.env.NODE_ENV === 'development'
    ? path.join(__dirname, '..', '.env')
    : path.join(process.resourcesPath, '.env'),
});
const { autoUpdater } = require('electron-updater');
const rpc = require('./rpc');

const net = require('net');

let serverProcess;
let updateInfo = null;
let updateDownloaded = false;
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');
const isDev = process.env.NODE_ENV === 'development';

function getStoredSettings() {
    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
        }
    } catch (e) {
        console.error("Failed to load settings from file:", e);
    }
    return { serverIp: '127.0.0.1', discordRpcEnabled: true };
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

        const serverScript = app.isPackaged
            ? path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'server.bundle.js')
            : path.join(__dirname, 'server.js');

        const logPath = path.join(app.getPath('userData'), 'server.log');
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] Forking server: ${serverScript} (exists: ${fs.existsSync(serverScript)})\n`);

        serverProcess = fork(serverScript, [currentServerIp], {
            env: { ...process.env, NODE_ENV: isDev ? 'development' : 'production' }
        });

        serverProcess.on('message', (msg) => {
            if (msg.type === 'rpc_update' && storedSettings.discordRpcEnabled) {
                rpc.updatePresence(msg.data);
            } else if (msg.type === 'rpc_clear' && storedSettings.discordRpcEnabled) {
                rpc.updatePresence();
            }
        });

        serverProcess.on('error', (err) => {
            fs.appendFileSync(logPath, `[${new Date().toISOString()}] Server process ERROR: ${err.message}\n`);
            console.error('Server process error:', err);
        });

        serverProcess.on('exit', (code, signal) => {
            fs.appendFileSync(logPath, `[${new Date().toISOString()}] Server process exited (code=${code}, signal=${signal})\n`);
            console.log(`Server process exited with code ${code}, signal ${signal}`);
            if (isServerHost) isServerHost = false;
        });

        isServerHost = true;
        console.log(`Server started on IP: ${currentServerIp} (PID: ${serverProcess.pid})`);
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] Server PID: ${serverProcess.pid}\n`);
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
    const prodCSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' ws: http://127.0.0.1:3000; img-src 'self' data:; object-src 'none'";
    const devCSP  = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' ws: wss: http: https:; img-src 'self' data:; object-src 'none'";
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [isDev ? devCSP : prodCSP],
            },
        });
    });

    const win = new BrowserWindow({
        width: 1550,
        height: 840,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'client/img/icon.png')
    });

    if (isDev) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, 'client/dist/index.html'));
    }

}

app.whenReady().then(() => {
    startServer(currentServerIp);

    if (storedSettings.discordRpcEnabled) {
        rpc.initRPC();
    }

    createWindow();

    autoUpdater.checkForUpdatesAndNotify();

    ipcMain.handle('get-version', () => {
        return require('../package.json').version;
    });

    ipcMain.handle('list-user-themes', () => {
        const candidates = isDev
            ? [
                path.join(__dirname, 'client/public/css/styles'),
                path.join(__dirname, 'client/css/styles')
            ]
            : [
                path.join(__dirname, 'client/dist/css/styles'),
                path.join(__dirname, 'client/dist/styles')
            ];
        console.log("IPC: Listing themes from candidates:", candidates);
        try {
            const themesPath = candidates.find(p => fs.existsSync(p));
            if (!themesPath) {
                console.log("IPC: No themes path exists");
                return [];
            }
            const files = fs.readdirSync(themesPath).filter(file => file.endsWith('.css'));
            console.log("IPC: Found theme files:", files, "from", themesPath);
            return files;
        } catch (e) {
            console.error("IPC: Failed to list user themes:", e);
            return [];
        }
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

    ipcMain.handle('get-update-status', () => {
        return { updateInfo, updateDownloaded };
    });

    ipcMain.on('renderer-ready', (event) => {
        if (updateInfo) {
            event.reply('update-available', updateInfo);
            if (updateDownloaded) {
                event.reply('update-downloaded', updateInfo);
            }
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

ipcMain.on('save-settings', (event, settings) => {
    if (settings) {
        const rpcChanged = settings.discordRpcEnabled !== storedSettings.discordRpcEnabled;
        storedSettings = { ...storedSettings, ...settings };
        saveStoredSettings(storedSettings);
        if (rpcChanged) {
            if (storedSettings.discordRpcEnabled) {
                rpc.initRPC();
            } else {
                rpc.clearRPC();
            }
        }
    }
});

autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
    updateInfo = info;
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
    updateDownloaded = true;
    updateInfo = info;
    console.log('Update downloaded');
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('update-downloaded', info);
    });
});

ipcMain.on('restart-server', (event, ip) => {
    console.log(`Forced server restart/refresh requested with IP: ${ip}`);
    currentServerIp = ip;
    storedSettings.serverIp = ip;
    saveStoredSettings(storedSettings);
    startServer(ip);
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
