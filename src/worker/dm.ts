import type { Context, Hono } from 'hono';
import { resolveWorkerSession } from './session';

type DmBindings = {
  DB: D1Database;
};

type DmContext = {
  req: {
    header: (name: string) => string | undefined;
    url: string;
    param: (name: string) => string;
    json: <T = any>() => Promise<T>;
  };
  env: DmBindings;
  json: (data: unknown, status?: number) => Response;
};

async function authenticate(c: Context<{ Bindings: DmBindings }>): Promise<string | null> {
  const session = await resolveWorkerSession(
    c.env.DB,
    c.req.header('cookie') || ''
  );

  return session?.userId || null;
}

function validOrigin(c: Context<{ Bindings: DmBindings }>): boolean {
  const origin = c.req.header('Origin');
  if (!origin) return false;

  try {
    return origin === new URL(c.req.url).origin;
  } catch {
    return false;
  }
}

async function isBlocked(
  db: D1Database,
  firstUserId: string,
  secondUserId: string
): Promise<boolean> {
  const result = await db.prepare(`
    SELECT 1
    FROM blocks
    WHERE (blocker_id = ? AND blocked_id = ?)
       OR (blocker_id = ? AND blocked_id = ?)
    LIMIT 1
  `).bind(firstUserId, secondUserId, secondUserId, firstUserId).first();

  return Boolean(result);
}

export function registerDmRoutes(app: Hono<any>) {
  // List conversations for the authenticated user.
  app.get('/api/dm/conversations', async (c: Context<{ Bindings: DmBindings }>) => {
    try {
      const userId = await authenticate(c);
      if (!userId) return c.json({ error: 'Unauthorized' }, 401);

      const result = await c.env.DB.prepare(`
        SELECT
          conv.id,
          conv.participant_1,
          conv.participant_2,
          CASE
            WHEN conv.participant_1 = ? THEN conv.participant_2
            ELSE conv.participant_1
          END AS partner_id,
          COALESCE(other.username, guest.nickname, 'User') AS partner_username,
          latest.text AS last_message,
          latest.timestamp AS last_timestamp
        FROM conversations conv
        LEFT JOIN users other
          ON other.id = CASE
            WHEN conv.participant_1 = ? THEN conv.participant_2
            ELSE conv.participant_1
          END
        LEFT JOIN guest_profiles guest
          ON guest.user_id = CASE
            WHEN conv.participant_1 = ? THEN conv.participant_2
            ELSE conv.participant_1
          END
        LEFT JOIN private_messages latest
          ON latest.id = (
            SELECT pm.id
            FROM private_messages pm
            WHERE pm.conversation_id = conv.id
            ORDER BY pm.timestamp DESC
            LIMIT 1
          )
        WHERE conv.participant_1 = ? OR conv.participant_2 = ?
        ORDER BY COALESCE(latest.timestamp, 0) DESC
      `).bind(userId, userId, userId, userId, userId).all();

      const conversations = (result.results || []).map((row: any) => ({
        id: row.id,
        participantIds: [row.participant_1, row.participant_2],
        participantNicknames: {
          [row.partner_id]: row.partner_username || 'User'
        },
        lastMessage: row.last_message || '',
        lastTimestamp: row.last_timestamp || 0,
        unreadCount: 0
      }));

      return c.json({ conversations });
    } catch (error) {
      console.error('[DM] Conversation list failed:', error);
      return c.json({ error: 'Unable to load conversations.' }, 500);
    }
  });

  // Load message history with one partner.
  app.get('/api/dm/:partnerId/messages', async (c: Context<{ Bindings: DmBindings }>) => {
    try {
      const userId = await authenticate(c);
      if (!userId) return c.json({ error: 'Unauthorized' }, 401);

      const partnerId = c.req.param('partnerId');
      if (!partnerId || partnerId.length > 128 || partnerId === userId) {
        return c.json({ error: 'Invalid conversation partner.' }, 400);
      }

      const partner = await c.env.DB
        .prepare('SELECT id FROM users WHERE id = ? UNION ALL SELECT user_id AS id FROM guest_profiles WHERE user_id = ? LIMIT 1')
        .bind(partnerId, partnerId)
        .first<{ id: string }>();

      if (!partner) return c.json({ error: 'User not found.' }, 404);

      if (await isBlocked(c.env.DB, userId, partnerId)) {
        return c.json({ error: 'Messaging is unavailable between these users.' }, 403);
      }

      const conversation = await c.env.DB.prepare(`
        SELECT id
        FROM conversations
        WHERE (participant_1 = ? AND participant_2 = ?)
           OR (participant_1 = ? AND participant_2 = ?)
        LIMIT 1
      `).bind(userId, partnerId, partnerId, userId)
        .first<{ id: string }>();

      if (!conversation) return c.json({ messages: [] });

      const result = await c.env.DB.prepare(`
        SELECT
          pm.id,
          pm.conversation_id,
          pm.sender_id,
          pm.text,
          pm.timestamp,
          COALESCE(sender.username, guest_sender.nickname, 'User') AS sender_username
        FROM private_messages pm
        LEFT JOIN users sender ON sender.id = pm.sender_id
        LEFT JOIN guest_profiles guest_sender ON guest_sender.user_id = pm.sender_id
        WHERE pm.conversation_id = ?
        ORDER BY pm.timestamp DESC
        LIMIT 100
      `).bind(conversation.id).all();

      const messages = (result.results || []).reverse().map((row: any) => ({
        id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        recipientId: row.sender_id === userId ? partnerId : userId,
        senderNickname: row.sender_username || 'User',
        text: row.text,
        timestamp: row.timestamp,
        isRead: false
      }));

      return c.json({ messages });
    } catch (error) {
      console.error('[DM] Message history failed:', error);
      return c.json({ error: 'Unable to load messages.' }, 500);
    }
  });

  // Send a private message.
  app.post('/api/dm/send', async (c: Context<{ Bindings: DmBindings }>) => {
    if (!validOrigin(c)) return c.json({ error: 'Invalid request origin.' }, 403);

    try {
      const userId = await authenticate(c);
      if (!userId) return c.json({ error: 'Unauthorized' }, 401);

      const body = await c.req.json<{ recipientId?: unknown; text?: unknown }>();
      const recipientId = typeof body.recipientId === 'string' ? body.recipientId.trim() : '';
      const text = typeof body.text === 'string' ? body.text.trim() : '';

      if (!recipientId || recipientId.length > 128 || recipientId === userId) {
        return c.json({ error: 'Invalid recipient.' }, 400);
      }
      if (!text || text.length > 1000) {
        return c.json({ error: 'Message must contain 1–1000 characters.' }, 400);
      }

      const recipient = await c.env.DB
        .prepare('SELECT id FROM users WHERE id = ? UNION ALL SELECT user_id AS id FROM guest_profiles WHERE user_id = ? LIMIT 1')
        .bind(recipientId, recipientId)
        .first<{ id: string }>();

      if (!recipient) return c.json({ error: 'User not found.' }, 404);

      if (await isBlocked(c.env.DB, userId, recipientId)) {
        return c.json({ error: 'Messaging is unavailable between these users.' }, 403);
      }

      let conversation = await c.env.DB.prepare(`
        SELECT id
        FROM conversations
        WHERE (participant_1 = ? AND participant_2 = ?)
           OR (participant_1 = ? AND participant_2 = ?)
        LIMIT 1
      `).bind(userId, recipientId, recipientId, userId)
        .first<{ id: string }>();

      if (!conversation) {
        const conversationId = crypto.randomUUID();
        const first = userId < recipientId ? userId : recipientId;
        const second = userId < recipientId ? recipientId : userId;

        await c.env.DB.prepare(`
          INSERT INTO conversations (id, participant_1, participant_2)
          VALUES (?, ?, ?)
        `).bind(conversationId, first, second).run();

        conversation = { id: conversationId };
      }

      const messageId = crypto.randomUUID();
      const timestamp = Date.now();

      await c.env.DB.prepare(`
        INSERT INTO private_messages
          (id, conversation_id, sender_id, text, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `).bind(messageId, conversation.id, userId, text, timestamp).run();

      const sender = await c.env.DB
        .prepare(`
          SELECT username AS nickname FROM users WHERE id = ?
          UNION ALL
          SELECT nickname FROM guest_profiles WHERE user_id = ?
          LIMIT 1
        `)
        .bind(userId, userId)
        .first<{ nickname: string }>();

      return c.json({
        success: true,
        message: {
          id: messageId,
          conversationId: conversation.id,
          senderId: userId,
          recipientId,
          senderNickname: sender?.nickname || 'User',
          text,
          timestamp,
          isRead: false
        }
      }, 201);
    } catch (error) {
      console.error('[DM] Send failed:', error);
      return c.json({ error: 'Unable to send message.' }, 500);
    }
  });

  // Return the current user's blocked user IDs.
  app.get('/api/user/blocks', async (c: Context<{ Bindings: DmBindings }>) => {
    try {
      const userId = await authenticate(c);
      if (!userId) return c.json({ error: 'Unauthorized' }, 401);

      const result = await c.env.DB
        .prepare('SELECT blocked_id FROM blocks WHERE blocker_id = ?')
        .bind(userId)
        .all<{ blocked_id: string }>();

      return c.json({ blockedUsers: (result.results || []).map(row => row.blocked_id) });
    } catch (error) {
      console.error('[Block] List failed:', error);
      return c.json({ error: 'Unable to load blocked users.' }, 500);
    }
  });

  // Block a user.
  app.post('/api/user/block', async (c: Context<{ Bindings: DmBindings }>) => {
    if (!validOrigin(c)) return c.json({ error: 'Invalid request origin.' }, 403);

    try {
      const userId = await authenticate(c);
      if (!userId) return c.json({ error: 'Unauthorized' }, 401);

      const body = await c.req.json<{ targetId?: unknown }>();
      const targetId = typeof body.targetId === 'string' ? body.targetId.trim() : '';

      if (!targetId || targetId.length > 128 || targetId === userId) {
        return c.json({ error: 'Invalid block target.' }, 400);
      }

      const target = await c.env.DB
        .prepare('SELECT id FROM users WHERE id = ? UNION ALL SELECT user_id AS id FROM guest_profiles WHERE user_id = ? LIMIT 1')
        .bind(targetId, targetId)
        .first();

      if (!target) return c.json({ error: 'User not found.' }, 404);

      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO blocks (blocker_id, blocked_id)
        VALUES (?, ?)
      `).bind(userId, targetId).run();

      return c.json({ success: true, blocked: true });
    } catch (error) {
      console.error('[Block] Create failed:', error);
      return c.json({ error: 'Unable to block user.' }, 500);
    }
  });

  // Unblock a user.
  app.post('/api/user/unblock', async (c: Context<{ Bindings: DmBindings }>) => {
    if (!validOrigin(c)) return c.json({ error: 'Invalid request origin.' }, 403);

    try {
      const userId = await authenticate(c);
      if (!userId) return c.json({ error: 'Unauthorized' }, 401);

      const body = await c.req.json<{ targetId?: unknown }>();
      const targetId = typeof body.targetId === 'string' ? body.targetId.trim() : '';

      if (!targetId || targetId.length > 128 || targetId === userId) {
        return c.json({ error: 'Invalid unblock target.' }, 400);
      }

      await c.env.DB.prepare(`
        DELETE FROM blocks
        WHERE blocker_id = ? AND blocked_id = ?
      `).bind(userId, targetId).run();

      return c.json({ success: true, blocked: false });
    } catch (error) {
      console.error('[Block] Remove failed:', error);
      return c.json({ error: 'Unable to unblock user.' }, 500);
    }
  });
}
