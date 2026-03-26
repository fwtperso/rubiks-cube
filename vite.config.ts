import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    include: ['three', 'three/examples/jsm/controls/OrbitControls.js'],
  },
  test: {
    environment: 'node',
  },
});
