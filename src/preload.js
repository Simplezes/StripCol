const { contextBridge, ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
    console.log('Electron environment ready');
});
contextBridge.exposeInMainWorld('electronAPI', {
    getVersion: () => ipcRenderer.invoke('get-version'),
    restartServer: (ip) => ipcRenderer.send('restart-server', ip),
    saveSettings: (settings) => ipcRenderer.send('save-settings', settings),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    startUpdate: () => ipcRenderer.invoke('start-update'),
    openExternal: (url) => ipcRenderer.send('open-external', url),
    listUserThemes: () => ipcRenderer.invoke('list-user-themes'),
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, info) => callback(info)),
    onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', (event, info) => callback(info)),
    onUpdateError: (callback) => ipcRenderer.on('update-error', (event, message) => callback(message)),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, progress) => callback(progress)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, info) => callback(info))
});