# ChatLustora — Pre-Deployment & Cloudflare Production Checklist

> **Notice:** The application is validated in the local development environment. Production deployment to Cloudflare has not yet been executed. Follow this authoritative checklist when provisioning Cloudflare production infrastructure.

---

## 1. Cloudflare Pages (Frontend SPA)
- [ ] **Build Configuration**:
  - Build command: `npm run build`
  - Output directory: `dist`
  - Node.js compatibility version: `20.x` or higher
- [ ] **SPA Routing / Fallback**:
  - Ensure fallback routing is enabled so client-side routes (`/rooms`, `/roulette`, `/forum`, `/blog`, `/guidelines`, `/login`, etc.) resolve to `index.html`.
- [ ] **API & WebSocket Proxy / Custom Domain Routing**:
  - Route `/api/*` requests to the Cloudflare Worker running `src/worker/index.ts` either via Cloudflare Pages Functions routing or Cloudflare Zone route (e.g., `chatlustora.com/api/*` -> Worker).

---

## 2. Cloudflare D1 Database Provisioning & Migrations
- [ ] **Create Production D1 Database**:
  ```bash
  wrangler d1 create chatlustora-db
  ```
- [ ] **Update `wrangler.toml`**:
  - Replace `PLACEHOLDER_D1_ID` with the actual database ID returned by Wrangler:
  ```toml
  [[d1_databases]]
  binding = "DB"
  database_name = "chatlustora-db"
  database_id = "<your-production-d1-uuid>"
  ```
- [ ] **Execute Initial Schema & Seed**:
  ```bash
  # Execute schema against local preview first:
  wrangler d1 execute chatlustora-db --local --file=schema.sql

  # Execute schema against production database:
  wrangler d1 execute chatlustora-db --remote --file=schema.sql
  ```
- [ ] **Verify Seeded Rooms**:
  - Verify all 23 authoritative room slugs are populated via:
  ```bash
  wrangler d1 execute chatlustora-db --remote --command="SELECT COUNT(*) FROM rooms;"
  ```
  *(Expected count: 23)*

---

## 3. Durable Object Bindings & Migrations
- [ ] **Verify Durable Object Classes in `wrangler.toml`**:
  ```toml
  [[migrations]]
  tag = "v1"
  new_classes = ["RoomDO", "CoordinatorDO"]

  [[durable_objects.bindings]]
  name = "ROOMS"
  class_name = "RoomDO"

  [[durable_objects.bindings]]
  name = "COORDINATOR"
  class_name = "CoordinatorDO"
  ```
- [ ] **Worker Export Verification**:
  - Ensure `RoomDO` and `CoordinatorDO` are exported from the Worker entry point (`src/worker/index.ts` or imported via root):
  ```ts
  export { RoomDO } from './RoomDO';
  export { CoordinatorDO } from './CoordinatorDO';
  ```
- [ ] **Storage Migration Run**:
  - Deploy with tag `v1` to register both classes with Cloudflare's DO controller.

---

## 4. Environment Variables & Secrets
- [ ] **JWT / Session Secret**:
  - Set production session signing key (do NOT store in git or `wrangler.toml`):
  ```bash
  wrangler secret put SESSION_SECRET
  ```
- [ ] **Admin Moderation Master Key**:
  ```bash
  wrangler secret put MODERATION_API_KEY
  ```
- [ ] **Client Environment Variables** (in Cloudflare Pages Settings):
  - `VITE_API_BASE_URL`: Left empty if same-origin `/api`, or set to the production worker domain.
  - `VITE_WEBRTC_DEBUG`: `false` for production builds.

---

## 5. WebSocket Routing & Session Authentication
- [ ] **Room WebSocket (`/api/rooms/:roomId/ws`)**:
  - Validates `session_id` cookie against D1 `sessions` table.
  - Verifies session is not expired (`expires_at > Date.now()`).
  - Forwards authenticated `x-user-id` header to `RoomDO` via internal request.
  - RoomDO handles connection rate-limiting (1 message / 500ms max per connection) and max length enforcement (500 chars).
- [ ] **Roulette WebSocket (`/api/roulette/ws`)**:
  - Validates session before upgrading connection.
  - Hands off to singleton `COORDINATOR` DO (`idFromName('global')`).
  - Ensures client WebSocket handles automatic reconnect and cleans up active peer connections on drop.

---

## 6. WebRTC Traversal & TURN Server Configuration
- [ ] **Public STUN vs Production TURN**:
  - STUN alone (`stun.l.google.com:19302`) succeeds for direct and open NATs (~70-80% of consumer connections), but fails for mobile LTE/5G and symmetric NATs.
  - Production requires TURN relays for guaranteed audio/video connectivity.
- [ ] **Provision Cloudflare Calls / TURN Credentials**:
  - Generate ephemeral TURN credentials via Cloudflare Calls API or third-party TURN provider (e.g. Twilio, Metered, Coturn).
  - Add TURN servers to `iceServers` array:
  ```json
  [
    { "urls": "stun:stun.l.google.com:19302" },
    {
      "urls": "turn:turn.cloudflare.com:3478?transport=udp",
      "username": "<ephemeral-username>",
      "credential": "<ephemeral-credential>"
    }
  ]
  ```
- [ ] **ICE Candidate Early Arrival Queue**:
  - Verified in client code (`RoulettePanel.tsx`): candidates arriving before remote SDP is applied are queued in `pendingIceCandidates` and flushed immediately upon `setRemoteDescription`.

---

## 7. Production Verification & Sign-Off Criteria
- [ ] Deploy worker to staging/preview:
  ```bash
  wrangler deploy
  ```
- [ ] Perform two-device live camera/microphone test across separate networks (e.g., WiFi + Cellular) to verify NAT traversal.
- [ ] Confirm room chat rate-limiting triggers HTTP/WS structured error without crashing the Durable Object.
- [ ] Confirm "Skip" and "Leave" cleanly terminate active WebRTC tracks and reset media elements without leaving zombie streams in memory.
- [ ] Sign off on production readiness only after all live checks pass.
