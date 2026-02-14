const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const rpc = require('./rpc');

let serverProcess;
let currentServerIp = '127.0.0.1';

function startServer(ip) {
    if (serverProcess) {
        serverProcess.kill();
    }

    currentServerIp = ip || '127.0.0.1';
    serverProcess = fork(path.join(__dirname, 'server.js'), [currentServerIp]);

    serverProcess.on('message', (msg) => {
        if (msg.type === 'rpc_update') {
            rpc.updatePresence(msg.data);
        } else if (msg.type === 'rpc_clear') {
            rpc.updatePresence();
        }
    });

    console.log(`Server started on IP: ${currentServerIp}`);
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
    // Start the API server
    startServer();

    rpc.initRPC();

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

ipcMain.on('restart-server', (event, ip) => {
    if (ip !== currentServerIp) {
        console.log(`Restarting server with new IP: ${ip}`);
        startServer(ip);
    }
});

ipcMain.handle('check-for-updates', async () => {
    try {
        const response = await fetch('https://api.github.com/repos/Simplezes/StripCol/releases/latest');
        if (!response.ok) throw new Error('GitHub API returned ' + response.status);

        const data = await response.json();
        const latestVersion = data.tag_name.replace('v', '');
        const currentVersion = require('../package.json').version;

        return {
            currentVersion,
            latestVersion,
            updateAvailable: latestVersion !== currentVersion,
            url: data.html_url,
            notes: data.body
        };
    } catch (error) {
        console.error('Update check failed:', error);
        return { error: error.message };
    }
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
