/**
 * ChatLustora Server Entry Point
 * 
 * Express + Socket.IO + Vite Middleware (Dev) / Static Serving (Prod)
 * Port 3000
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import { apiRouter } from './server/routes/api.js';
import { seoRouter } from './server/routes/seo.js';
import { setupSocketServer } from './server/socket.js';
import { setupRoomWebSocket } from './server/roomWs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Middlewares
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Socket.IO real-time server
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  setupSocketServer(io);
  setupRoomWebSocket(server);

  // CHATLUSTORA_LOCAL_MEMBER_AUTH_PROXY
  // Local development only: proxy registered-member auth to the staging Worker.
  // Guest sessions continue using the existing Express API and cookie.
  if (!isProd) {
    const authOrigin = (
      process.env.CHATLUSTORA_AUTH_ORIGIN ||
      'https://chatlustora-staging.rahulbd543.workers.dev'
    ).replace(/\/+$/, '');

    app.use('/api/auth', async (req, res, next) => {
      const route = req.path;
      const hasMemberCookie = Boolean(req.cookies?.session_id);

      const shouldProxy =
        (req.method === 'POST' && (route === '/login' || route === '/register')) ||
        (route === '/me' && hasMemberCookie) ||
        (req.method === 'POST' && route === '/logout' && hasMemberCookie);

      if (!shouldProxy) {
        next();
        return;
      }

      try {
        const headers: Record<string, string> = {
          accept: 'application/json'
        };

        let body: string | undefined;

        if (req.method !== 'GET' && req.method !== 'HEAD') {
          headers['content-type'] = 'application/json';
          body = JSON.stringify(req.body ?? {});
        }

        // Forward only the registered-member session cookie when needed.
        if (hasMemberCookie && (route === '/me' || route === '/logout')) {
          headers.cookie = `session_id=${req.cookies.session_id}`;
        }

        const upstream = await fetch(`${authOrigin}/api/auth${route}`, {
          method: req.method,
          headers,
          body,
          redirect: 'manual'
        });

        const setCookie = upstream.headers.get('set-cookie');
        if (setCookie) {
          res.setHeader('Set-Cookie', setCookie);
        }

        const responseBody = await upstream.text();
        res.status(upstream.status);
        res.setHeader(
          'Content-Type',
          upstream.headers.get('content-type') || 'application/json; charset=utf-8'
        );
        res.send(responseBody);
      } catch {
        // Never log credentials, request bodies, or session cookies.
        res.status(502).json({
          error: 'Member authentication service is temporarily unavailable.'
        });
      }
    });
  }
  // SEO & API Routes
  app.use('/', seoRouter);
  app.use('/api', apiRouter);
  
  app.post('/api/auth/register', (_req, res) => res.json({ success: true }));
  app.post('/api/auth/login', (_req, res) => res.json({ success: true }));

  // Health check
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', brand: 'ChatLustora', time: new Date().toISOString() });
  });

  if (!isProd) {
    // Vite Dev Server middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[ChatLustora] Platform server listening on port ${PORT} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
  });
}

startServer().catch(err => {
  console.error('[ChatLustora] Failed to start server:', err);
  process.exit(1);
});
