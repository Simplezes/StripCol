const { contextBridge, ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
    console.log('Electron environment ready');
});

contextBridge.exposeInMainWorld('electronAPI', {
    restartServer: (ip) => ipcRenderer.send('restart-server', ip),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    startUpdate: (zipUrl) => ipcRenderer.invoke('start-update', zipUrl),
    openExternal: (url) => ipcRenderer.send('open-external', url)
});
