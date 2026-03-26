import { defineConfig } from 'vite';

export default defineConfig({
  base: '/rubiks-cube/',
  optimizeDeps: {
    include: ['three', 'three/examples/jsm/controls/OrbitControls.js'],
  },
  test: {
    environment: 'node',
  },
});
