import { defineConfig } from 'vite';
import { booth } from './tools/booth/plugin.ts';
export default defineConfig({
  base: './',
  build: { target: 'es2022', assetsInlineLimit: 0 },
  // the voice booth (tools/booth/README.md): apply 'serve', so it is never in a build
  plugins: [booth()],
});
