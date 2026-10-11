import { defineConfig } from 'vite';
export default defineConfig(({ mode }) => ({
  base: './',
  build: { target: 'es2022', assetsInlineLimit: 0 },
  plugins: mode === 'share' ? [{
    // share edition: drop the orphaned bossreward ("keyster easter") clip Vite still emits from the dead glob branch
    name: 'share-strip-bossreward',
    generateBundle(_, bundle) {
      for (const k of Object.keys(bundle)) if (/keyster-easter/i.test(k)) delete bundle[k];
    },
  }] : [],
}));
