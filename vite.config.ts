import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { prerenderLanding } from './scripts/prerenderLanding';

/* `/gift/<code>` is rewritten to the static gift page by vercel.json in
   production; the dev and preview servers get the same rewrite here. */
const giftRewrite = (): Plugin => {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    if (req.url && /^\/gift\/[^/?#.]+\/?(\?.*)?$/.test(req.url)) req.url = '/gift/index.html';
    next();
  };
  return {
    name: 'gift-rewrite',
    configureServer(server) { server.middlewares.use(rewrite); },
    configurePreviewServer(server) { server.middlewares.use(rewrite); },
  };
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [giftRewrite(), react(), prerenderLanding()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
