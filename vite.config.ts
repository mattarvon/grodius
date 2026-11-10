import { defineConfig } from 'vite';
import { booth } from './tools/booth/plugin.ts';
export default defineConfig({
  base: './',
  build: { target: 'es2022', assetsInlineLimit: 0 },
  // the voice booth (tools/booth/README.md): apply 'serve', so it is never in a build
  plugins: [booth()],
  server: {
    // `npm run dev` passes --host, so the dev server answers the LAN and the tailnet: never serve the raw voice takes
    // (outtakes included) kept in assets-raw/. Setting deny replaces Vite's defaults, so they are repeated here
    fs: { deny: ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**', '**/assets-raw/**'] },
    // the booth writes raw takes and temp files there; nothing in the game imports it
    watch: { ignored: ['**/assets-raw/**'] },
  },
});
