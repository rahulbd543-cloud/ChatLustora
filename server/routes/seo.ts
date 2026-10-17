/**
 * ChatLustora SEO Routes: robots.txt and sitemap.xml
 */

import { Router, Request, Response } from 'express';
import { INITIAL_CHATROOMS } from '../../shared/rooms.js';
import { dbStore } from '../db.js';

export const seoRouter = Router();

const BASE_URL = process.env.APP_URL || 'https://chatlustora.com';

seoRouter.get('/robots.txt', (_req: Request, res: Response) => {
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

Sitemap: ${BASE_URL}/sitemap.xml
`;
  res.type('text/plain').send(robots);
});

seoRouter.get('/sitemap.xml', (_req: Request, res: Response) => {
  const now = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // Homepage
  xml += `  <url>\n    <loc>${BASE_URL}/</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

  // 23 Authoritative Rooms
  INITIAL_CHATROOMS.forEach(room => {
    xml += `  <url>\n    <loc>${BASE_URL}${room.slug}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>hourly</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
  });

  // Blog list & articles
  xml += `  <url>\n    <loc>${BASE_URL}/blog</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;

  dbStore.blogArticles.forEach(art => {
    if (art.published) {
      xml += `  <url>\n    <loc>${BASE_URL}/blog/${art.slug}</loc>\n    <lastmod>${new Date(art.updatedAt).toISOString()}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    }
  });

  // Forum list
  xml += `  <url>\n    <loc>${BASE_URL}/forum</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;

  // Informational pages
  ['terms', 'privacy', 'guidelines', 'safety', 'contact'].forEach(slug => {
    xml += `  <url>\n    <loc>${BASE_URL}/${slug}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>\n`;
  });

  xml += `</urlset>`;

  res.type('application/xml').send(xml);
});
