/**
 * ChatLustora REST API Routes
 */

import { Router, Request, Response } from 'express';
import { dbStore } from '../db.js';
import {
  createGuestSession,
  validateSessionCreation,
  resolveSessionFromToken,
  generateSuggestedNickname,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS
} from '../session.js';
import { INITIAL_CHATROOMS, getRoomById } from '../../shared/rooms.js';
import { UserRole } from '../../shared/types.js';

export const apiRouter = Router();

// Middleware to extract active session from header or cookie
function authMiddleware(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.cookies?.[SESSION_COOKIE_NAME];

  const session = resolveSessionFromToken(token);
  (req as any).userSession = session;
  next();
}

// -------------------------------------------------------------
// AUTH & GUEST ENTRY
// -------------------------------------------------------------
apiRouter.get('/auth/suggest-nickname', (_req: Request, res: Response) => {
  res.json({ nickname: generateSuggestedNickname() });
});

apiRouter.post('/auth/session', (req: Request, res: Response) => {
  const { nickname, isAdultConfirmed, termsAccepted, gender, dateOfBirth, isGenderVisible, roleKey } = req.body;

  const validation = validateSessionCreation(
    nickname,
    Boolean(isAdultConfirmed),
    Boolean(termsAccepted),
    gender,
    dateOfBirth
  );

  if (validation.error) {
    res.status(400).json({ error: validation.error });
    return;
  }

  // Public session creation always assigns guest role securely
  const role: UserRole = 'guest';

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
  const genderVisible = isGenderVisible !== undefined ? Boolean(isGenderVisible) : true;
  const session = createGuestSession(
    validation.nickname!,
    validation.gender!,
    validation.validatedDob!,
    genderVisible,
    clientIp
  );

  // Set secure HTTP-only cookie
  res.cookie(SESSION_COOKIE_NAME, session.sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS
  });

  res.json({
    success: true,
    session: {
      userId: session.userId,
      nickname: session.nickname,
      role: session.role,
      avatarSeed: session.avatarSeed,
      gender: session.gender,
      isGenderVisible: session.isGenderVisible,
      token: session.sessionId
    }
  });
});

apiRouter.get('/auth/me', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (!session) {
    res.status(401).json({ error: 'No active session' });
    return;
  }
  res.json({
    userId: session.userId,
    nickname: session.nickname,
    role: session.role,
    avatarSeed: session.avatarSeed,
    gender: session.gender,
    isGenderVisible: session.isGenderVisible,
    token: session.sessionId
  });
});

apiRouter.post('/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE_NAME);
  res.json({ success: true });
});

apiRouter.post('/auth/renew', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (!session) {
    res.status(401).json({ error: 'No active session to renew' });
    return;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  res.cookie(SESSION_COOKIE_NAME, session.sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS
  });
  res.json({ success: true, expiresAt: session.expiresAt });
});

apiRouter.get('/webrtc/config', (_req: Request, res: Response) => {
  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  if (process.env.TURN_URL) {
    iceServers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL
    });
  }

  res.json({ iceServers });
});

// -------------------------------------------------------------
// ROOMS DIRECTORY (23 Initial Rooms)
// -------------------------------------------------------------
apiRouter.get('/rooms', (_req: Request, res: Response) => {
  res.json({
    rooms: INITIAL_CHATROOMS,
    total: INITIAL_CHATROOMS.length
  });
});

apiRouter.get('/rooms/:roomId/messages', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const room = getRoomById(roomId);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 100));
  const before = req.query.before ? Number(req.query.before) : undefined;
  let messages = dbStore.getRoomMessages(room.id, 100);
  if (before) {
    messages = messages.filter(m => m.timestamp < before);
  }
  messages = messages.slice(-limit);
  res.json({ roomId: room.id, messages });
});

// -------------------------------------------------------------
// BLOG SYSTEM
// -------------------------------------------------------------
apiRouter.get('/blog', (req: Request, res: Response) => {
  const search = (req.query.search as string || '').toLowerCase();
  const category = req.query.category as string;

  let articles = dbStore.blogArticles.filter(a => a.published);

  if (category && category !== 'All') {
    articles = articles.filter(a => a.category.toLowerCase() === category.toLowerCase());
  }

  if (search) {
    articles = articles.filter(a =>
      a.title.toLowerCase().includes(search) ||
      a.excerpt.toLowerCase().includes(search) ||
      a.tags.some(t => t.toLowerCase().includes(search))
    );
  }

  res.json({ articles });
});

apiRouter.get('/blog/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;
  const article = dbStore.blogArticles.find(a => a.slug === slug);
  if (!article) {
    res.status(404).json({ error: 'Article not found' });
    return;
  }
  article.views += 1;
  res.json({ article });
});

apiRouter.post('/blog', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (!session || (session.role !== 'admin' && session.role !== 'moderator')) {
    res.status(403).json({ error: 'Only administrators or moderators can publish blog articles.' });
    return;
  }

  const { title, excerpt, content, category, tags, coverImageUrl } = req.body;
  if (!title || !content) {
    res.status(400).json({ error: 'Title and content are required.' });
    return;
  }

  const slug = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 100);

  const article = {
    id: `art-${Date.now()}`,
    title,
    slug,
    excerpt: excerpt || title,
    content,
    category: category || 'General',
    tags: Array.isArray(tags) ? tags : [],
    coverImageUrl: coverImageUrl || 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=800&q=80',
    authorNickname: session.nickname,
    authorRole: session.role,
    published: true,
    views: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  dbStore.blogArticles.unshift(article);
  res.status(201).json({ success: true, article });
});

apiRouter.put('/blog/:id', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (!session || (session.role !== 'admin' && session.role !== 'moderator')) {
    res.status(403).json({ error: 'Only administrators or moderators can update blog articles.' });
    return;
  }
  const { id } = req.params;
  const { title, excerpt, content, category, tags, coverImageUrl, published } = req.body;
  const updated = dbStore.updateBlogArticle(id, {
    ...(title ? { title } : {}),
    ...(excerpt ? { excerpt } : {}),
    ...(content ? { content } : {}),
    ...(category ? { category } : {}),
    ...(Array.isArray(tags) ? { tags } : {}),
    ...(coverImageUrl !== undefined ? { coverImageUrl } : {}),
    ...(published !== undefined ? { published: Boolean(published) } : {})
  });
  if (!updated) {
    res.status(404).json({ error: 'Article not found.' });
    return;
  }
  res.json({ success: true, article: updated });
});

apiRouter.delete('/blog/:id', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (!session || (session.role !== 'admin' && session.role !== 'moderator')) {
    res.status(403).json({ error: 'Only administrators or moderators can delete blog articles.' });
    return;
  }
  const { id } = req.params;
  const deleted = dbStore.deleteBlogArticle(id);
  if (!deleted) {
    res.status(404).json({ error: 'Article not found.' });
    return;
  }
  res.json({ success: true, message: 'Article deleted.' });
});

apiRouter.get('/blog/:id/comments', (req: Request, res: Response) => {
  const { id } = req.params;
  const comments = dbStore.getBlogComments(id);
  res.json({ articleId: id, comments });
});

apiRouter.post('/blog/:id/comments', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (!session) {
    res.status(401).json({ error: 'Must be an active adult guest to comment.' });
    return;
  }
  const { id } = req.params;
  const { content } = req.body;
  if (!content || !content.trim()) {
    res.status(400).json({ error: 'Comment content cannot be empty.' });
    return;
  }
  const comment = {
    id: `comm-${Date.now()}`,
    articleId: id,
    authorNickname: session.nickname,
    content: content.trim().slice(0, 1000),
    createdAt: Date.now()
  };
  dbStore.addBlogComment(comment);
  res.status(201).json({ success: true, comment });
});

// -------------------------------------------------------------
// DIRECT MESSAGES CONVERSATIONS
// -------------------------------------------------------------
apiRouter.get('/dm/conversations', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (!session) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }
  const conversations = dbStore.getUserConversations(session.userId);
  res.json({ conversations });
});

// -------------------------------------------------------------
// FORUM SYSTEM
// -------------------------------------------------------------
apiRouter.get('/forum/categories', (_req: Request, res: Response) => {
  res.json({ categories: dbStore.forumCategories });
});

apiRouter.get('/forum/topics', (req: Request, res: Response) => {
  const categoryId = req.query.categoryId as string;
  const search = (req.query.search as string || '').toLowerCase();

  let topics = dbStore.forumTopics;
  if (categoryId) {
    topics = topics.filter(t => t.categoryId === categoryId);
  }
  if (search) {
    topics = topics.filter(t =>
      t.title.toLowerCase().includes(search) ||
      t.content.toLowerCase().includes(search)
    );
  }

  // Sort pinned first, then lastActivityAt DESC
  topics = [...topics].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.lastActivityAt - a.lastActivityAt;
  });

  res.json({ topics });
});

apiRouter.post('/forum/topics', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (!session) {
    res.status(401).json({ error: 'Must be an active adult guest to create topics.' });
    return;
  }

  const { categoryId, title, content } = req.body;
  if (!title || !content || !categoryId) {
    res.status(400).json({ error: 'Title, category, and content are required.' });
    return;
  }

  const topic = {
    id: `topic-${Date.now()}`,
    categoryId,
    title: title.trim().slice(0, 150),
    content: content.trim().slice(0, 5000),
    authorNickname: session.nickname,
    authorId: session.userId,
    createdAt: Date.now(),
    replyCount: 0,
    lastActivityAt: Date.now()
  };

  dbStore.forumTopics.unshift(topic);
  dbStore.forumPosts.set(topic.id, []);

  // Update category count
  const cat = dbStore.forumCategories.find(c => c.id === categoryId);
  if (cat) cat.topicCount += 1;

  res.status(201).json({ success: true, topic });
});

apiRouter.get('/forum/topics/:id/posts', (req: Request, res: Response) => {
  const { id } = req.params;
  const posts = dbStore.forumPosts.get(id) || [];
  res.json({ topicId: id, posts });
});

apiRouter.post('/forum/topics/:id/posts', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (!session) {
    res.status(401).json({ error: 'Must be an active adult guest to reply.' });
    return;
  }

  const { id } = req.params;
  const { content, quoteContent, quoteAuthor } = req.body;
  if (!content || !content.trim()) {
    res.status(400).json({ error: 'Reply content cannot be empty.' });
    return;
  }

  const topic = dbStore.forumTopics.find(t => t.id === id);
  if (!topic) {
    res.status(404).json({ error: 'Topic not found.' });
    return;
  }
  if (topic.isLocked) {
    res.status(403).json({ error: 'This topic has been locked by a moderator.' });
    return;
  }

  const post = {
    id: `post-${Date.now()}`,
    topicId: id,
    content: content.trim().slice(0, 3000),
    quoteContent,
    quoteAuthor,
    authorNickname: session.nickname,
    authorId: session.userId,
    authorRole: session.role,
    createdAt: Date.now()
  };

  const list = dbStore.forumPosts.get(id) || [];
  list.push(post);
  dbStore.forumPosts.set(id, list);

  topic.replyCount += 1;
  topic.lastActivityAt = Date.now();

  res.status(201).json({ success: true, post });
});

apiRouter.delete('/forum/topics/:id', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (!session) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }
  const { id } = req.params;
  const topic = dbStore.forumTopics.find(t => t.id === id);
  if (!topic) {
    res.status(404).json({ error: 'Topic not found.' });
    return;
  }
  // Allow author or moderator/admin
  if (topic.authorId !== session.userId && session.role !== 'admin' && session.role !== 'moderator') {
    res.status(403).json({ error: 'You do not have permission to delete this topic.' });
    return;
  }
  dbStore.deleteForumTopic(id);
  res.json({ success: true, message: 'Topic deleted.' });
});

apiRouter.post('/forum/topics/:id/pin', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (!session || (session.role !== 'admin' && session.role !== 'moderator')) {
    res.status(403).json({ error: 'Requires moderator privilege.' });
    return;
  }
  const { id } = req.params;
  const toggled = dbStore.togglePinForumTopic(id);
  if (!toggled) {
    res.status(404).json({ error: 'Topic not found.' });
    return;
  }
  res.json({ success: true });
});

apiRouter.post('/forum/topics/:id/lock', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (!session || (session.role !== 'admin' && session.role !== 'moderator')) {
    res.status(403).json({ error: 'Requires moderator privilege.' });
    return;
  }
  const { id } = req.params;
  const toggled = dbStore.toggleLockForumTopic(id);
  if (!toggled) {
    res.status(404).json({ error: 'Topic not found.' });
    return;
  }
  res.json({ success: true });
});

// -------------------------------------------------------------
// REPORTS & MODERATION
// -------------------------------------------------------------
apiRouter.post('/reports', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (!session) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const { targetId, targetNickname, reason, notes, roomId } = req.body;
  if (!targetId || !reason) {
    res.status(400).json({ error: 'Missing targetId or report reason.' });
    return;
  }

  const report = {
    id: `rep-${Date.now()}`,
    reporterNickname: session.nickname,
    reporterId: session.userId,
    targetId,
    targetNickname: targetNickname || 'Unknown',
    reason,
    notes: notes || '',
    roomId,
    timestamp: Date.now(),
    status: 'pending' as const
  };

  dbStore.addReport(report);
  res.json({ success: true, message: 'Report submitted for moderator review.' });
});

apiRouter.get('/moderation/reports', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (!session || (session.role !== 'admin' && session.role !== 'moderator')) {
    res.status(403).json({ error: 'Access denied: Requires moderator or admin privilege.' });
    return;
  }

  res.json({ reports: dbStore.reports });
});

apiRouter.post('/moderation/action', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (!session || (session.role !== 'admin' && session.role !== 'moderator')) {
    res.status(403).json({ error: 'Access denied: Requires moderator or admin privilege.' });
    return;
  }

  const { action, targetId, targetNickname, reason, reportId } = req.body;

  if (reportId) {
    const report = dbStore.reports.find(r => r.id === reportId);
    if (report) report.status = 'action_taken';
  }

  if (action === 'mute' && targetId) {
    const targetSession = dbStore.getSession(targetId);
    if (targetSession) {
      targetSession.isMuted = true;
      targetSession.muteUntil = Date.now() + 15 * 60 * 1000; // 15 min mute
    }
  }

  if (action === 'ban' && targetId) {
    dbStore.bannedUsers.add(targetId);
  }

  dbStore.addAuditLog({
    id: `audit-${Date.now()}`,
    moderatorNickname: session.nickname,
    action,
    targetNickname: targetNickname || 'User',
    reason: reason || 'Violation of adult community guidelines',
    timestamp: Date.now()
  });

  res.json({ success: true, message: `Action "${action}" recorded.` });
});

apiRouter.get('/moderation/audit-logs', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (!session || (session.role !== 'admin' && session.role !== 'moderator')) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }
  res.json({ logs: dbStore.auditLogs });
});

// -------------------------------------------------------------
// BLOCKING
// -------------------------------------------------------------
apiRouter.post('/user/block', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (!session) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const { targetId } = req.body;
  if (targetId) {
    dbStore.blockUser(session.userId, targetId);
  }
  res.json({ success: true });
});

apiRouter.post('/user/unblock', authMiddleware, (req: Request, res: Response) => {
  const session = (req as any).userSession;
  if (!session) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const { targetId } = req.body;
  if (targetId) {
    dbStore.unblockUser(session.userId, targetId);
  }
  res.json({ success: true });
});
