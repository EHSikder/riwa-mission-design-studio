import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { roomHandler } from './server/rooms.mjs';

export default defineConfig({
  // relative paths, so the built game works on any host, including a GitHub Pages sub-folder
  base: './',
  plugins: [
    react(),
    // the rooms for network team play, also while developing
    {
      name: 'underdogs-rooms',
      configureServer(server) { server.middlewares.use(roomHandler); },
      configurePreviewServer(server) { server.middlewares.use(roomHandler); },
    },
  ],
  // three.js makes one large chunk; expected for a game with a 3D view
  build: { chunkSizeWarningLimit: 1600 },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
