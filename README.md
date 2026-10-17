# ChatLustora — Cloudflare Native Production Architecture

**Brand**: ChatLustora  
**Tagline**: “Flirt Freely. Connect Deeply.”  
**Target Audience**: Adults aged 18+, including Bangladeshi, Bengali-speaking, South Asian, and international communities.

---

## Architecture Overview

ChatLustora is built specifically for the Cloudflare edge ecosystem:
- **Frontend**: Cloudflare Pages / static assets (`public/`).
- **Backend**: Cloudflare Workers (`worker.js`).
- **Real-Time Rooms**: Cloudflare Durable Objects (`room-chat.js`) handling authoritative WebSocket connections, room membership, and message broadcasting.
- **Database**: Cloudflare D1 (SQLite-compatible serverless relational database).

---

## Prerequisites & Installation

1. Install Node.js (LTS version).
2. Install dependencies:
   ```bash
   npm install
   ```

---

## Local Development (Wrangler Dev)

1. Copy `.dev.vars.example` to `.dev.vars`:
   ```bash
   cp .dev.vars.example .dev.vars
   ```
2. Run local Wrangler development server:
   ```bash
   npm run dev
   ```

---

## Database Migration (Cloudflare D1)

Apply the D1 database schema locally:
```bash
npm run db:migrate:local
```

Apply the schema to your production remote D1 database:
```bash
npm run db:migrate:remote
```

---

## Production Deployment to Cloudflare

1. Authenticate with Wrangler:
   ```bash
   npx wrangler login
   ```
2. Build frontend assets:
   ```bash
   npm run build
   ```
3. Deploy Worker and Durable Objects:
   ```bash
   npm run deploy
   ```
