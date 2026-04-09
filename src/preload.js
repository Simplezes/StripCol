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
    getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
    rendererReady: () => ipcRenderer.send('renderer-ready'),
    openExternal: (url) => ipcRenderer.send('open-external', url),
    listUserThemes: () => ipcRenderer.invoke('list-user-themes'),
    onUpdateAvailable: (callback) => ipcRenderer.once('update-available', (_event, info) => callback(info)),
    onUpdateNotAvailable: (callback) => ipcRenderer.once('update-not-available', (_event, info) => callback(info)),
    onUpdateError: (callback) => ipcRenderer.once('update-error', (_event, message) => callback(message)),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_event, progress) => callback(progress)),
    onUpdateDownloaded: (callback) => ipcRenderer.once('update-downloaded', (_event, info) => callback(info))
});