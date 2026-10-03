import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mattarvon.grodius',
  appName: 'Grodius',
  webDir: 'dist',
  backgroundColor: '#040507',
  android: {
    backgroundColor: '#040507',
    // WebView debugging via chrome://inspect stays on for sideload builds
    webContentsDebuggingEnabled: true,
  },
};
export default config;
