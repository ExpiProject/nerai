// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';


contextBridge.exposeInMainWorld('api', {
    createPty: (cols: number, rows: number) => ipcRenderer.invoke('pty:create', { cols, rows }),
    writePty: (id: string, data: string) => ipcRenderer.send('pty:write', { id, data }),
    resizePty: (id: string, cols: number, rows: number) => ipcRenderer.send('pty:resize', { id, cols, rows }),
    killPty: (id: string) => ipcRenderer.send('pty:kill', { id }),
    onPtyData: (id: string, cb: (data: string) => void) => {
        const relay = (_event: any, incomingId: string, payload: string) => {
            if (incomingId === id) cb(payload);
        };
        ipcRenderer.on('pty:data', relay);
        // Return unsubscribe
        return () => ipcRenderer.removeListener('pty:data', relay);
    },
    onPtyExit: (id: string, cb: () => void) => {
        const relay = (_event: any, incomingId: string) => {
            if (incomingId === id) cb();
        };
        ipcRenderer.on('pty:exit', relay);
        return () => ipcRenderer.removeListener('pty:exit', relay);
    },
    readDir: (path: string) => ipcRenderer.invoke('fs:readdir', { path }),
    getHomeDir: () => ipcRenderer.invoke('fs:getHomeDir')
});
