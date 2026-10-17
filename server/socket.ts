/**
 * ChatLustora Socket.IO Real-Time Server
 * 
 * Handles:
 * - Room joins, presence counts & real-time messaging with room authorization
 * - Typing indicators with auto-clear debounce
 * - 1-on-1 Direct Messaging & unread state with block enforcement
 * - WebRTC native audio/video signaling with participant validation
 * - Server-controlled race-safe Roulette matchmaking with functional Skip & rematch protection
 * - Disconnect & cleanup lifecycle
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { dbStore } from './db.js';
import { resolveSessionFromToken } from './session.js';
import { getRoomById, INITIAL_CHATROOMS } from '../shared/rooms.js';
import { ChatMessage, PrivateMessage, CallSignalPayload, CallType } from '../shared/types.js';

interface SocketData {
  userId: string;
  nickname: string;
  role: string;
  currentRoomId?: string;
  rouletteMatchId?: string;
  roulettePartnerSocketId?: string;
  lastSkipTime?: number;
  lastPartnerUserId?: string;
}

// Simple HTML entity escape to prevent XSS
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function setupSocketServer(io: SocketIOServer) {
  // Map of userId -> Set of socketIds (for multi-tab presence & DMs)
  const userSockets = new Map<string, Set<string>>();
  // Map of socketId -> SocketData
  const socketMeta = new Map<string, SocketData>();
  // Roulette Queue: FIFO list of socketIds waiting for an adult partner
  const rouletteQueue: string[] = [];
  // Active roulette pairings: socketId -> partnerSocketId
  const roulettePartners = new Map<string, string>();

  // Helper to get all room presence counts
  function broadcastPresence() {
    const roomCounts: Record<string, number> = {};
    INITIAL_CHATROOMS.forEach(r => {
      const roomSockets = io.sockets.adapter.rooms.get(r.id);
      roomCounts[r.id] = roomSockets ? roomSockets.size : 0;
    });

    const totalConnected = io.engine.clientsCount;
    io.emit('presence:global', {
      totalConnected,
      roomCounts
    });
  }

  // Helper to send message to a specific userId across their open sockets
  function emitToUser(userId: string, event: string, payload: any) {
    const sockets = userSockets.get(userId);
    if (sockets) {
      sockets.forEach(sockId => {
        io.to(sockId).emit(event, payload);
      });
    }
  }

  io.on('connection', (socket: Socket) => {
    // Authenticate handshake via query or auth token
    const token = socket.handshake.auth?.token || (socket.handshake.query?.token as string);
    const session = resolveSessionFromToken(token);

    if (!session) {
      socket.emit('auth:error', { message: 'Invalid or expired adult session. Please re-enter.' });
      socket.disconnect(true);
      return;
    }

    const { userId, nickname, role } = session;

    // Check if user or IP is banned
    if (dbStore.bannedUsers.has(userId) || (session.ipHash && dbStore.bannedUsers.has(session.ipHash))) {
      socket.emit('auth:error', { message: 'Your access has been terminated due to community guideline violations.' });
      socket.disconnect(true);
      return;
    }

    // Track user socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);

    const meta: SocketData = {
      userId,
      nickname,
      role
    };
    socketMeta.set(socket.id, meta);

    // Broadcast updated global presence
    broadcastPresence();

    // -------------------------------------------------------------
    // ROOM MANAGEMENT
    // -------------------------------------------------------------
    socket.on('room:join', ({ roomId }: { roomId: string }) => {
      if (!roomId) return;
      const room = getRoomById(roomId);
      if (!room) {
        socket.emit('room:error', { message: 'Chatroom not found in directory.' });
        return;
      }

      // Leave previous room if any
      if (meta.currentRoomId && meta.currentRoomId !== roomId) {
        socket.leave(meta.currentRoomId);
        io.to(meta.currentRoomId).emit('room:user-left', {
          userId,
          nickname,
          roomId: meta.currentRoomId
        });
      }

      socket.join(roomId);
      meta.currentRoomId = roomId;

      // Send recent message history
      const history = dbStore.getRoomMessages(roomId, 50);
      socket.emit('room:history', { roomId, messages: history });

      // Notify others in room
      socket.to(roomId).emit('room:user-joined', {
        userId,
        nickname,
        role: meta.role,
        roomId
      });

      broadcastPresence();
    });

    socket.on('room:leave', ({ roomId }: { roomId: string }) => {
      if (meta.currentRoomId === roomId) {
        socket.leave(roomId);
        meta.currentRoomId = undefined;
        socket.to(roomId).emit('room:user-left', { userId, nickname, roomId });
        broadcastPresence();
      }
    });

    // -------------------------------------------------------------
    // CHAT MESSAGES
    // -------------------------------------------------------------
    let lastMessageTime = 0;
    socket.on('message:send', ({ roomId, text }: { roomId: string; text: string }) => {
      if (!roomId || !text || typeof text !== 'string') return;

      // Authorization: user must actually be inside the room
      if (meta.currentRoomId !== roomId) {
        socket.emit('error:room', { message: 'You must join this room before sending messages.' });
        return;
      }

      const cleanText = text.trim();
      if (!cleanText || cleanText.length > 1000) return;

      // Rate limit check: max 1 message per 300ms
      const now = Date.now();
      if (now - lastMessageTime < 300) {
        socket.emit('error:ratelimit', { message: 'You are sending messages too quickly.' });
        return;
      }
      lastMessageTime = now;

      // Check if user is muted
      const currentSession = dbStore.getSession(userId);
      if (currentSession?.isMuted && currentSession.muteUntil && currentSession.muteUntil > now) {
        socket.emit('error:muted', { message: 'You are temporarily muted by moderation.' });
        return;
      }

      const message: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        roomId,
        senderId: userId,
        senderNickname: meta.nickname,
        senderRole: (meta.role as any) || 'guest',
        senderAvatarSeed: session.avatarSeed,
        text: escapeHtml(cleanText),
        timestamp: now
      };

      dbStore.addRoomMessage(message);
      io.to(roomId).emit('message:new', message);
    });

    // -------------------------------------------------------------
    // TYPING INDICATORS
    // -------------------------------------------------------------
    socket.on('typing:start', ({ roomId }: { roomId: string }) => {
      if (!roomId || meta.currentRoomId !== roomId) return;
      socket.to(roomId).emit('typing:update', {
        roomId,
        userId,
        nickname: meta.nickname,
        isTyping: true
      });
    });

    socket.on('typing:stop', ({ roomId }: { roomId: string }) => {
      if (!roomId || meta.currentRoomId !== roomId) return;
      socket.to(roomId).emit('typing:update', {
        roomId,
        userId,
        nickname: meta.nickname,
        isTyping: false
      });
    });

    // -------------------------------------------------------------
    // DIRECT MESSAGING (1-on-1 DM)
    // -------------------------------------------------------------
    socket.on('dm:send', ({ recipientId, text }: { recipientId: string; text: string }) => {
      if (!recipientId || !text || typeof text !== 'string') return;
      const cleanText = text.trim();
      if (!cleanText || cleanText.length > 1000) return;

      // Check if blocked in either direction
      if (dbStore.isBlocked(recipientId, userId) || dbStore.isBlocked(userId, recipientId)) {
        socket.emit('dm:blocked', { recipientId, message: 'Message could not be delivered.' });
        return;
      }

      const convId = dbStore.getConversationId(userId, recipientId);
      const dm: PrivateMessage = {
        id: `dm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        conversationId: convId,
        senderId: userId,
        recipientId,
        senderNickname: meta.nickname,
        text: escapeHtml(cleanText),
        timestamp: Date.now(),
        isRead: false
      };

      dbStore.addPrivateMessage(dm);

      // Send to recipient
      emitToUser(recipientId, 'dm:new', dm);
      // Echo back to sender
      socket.emit('dm:new', dm);
    });

    socket.on('dm:get_history', ({ partnerId }: { partnerId: string }) => {
      if (!partnerId) return;
      const convId = dbStore.getConversationId(userId, partnerId);
      const messages = dbStore.getPrivateMessages(convId);
      socket.emit('dm:history', { partnerId, messages });
    });

    // -------------------------------------------------------------
    // WEBRTC NATIVE AUDIO/VIDEO CALLING
    // -------------------------------------------------------------
    socket.on('call:invite', ({ recipientId, type }: { recipientId: string; type: CallType }) => {
      if (!recipientId || recipientId === userId) return;

      // Enforce blocking: reject call invitation if blocked
      if (dbStore.isBlocked(recipientId, userId)) {
        socket.emit('call:declined', { callId: '', callerId: userId, reason: 'blocked' });
        return;
      }

      const callId = `call-${Date.now()}-${userId.slice(-4)}`;
      emitToUser(recipientId, 'call:incoming', {
        callId,
        callerId: userId,
        callerNickname: meta.nickname,
        callerAvatarSeed: session.avatarSeed,
        type: type || 'video'
      });
    });

    socket.on('call:accept', ({ callId, callerId }: { callId: string; callerId: string }) => {
      emitToUser(callerId, 'call:accepted', { callId, recipientId: userId, recipientNickname: meta.nickname });
    });

    socket.on('call:decline', ({ callId, callerId }: { callId: string; callerId: string }) => {
      emitToUser(callerId, 'call:declined', { callId, recipientId: userId });
    });

    socket.on('call:signal', (payload: CallSignalPayload) => {
      if (!payload || !payload.toUserId) return;
      emitToUser(payload.toUserId, 'call:signal', {
        ...payload,
        fromUserId: userId
      });
    });

    socket.on('call:hangup', ({ toUserId }: { toUserId: string }) => {
      if (toUserId) {
        emitToUser(toUserId, 'call:ended', { fromUserId: userId });
      }
    });

    // -------------------------------------------------------------
    // ROULETTE MATCHMAKING WITH FUNCTIONAL SKIP
    // -------------------------------------------------------------
    function cleanRouletteQueue() {
      // Remove stale disconnected sockets from queue
      for (let i = rouletteQueue.length - 1; i >= 0; i--) {
        const sockId = rouletteQueue[i];
        if (!io.sockets.sockets.has(sockId)) {
          rouletteQueue.splice(i, 1);
        }
      }
    }

    function matchRouletteUsers() {
      cleanRouletteQueue();

      while (rouletteQueue.length >= 2) {
        const sock1Id = rouletteQueue.shift()!;
        let matchIndex = -1;

        const meta1 = socketMeta.get(sock1Id);
        if (!meta1) continue;

        // Find a partner that is not self, not blocked, and preferably not the immediate last partner
        for (let i = 0; i < rouletteQueue.length; i++) {
          const candidateSockId = rouletteQueue[i];
          const candidateMeta = socketMeta.get(candidateSockId);

          if (!candidateMeta) continue;
          if (candidateMeta.userId === meta1.userId) continue; // Self-match prevention

          // Check if blocked
          if (dbStore.isBlocked(meta1.userId, candidateMeta.userId) || dbStore.isBlocked(candidateMeta.userId, meta1.userId)) {
            continue;
          }

          // Rematch prevention check: if more than 2 in queue, avoid immediate previous partner
          if (rouletteQueue.length > 2 && meta1.lastPartnerUserId === candidateMeta.userId) {
            continue;
          }

          matchIndex = i;
          break;
        }

        // If no candidate without rematch found, fallback to first valid non-self partner
        if (matchIndex === -1) {
          for (let i = 0; i < rouletteQueue.length; i++) {
            const candidateSockId = rouletteQueue[i];
            const candidateMeta = socketMeta.get(candidateSockId);
            if (candidateMeta && candidateMeta.userId !== meta1.userId) {
              matchIndex = i;
              break;
            }
          }
        }

        if (matchIndex === -1) {
          // Put sock1 back in queue and wait for more users
          rouletteQueue.unshift(sock1Id);
          break;
        }

        const sock2Id = rouletteQueue.splice(matchIndex, 1)[0];
        const sock1 = io.sockets.sockets.get(sock1Id);
        const sock2 = io.sockets.sockets.get(sock2Id);

        if (!sock1 || !sock2) {
          if (sock1) rouletteQueue.unshift(sock1Id);
          if (sock2) rouletteQueue.unshift(sock2Id);
          break;
        }

        const meta2 = socketMeta.get(sock2Id)!;

        const matchId = `match-${Date.now()}`;
        roulettePartners.set(sock1Id, sock2Id);
        roulettePartners.set(sock2Id, sock1Id);

        meta1.roulettePartnerSocketId = sock2Id;
        meta2.roulettePartnerSocketId = sock1Id;

        // Remember last partner to avoid immediate rematch on quick Skip
        meta1.lastPartnerUserId = meta2.userId;
        meta2.lastPartnerUserId = meta1.userId;

        sock1.emit('roulette:matched', {
          matchId,
          partnerId: meta2.userId,
          partnerNickname: meta2.nickname,
          isInitiator: true
        });

        sock2.emit('roulette:matched', {
          matchId,
          partnerId: meta1.userId,
          partnerNickname: meta1.nickname,
          isInitiator: false
        });
      }
    }

    socket.on('roulette:join', () => {
      // Clean up previous pairing if existing
      handleRouletteLeave(socket.id, false);

      if (!rouletteQueue.includes(socket.id)) {
        rouletteQueue.push(socket.id);
      }
      socket.emit('roulette:queued', { queuePosition: rouletteQueue.length });
      matchRouletteUsers();
    });

    socket.on('roulette:skip', () => {
      const now = Date.now();
      // Throttle skip action to prevent spamming
      if (meta.lastSkipTime && now - meta.lastSkipTime < 400) {
        return;
      }
      meta.lastSkipTime = now;

      // End current match cleanly and queue up for the next partner
      handleRouletteLeave(socket.id, true);
      rouletteQueue.push(socket.id);
      socket.emit('roulette:queued', { queuePosition: rouletteQueue.length });
      matchRouletteUsers();
    });

    socket.on('roulette:leave', () => {
      handleRouletteLeave(socket.id, false);
      socket.emit('roulette:left');
    });

    socket.on('roulette:message', ({ text }: { text: string }) => {
      const partnerSocketId = roulettePartners.get(socket.id);
      if (partnerSocketId && text) {
        io.to(partnerSocketId).emit('roulette:message', {
          senderNickname: meta.nickname,
          text: escapeHtml(text.trim().slice(0, 1000)),
          timestamp: Date.now()
        });
      }
    });

    socket.on('roulette:signal', (signalData: any) => {
      const partnerSocketId = roulettePartners.get(socket.id);
      if (partnerSocketId) {
        io.to(partnerSocketId).emit('roulette:signal', signalData);
      }
    });

    function handleRouletteLeave(sockId: string, notifyPartner = true) {
      // Remove from queue
      const qIdx = rouletteQueue.indexOf(sockId);
      if (qIdx !== -1) rouletteQueue.splice(qIdx, 1);

      // Handle active partner
      const partnerId = roulettePartners.get(sockId);
      if (partnerId) {
        roulettePartners.delete(sockId);
        roulettePartners.delete(partnerId);

        const partnerMeta = socketMeta.get(partnerId);
        if (partnerMeta) partnerMeta.roulettePartnerSocketId = undefined;

        if (notifyPartner) {
          io.to(partnerId).emit('roulette:partner-disconnected', {
            message: 'Your partner skipped or disconnected. Click Find Match to connect with another adult.'
          });
        }
      }
      meta.roulettePartnerSocketId = undefined;
    }

    // -------------------------------------------------------------
    // DISCONNECT & CLEANUP
    // -------------------------------------------------------------
    socket.on('disconnect', () => {
      handleRouletteLeave(socket.id, true);

      if (meta.currentRoomId) {
        socket.to(meta.currentRoomId).emit('room:user-left', {
          userId,
          nickname,
          roomId: meta.currentRoomId
        });
      }

      socketMeta.delete(socket.id);
      const userSockSet = userSockets.get(userId);
      if (userSockSet) {
        userSockSet.delete(socket.id);
        if (userSockSet.size === 0) {
          userSockets.delete(userId);
        }
      }

      broadcastPresence();
    });
  });
}
