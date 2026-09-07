import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    publicDir: 'public',
    server: {
      host: '0.0.0.0',
      port: Number(process.env.PORT) || 3001,
      hmr: process.env.DISABLE_HMR === 'true' ? false : { port: 24679 },
      headers: {
        'Content-Security-Policy': "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src * ws: wss: http://gc.kis.v2.scr.kaspersky-labs.com ws://gc.kis.v2.scr.kaspersky-labs.com http://localhost:* https://localhost:* http://127.0.0.1:* ws://127.0.0.1:* http://0.0.0.0:* ws://0.0.0.0:* http://192.168.*:* ws://192.168.*:* http://10.*:* ws://10.*:*; script-src * 'unsafe-inline' 'unsafe-eval' blob:; style-src * 'unsafe-inline' data: blob:; img-src * data: blob:; media-src * data: blob:",
      },
    },
    assetsInclude: ['**/*.task'],
  };
});
