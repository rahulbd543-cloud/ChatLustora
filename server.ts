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

  // SEO & API Routes
  app.use('/', seoRouter);
  app.use('/api', apiRouter);

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
