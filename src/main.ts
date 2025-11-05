import {app, BrowserWindow, ipcMain, shell} from 'electron';
import path from 'node:path';
import {spawnPty, resizePty, writePty, killPty} from './pty';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
    app.quit();
}

let win: BrowserWindow | null = null;

const createWindow = () => {
    // Create the browser window.
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 600,
        minHeight: 400,
        titleBarStyle: 'hiddenInset',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        },
    });

    // and load the index.html of the app.
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
        win.loadFile(
            path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
        );
    }

    // Open the DevTools.
    win.webContents.openDevTools();
    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// IPC — PTY lifecycle
ipcMain.handle('pty:create', (_evt, { cols, rows }: { cols: number; rows: number }) => {
    return spawnPty(cols, rows);
});


ipcMain.on('pty:write', (_evt, { id, data }: { id: string; data: string }) => {
    writePty(id, data);
});


ipcMain.on('pty:resize', (_evt, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
    resizePty(id, cols, rows);
});


ipcMain.on('pty:kill', (_evt, { id }: { id: string }) => {
    killPty(id);
});