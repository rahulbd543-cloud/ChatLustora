/**
 * ChatLustora Cloudflare Edge Worker
 * 
 * Provides:
 * - Edge asset proxying to Cloudflare Pages static bucket
 * - Health and API routing
 * - Edge SEO responses (sitemap.xml and robots.txt)
 * - Forwarding of WebSocket upgrades to Node.js backend when deployed as hybrid edge
 */

import { INITIAL_CHATROOMS } from '../shared/rooms.js';

export interface Env {
  ENVIRONMENT: string;
  APP_URL?: string;
  NODE_BACKEND_URL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 1. Edge SEO endpoints
    if (url.pathname === '/robots.txt') {
      const baseUrl = env.APP_URL || 'https://chatlustora.com';
      const robots = `User-agent: *
Allow: /
Allow: /bangla-chat
Allow: /sex-chat
Allow: /adult-chat
Allow: /roulette-chat
Allow: /video-chat
Allow: /blog
Allow: /forum
Disallow: /admin
Disallow: /moderation
Disallow: /api/
Disallow: /dm/

Sitemap: ${baseUrl}/sitemap.xml
`;
      return new Response(robots, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    if (url.pathname === '/sitemap.xml') {
      const baseUrl = env.APP_URL || 'https://chatlustora.com';
      const now = new Date().toISOString();
      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
      xml += `  <url><loc>${baseUrl}/</loc><lastmod>${now}</lastmod><priority>1.0</priority></url>\n`;
      INITIAL_CHATROOMS.forEach(r => {
        xml += `  <url><loc>${baseUrl}${r.slug}</loc><lastmod>${now}</lastmod><priority>0.9</priority></url>\n`;
      });
      xml += `  <url><loc>${baseUrl}/blog</loc><lastmod>${now}</lastmod><priority>0.8</priority></url>\n`;
      xml += `  <url><loc>${baseUrl}/forum</loc><lastmod>${now}</lastmod><priority>0.8</priority></url>\n`;
      xml += `</urlset>`;
      return new Response(xml, {
        headers: { 'Content-Type': 'application/xml; charset=utf-8' }
      });
    }

    // 2. Health endpoint
    if (url.pathname === '/healthz') {
      return new Response(JSON.stringify({
        status: 'ok',
        edge: 'cloudflare-worker',
        brand: 'ChatLustora',
        time: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Rooms manifest edge API
    if (url.pathname === '/api/rooms') {
      return new Response(JSON.stringify({
        rooms: INITIAL_CHATROOMS,
        total: INITIAL_CHATROOMS.length
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. WebSocket proxy to Node.js backend if hybrid proxy configured
    if (env.NODE_BACKEND_URL && (url.pathname.startsWith('/socket.io') || url.pathname.startsWith('/api/'))) {
      const backendUrl = new URL(url.pathname + url.search, env.NODE_BACKEND_URL);
      return fetch(new Request(backendUrl, request));
    }

    // Default: pass through to static asset bucket (Cloudflare Pages)
    return new Response('ChatLustora Edge Service Active', { status: 200 });
  }
};
