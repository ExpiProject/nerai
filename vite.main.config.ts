import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        '@lydell/node-pty',
        '@lydell/node-pty-darwin-arm64',
        '@lydell/node-pty-darwin-x64',
        '@lydell/node-pty-linux-x64',
        '@lydell/node-pty-win32-x64',
      ],
    },
  },
});
