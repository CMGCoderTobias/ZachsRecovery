const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const pluginManager = require('./pluginManager');

// Function to get the correct directory path based on whether the app is packaged or not
const getAppPath = () => {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'app.asar'); // Path inside packaged app
    } else {
        return path.join(__dirname, '..', '..'); // Go from app/core to project root
    }
};


// Declare the window variable
let mainWindow;

// Function to create the main window
function createWindow() {
    // Create a new browser window
    mainWindow = new BrowserWindow({
        width: 800, // Window width
        height: 600, // Window height
        webPreferences: {
            preload: path.join(getAppPath(), 'public/preload.js'), // Preload script
            contextIsolation: true,
            nodeIntegration: false, // Allow node.js features in the renderer
        },
    });

    // Load the HTML file for the renderer
    mainWindow.loadURL(path.join(getAppPath(), 'app/core/index.html'));

    // Open DevTools for debugging (optional, can be removed later)
    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools(); // Only open DevTools in dev mode
    }

    // Handle when the window is closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}


ipcMain.handle('get-file-path', (event, fileName) => {
    return getFilePath(fileName);
});

ipcMain.on('upload-plugin', (event, zipFilePath) => {
    console.log(`Received plugin upload request: ${zipFilePath}`);
    pluginManager.installPlugin(zipFilePath);
});

ipcMain.on('activate-plugin', (event, pluginName) => {
    console.log(`Received plugin activation request: ${pluginName}`);
    pluginManager.activatePlugin(pluginName);
});

ipcMain.on('deactivate-plugin', (event, pluginName) => {
    console.log(`Received plugin deactivation request: ${pluginName}`);
    pluginManager.deactivatePlugin(pluginName);
});

ipcMain.on('delete-plugin', (event, pluginName) => {
    console.log(`Received plugin deletion request: ${pluginName}`);
    pluginManager.deletePlugin(pluginName);
});

ipcMain.handle('check-plugin-exists', (event, pluginName) => {
    const exists = pluginManager.isPluginMetadataExists(pluginName);
    return exists;
});

// When the Electron app is ready, create the window
app.whenReady().then(createWindow);

// Quit the app when all windows are closed (on macOS, the app stays open until explicitly quit)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// On macOS, re-create the window when the app is clicked in the dock
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Handle IPC events (you can add more as needed)
ipcMain.on('some-event', (event, arg) => {
    console.log(arg); // This is where you’ll handle any messages from the renderer
});

