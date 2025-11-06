import os from 'node:os';
import { randomUUID } from 'node:crypto';
import pty, { IPty } from '@lydell/node-pty';
import { BrowserWindow } from 'electron';


const PTYS = new Map<string, IPty>();


function defaultShell() {
    const platform = os.platform();
    if (platform === 'win32') return process.env.COMSPEC || 'C:\\Windows\\System32\\cmd.exe';
    if (process.env.SHELL) return process.env.SHELL;
    return '/bin/bash';
}


export function spawnPty(cols: number, rows: number) {
    const id = randomUUID();
    const shell = defaultShell();


    const p = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols,
        rows,
        cwd: process.env.HOME || process.cwd(),
        env: process.env as Record<string, string>
    });


    PTYS.set(id, p);


// Stream output through Electron's IPC
    p.onData((data) => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
            win.webContents.send('pty:data', id, data);
        }
    });


    p.onExit(() => {
        PTYS.delete(id);
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
            win.webContents.send('pty:exit', id);
        }
    });


    return { id };
}


export function writePty(id: string, data: string) {
    PTYS.get(id)?.write(data);
}


export function resizePty(id: string, cols: number, rows: number) {
    PTYS.get(id)?.resize(cols, rows);
}


export function killPty(id: string) {
    PTYS.get(id)?.kill();
    PTYS.delete(id);
}