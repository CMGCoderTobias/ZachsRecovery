contextBridge.exposeInMainWorld('api', {
    send: (channel, data) => ipcRenderer.send(channel, data),
    receive: (channel, func) => {
        ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
});

contextBridge.exposeInMainWorld('pluginManager', {
    installPlugin: (zipFilePath) => ipcRenderer.send('upload-plugin', zipFilePath),
    activatePlugin: (pluginName) => ipcRenderer.send('activate-plugin', pluginName),
    deactivatePlugin: (pluginName) => ipcRenderer.send('deactivate-plugin', pluginName),
    deletePlugin: (pluginName) => ipcRenderer.send('delete-plugin', pluginName),
    checkPluginExists: (pluginName) => ipcRenderer.invoke('check-plugin-exists', pluginName),
});