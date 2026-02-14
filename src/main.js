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
    serverProcess = fork(path.join(__dirname, 'server.js'), [currentServerIp], { silent: true });

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
            notes: data.body,
            zipUrl: data.zipball_url // GitHub provides a zipball_url for the release source
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
