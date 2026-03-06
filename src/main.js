const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
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
    // Start the API server manager with the stored IP
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

ipcMain.handle('check-for-updates', async () => {
    try {
        const response = await fetch('https://api.github.com/repos/Simplezes/StripCol/releases');
        if (!response.ok) throw new Error('GitHub API returned ' + response.status);

        const releases = await response.json();
        if (!Array.isArray(releases) || releases.length === 0) {
            throw new Error('No releases found');
        }

        // Helper to parse version string into comparable array of numbers [major, minor, patch]
        const parseVersion = (v) => v.replace(/^v/, '').split('.').map(Number);

        // Sort releases by version descending
        const sortedReleases = releases.sort((a, b) => {
            const vA = parseVersion(a.tag_name);
            const vB = parseVersion(b.tag_name);
            for (let i = 0; i < Math.max(vA.length, vB.length); i++) {
                const numA = vA[i] || 0;
                const numB = vB[i] || 0;
                if (numA > numB) return -1;
                if (numA < numB) return 1;
            }
            return 0;
        });

        const latestRelease = sortedReleases[0];
        const latestVersion = latestRelease.tag_name.replace(/^v/, '');
        const currentVersion = require('../package.json').version;

        // Custom version comparison to ensure we only update if latest > current
        const isUpdateAvailable = (latest, current) => {
            const l = parseVersion(latest);
            const c = parseVersion(current);
            for (let i = 0; i < Math.max(l.length, c.length); i++) {
                const numL = l[i] || 0;
                const numC = c[i] || 0;
                if (numL > numC) return true;
                if (numL < numC) return false;
            }
            return false;
        };

        return {
            currentVersion,
            latestVersion,
            updateAvailable: isUpdateAvailable(latestVersion, currentVersion),
            url: latestRelease.html_url,
            notes: latestRelease.body,
            zipUrl: latestRelease.zipball_url
        };
    } catch (error) {
        console.error('Update check failed:', error);
        return { error: error.message };
    }
});

ipcMain.handle('start-update', async (event, zipUrl) => {
    const fs = require('fs');
    const https = require('https');
    const os = require('os');
    const { exec } = require('child_process');

    const tempZip = path.join(os.tmpdir(), 'stripcol-update.zip');
    const tempExtract = path.join(os.tmpdir(), 'stripcol-update-extracted');
    const appPath = app.getAppPath();

    try {
        // 1. Download ZIP
        console.log("Downloading update from:", zipUrl);
        const download = (url, dest) => {
            return new Promise((resolve, reject) => {
                const file = fs.createWriteStream(dest);
                const request = https.get(url, { headers: { 'User-Agent': 'StripCol-Updater' } }, (response) => {
                    if (response.statusCode === 302 || response.statusCode === 301) {
                        download(response.headers.location, dest).then(resolve).catch(reject);
                        return;
                    }
                    if (response.statusCode !== 200) {
                        reject(new Error(`Failed to download: ${response.statusCode}`));
                        return;
                    }
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                }).on('error', (err) => {
                    fs.unlink(dest, () => { });
                    reject(err);
                });
            });
        };

        await download(zipUrl, tempZip);
        console.log("Download complete.");

        const stats = fs.statSync(tempZip);
        console.log(`ZIP downloaded. Size: ${stats.size} bytes`);

        // 2. Extract
        if (fs.existsSync(tempExtract)) fs.rmSync(tempExtract, { recursive: true, force: true });
        fs.mkdirSync(tempExtract);

        console.log("Extracting ZIP to:", tempExtract);
        await new Promise((resolve, reject) => {
            // Try 'tar' first (available on Win10 1803+), fallback to PowerShell
            const cmd = `tar -xf "${tempZip}" -C "${tempExtract}"`;
            console.log("Running extraction command:", cmd);
            exec(cmd, (err, stdout, stderr) => {
                if (err) {
                    console.log("Tar failed, trying PowerShell Expand-Archive...");
                    const psCmd = `powershell -Command "Expand-Archive -Path '${tempZip}' -DestinationPath '${tempExtract}' -Force"`;
                    exec(psCmd, (psErr, psStdout, psStderr) => {
                        if (psErr) {
                            console.error("PowerShell extraction failed:", psStderr);
                            reject(new Error(`Extraction failed: ${psStderr || psErr.message}`));
                        } else {
                            resolve();
                        }
                    });
                } else {
                    resolve();
                }
            });
        });

        // 3. Find the inner folder (GitHub zips have a top-level dir)
        const entries = fs.readdirSync(tempExtract);
        console.log("Extracted entries:", entries);

        const innerFolders = entries.filter(f => fs.statSync(path.join(tempExtract, f)).isDirectory());
        if (innerFolders.length === 0) {
            // If no folder, maybe it extracted files directly? 
            // But GitHub zipball always has a root folder.
            throw new Error(`No folders found in extracted ZIP. Entries: ${entries.join(', ')}`);
        }
        const innerPath = path.join(tempExtract, innerFolders[0]);
        console.log("Inner extraction path:", innerPath);

        // 4. Create Updater Script
        const updaterBat = path.join(os.tmpdir(), 'stripcol-install.bat');
        const appDir = path.dirname(appPath); // In dev, this is project root. In build, it's resources/app

        // If we are in dev, appPath is the root. If built, appPath is .../resources/app
        const targetDir = appPath;

        const batContent = `
@echo off
setlocal
echo Finalizing update...
timeout /t 2 /nobreak > nul

:retry
taskkill /f /im "StripCol.exe" > nul 2>&1
taskkill /f /im "stripcol.exe" > nul 2>&1
timeout /t 1 /nobreak > nul

xcopy "${innerPath}\\*" "${targetDir}" /s /e /y /h /i
if errorlevel 1 (
    echo Error during copy. Retrying...
    timeout /t 2 /nobreak
    goto retry
)

echo Update successful!
start "" "${process.execPath}"
echo Closing...
(goto) 2>nul & del "%~f0" & exit
`;
        fs.writeFileSync(updaterBat, batContent);

        // 5. Execute and Quit
        console.log("Launching updater script:", updaterBat);
        const { spawn } = require('child_process');
        const child = spawn('cmd.exe', ['/c', updaterBat], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
        });
        child.unref();

        app.quit();

        return { success: true };
    } catch (error) {
        console.error("Update failed:", error);
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
