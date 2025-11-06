export {};

declare global {
  interface Window {
    api: {
      createPty: (cols: number, rows: number) => Promise<{ id: string }>;
      writePty: (id: string, data: string) => void;
      resizePty: (id: string, cols: number, rows: number) => void;
      killPty: (id: string) => void;
      onPtyData: (id: string, cb: (data: string) => void) => () => void;
      onPtyExit: (id: string, cb: () => void) => () => void;
      readDir: (path: string) => Promise<Array<{ name: string; isDirectory: boolean }>>;
      getHomeDir: () => Promise<string>;
    };
  }
}

