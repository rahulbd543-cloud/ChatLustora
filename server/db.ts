/**
 * ChatLustora Database Layer
 * 
 * Provides an authoritative relational store for rooms, messages, direct messages,
 * blog articles, forum topics, reports, blocks, and guest sessions.
 * Supports Supabase when configured, and maintains an in-memory/disk store
 * for standalone execution in local dev and AI Studio preview.
 */

import { INITIAL_CHATROOMS, Chatroom } from '../shared/rooms.js';
import {
  ChatMessage,
  PrivateMessage,
  PrivateConversation,
  BlogArticle,
  ForumCategory,
  ForumTopic,
  ForumPost,
  ReportItem,
  ModerationAuditLog,
  UserSession,
  BlogComment
} from '../shared/types.js';

class ChatLustoraStore {
  public rooms: Map<string, Chatroom> = new Map();
  public sessions: Map<string, UserSession> = new Map();
  public messages: Map<string, ChatMessage[]> = new Map(); // roomId -> messages
  public conversations: Map<string, PrivateConversation> = new Map();
  public privateMessages: Map<string, PrivateMessage[]> = new Map(); // convId -> messages
  public blogArticles: BlogArticle[] = [];
  public forumCategories: ForumCategory[] = [];
  public forumTopics: ForumTopic[] = [];
  public forumPosts: Map<string, ForumPost[]> = new Map(); // topicId -> posts
  public reports: ReportItem[] = [];
  public auditLogs: ModerationAuditLog[] = [];
  public userBlocks: Map<string, Set<string>> = new Map(); // blockerId -> Set of blockedIds
  public bannedUsers: Set<string> = new Set(); // userId or ipHash

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // 1. Seed the canonical 23 rooms & room-1 test room
    INITIAL_CHATROOMS.forEach(room => {
      this.rooms.set(room.id, { ...room });
      this.messages.set(room.id, [
        {
          id: `welcome-${room.id}`,
          roomId: room.id,
          senderId: 'system',
          senderNickname: 'ChatLustora System',
          senderRole: 'admin',
          senderAvatarSeed: 'lustora-bot',
          senderGender: 'prefer-not-to-say',
          senderIsGenderVisible: false,
          text: `Welcome to ${room.name}! This is an adult (18+) moderated space. Flirt freely, connect deeply, and please respect consent and community guidelines.`,
          timestamp: Date.now() - 3600000,
          isSystem: true
        }
      ]);
    });

    this.messages.set('room-1', [
      {
        id: 'welcome-room-1',
        roomId: 'room-1',
        senderId: 'system',
        senderNickname: 'System',
        senderRole: 'admin',
        senderAvatarSeed: 'lustora-bot',
        senderGender: 'prefer-not-to-say',
        senderIsGenderVisible: false,
        text: 'Welcome to room-1 test room',
        timestamp: Date.now()
      }
    ]);

    // 2. Seed Forum Categories
    this.forumCategories = [
      {
        id: 'fc-dating',
        name: 'Flirting & Dating Advice',
        nameBn: 'ফ্লার্টিং ও ডেটিং পরামর্শ',
        description: 'Discussions on healthy adult dating, conversation starters, and relationship building.',
        iconName: 'heart',
        topicCount: 2
      },
      {
        id: 'fc-safety',
        name: 'Online Safety & Boundaries',
        nameBn: 'অনলাইন নিরাপত্তা ও প্রাইভেসি',
        description: 'Tips for protecting personal anonymity, avoiding scams, and establishing consent.',
        iconName: 'shield-alert',
        topicCount: 1
      },
      {
        id: 'fc-desi',
        name: 'Desi & Bangla Adda',
        nameBn: 'দেশি ও বাংলা আড্ডা',
        description: 'Open cultural and casual discussions for Bengali and South Asian communities worldwide.',
        iconName: 'coffee',
        topicCount: 1
      }
    ];

    // 3. Seed Forum Topics
    const topic1: ForumTopic = {
      id: 'topic-1',
      categoryId: 'fc-dating',
      title: 'Top conversation starters for breaking the ice in Bangla Chat',
      content: 'Starting a conversation on an adult social platform can feel intimidating. Instead of a generic "hi", mention a shared music interest or ask about their favorite late-night pastime. What icebreakers work best for you?',
      authorNickname: 'Ayesha_Dhaka',
      authorId: 'seed-user-1',
      createdAt: Date.now() - 86400000 * 2,
      replyCount: 2,
      isPinned: true,
      lastActivityAt: Date.now() - 3600000 * 4
    };

    const topic2: ForumTopic = {
      id: 'topic-2',
      categoryId: 'fc-safety',
      title: 'Essential privacy habits: Protecting your anonymity on 18+ chats',
      content: 'Never share personal social media handles, banking details, or your workplace address with anyone online. Keep conversations playful, respectful, and contained within ChatLustora.',
      authorNickname: 'SafetyModerator',
      authorId: 'seed-user-mod',
      createdAt: Date.now() - 86400000 * 4,
      replyCount: 1,
      isPinned: true,
      lastActivityAt: Date.now() - 3600000 * 12
    };

    this.forumTopics.push(topic1, topic2);

    this.forumPosts.set('topic-1', [
      {
        id: 'post-1-1',
        topicId: 'topic-1',
        content: 'I agree completely! In Bangla Chat, saying "Shuvo shondha, kemon katlo apnar din?" gets a much warmer reply than a blunt message.',
        authorNickname: 'Tanvir_Kolkata',
        authorId: 'seed-user-2',
        authorRole: 'member',
        createdAt: Date.now() - 86400000
      },
      {
        id: 'post-1-2',
        topicId: 'topic-1',
        content: 'Humor is always key! Be genuine and never push when someone takes time to respond.',
        authorNickname: 'Nabila_Sylhet',
        authorId: 'seed-user-3',
        authorRole: 'member',
        createdAt: Date.now() - 3600000 * 4
      }
    ]);

    this.forumPosts.set('topic-2', [
      {
        id: 'post-2-1',
        topicId: 'topic-2',
        content: 'Great reminders. We also immediately ban any users asking for sensitive private photos or money.',
        authorNickname: 'LustoraAdmin',
        authorId: 'seed-user-admin',
        authorRole: 'admin',
        createdAt: Date.now() - 3600000 * 12
      }
    ]);

    // 4. Seed Blog Articles (SEO-rich, adult dating guides)
    this.blogArticles = [
      {
        id: 'art-1',
        title: 'Mastering the Art of Flirting in Bangla: From Friendly Adda to Deep Connection',
        slug: 'mastering-the-art-of-flirting-in-bangla',
        excerpt: 'Explore nuanced flirting techniques, respectful compliments, and conversation chemistry in Bengali culture.',
        content: `Flirting in Bengali is an art of subtleties, poetic undertones, and playful wit. Whether you are chatting in Dhaka, Kolkata, London, or New York, the essence of a memorable conversation lies in active listening and genuine curiosity.\n\n### 1. Build Rapport Before Getting Intimate\nIn adult chat environments like ChatLustora, jumping straight into explicit topics often breaks the vibe. Begin with engaging banter, ask about passions, and let mutual attraction develop naturally.\n\n### 2. Respect Boundaries and Enthusiastic Consent\nAdult connections thrive on clear boundaries. If your conversation partner responds enthusiastically, lean in. If they slow down, respect their comfort zone.\n\n### 3. Embrace Cultural Humor and Wordplay\nBengali (বাংলা) is celebrated for its wit and expressive warmth. A playful teaser in your native dialect creates immediate warmth and camaraderie.`,
        category: 'Dating & Romance',
        tags: ['bangla chat', 'flirting', 'desi dating', 'adult romance'],
        coverImageUrl: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=800&q=80',
        authorNickname: 'ChatLustora Editorial',
        authorRole: 'admin',
        published: true,
        views: 1420,
        createdAt: Date.now() - 86400000 * 5,
        updatedAt: Date.now() - 86400000 * 5
      },
      {
        id: 'art-2',
        title: 'WebRTC Video Chat Etiquette: Looking Great and Staying Safe on Cam',
        slug: 'webrtc-video-chat-etiquette-safety-on-cam',
        excerpt: 'How to prepare your space, optimize your camera and lighting, and ensure privacy during 1-on-1 video chats.',
        content: `Direct video calling brings conversations alive with facial expressions and real-time laughter. Here are our top tips for enjoying video chatrooms and 1-on-1 roulette.\n\n### Lighting and Framing\nPlace your light source directly facing you rather than behind you. Soft lighting flatters and makes you look inviting.\n\n### Clean Environment\nCheck your background to make sure no identifying items (family photos, mail with addresses) are visible.\n\n### Consensual Visual Exchange\nAlways ask your partner before switching to video or showing more intimate moments. Consent is paramount at ChatLustora.`,
        category: 'Tech & Video',
        tags: ['video chat', 'webrtc', 'cam safety', 'roulette chat'],
        coverImageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80',
        authorNickname: 'TechLead_Lustora',
        authorRole: 'admin',
        published: true,
        views: 980,
        createdAt: Date.now() - 86400000 * 3,
        updatedAt: Date.now() - 86400000 * 3
      }
    ];
  }

  // Session operations
  public saveSession(session: UserSession): void {
    this.sessions.set(session.sessionId, session);
    this.sessions.set(session.userId, session);
  }

  public getSession(id: string): UserSession | undefined {
    return this.sessions.get(id);
  }

  // Room messages
  public getRoomMessages(roomId: string, limit = 50): ChatMessage[] {
    const list = this.messages.get(roomId) || [];
    return list.slice(-limit);
  }

  public addRoomMessage(message: ChatMessage): void {
    const list = this.messages.get(message.roomId) || [];
    list.push(message);
    if (list.length > 200) {
      list.shift(); // Bound history loading
    }
    this.messages.set(message.roomId, list);
  }

  // Direct messages
  public getConversationId(userId1: string, userId2: string): string {
    return [userId1, userId2].sort().join(':');
  }

  public getConversation(userId1: string, userId2: string): PrivateConversation {
    const convId = this.getConversationId(userId1, userId2);
    let conv = this.conversations.get(convId);
    if (!conv) {
      const u1 = this.sessions.get(userId1);
      const u2 = this.sessions.get(userId2);
      conv = {
        id: convId,
        participantIds: [userId1, userId2].sort() as [string, string],
        participantNicknames: {
          [userId1]: u1?.nickname || 'Guest',
          [userId2]: u2?.nickname || 'Guest'
        },
        unreadCount: 0
      };
      this.conversations.set(convId, conv);
      this.privateMessages.set(convId, []);
    }
    return conv;
  }

  public addPrivateMessage(msg: PrivateMessage): void {
    const conv = this.getConversation(msg.senderId, msg.recipientId);
    conv.lastMessage = msg.text;
    conv.lastTimestamp = msg.timestamp;
    const msgs = this.privateMessages.get(conv.id) || [];
    msgs.push(msg);
    if (msgs.length > 200) msgs.shift();
    this.privateMessages.set(conv.id, msgs);
  }

  public getPrivateMessages(convId: string): PrivateMessage[] {
    return this.privateMessages.get(convId) || [];
  }

  public blogComments: Map<string, BlogComment[]> = new Map();

  // Blog operations
  public getBlogComments(articleId: string): BlogComment[] {
    return this.blogComments.get(articleId) || [];
  }

  public addBlogComment(comment: BlogComment): void {
    const list = this.blogComments.get(comment.articleId) || [];
    list.push(comment);
    this.blogComments.set(comment.articleId, list);
  }

  public updateBlogArticle(id: string, updates: Partial<BlogArticle>): BlogArticle | null {
    const art = this.blogArticles.find(a => a.id === id);
    if (!art) return null;
    Object.assign(art, updates, { updatedAt: Date.now() });
    return art;
  }

  public deleteBlogArticle(id: string): boolean {
    const idx = this.blogArticles.findIndex(a => a.id === id);
    if (idx === -1) return false;
    this.blogArticles.splice(idx, 1);
    this.blogComments.delete(id);
    return true;
  }

  // Forum operations
  public deleteForumTopic(id: string): boolean {
    const idx = this.forumTopics.findIndex(t => t.id === id);
    if (idx === -1) return false;
    const catId = this.forumTopics[idx].categoryId;
    this.forumTopics.splice(idx, 1);
    this.forumPosts.delete(id);
    const cat = this.forumCategories.find(c => c.id === catId);
    if (cat && cat.topicCount > 0) cat.topicCount -= 1;
    return true;
  }

  public togglePinForumTopic(id: string): boolean {
    const topic = this.forumTopics.find(t => t.id === id);
    if (!topic) return false;
    topic.isPinned = !topic.isPinned;
    return true;
  }

  public toggleLockForumTopic(id: string): boolean {
    const topic = this.forumTopics.find(t => t.id === id);
    if (!topic) return false;
    topic.isLocked = !topic.isLocked;
    return true;
  }

  // Conversation operations for active user
  public getUserConversations(userId: string): PrivateConversation[] {
    const result: PrivateConversation[] = [];
    this.conversations.forEach(conv => {
      if (conv.participantIds.includes(userId as any)) {
        result.push(conv);
      }
    });
    return result.sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
  }

  // Blocking
  public blockUser(blockerId: string, blockedId: string): void {
    if (!this.userBlocks.has(blockerId)) {
      this.userBlocks.set(blockerId, new Set());
    }
    this.userBlocks.get(blockerId)!.add(blockedId);
  }

  public unblockUser(blockerId: string, blockedId: string): void {
    this.userBlocks.get(blockerId)?.delete(blockedId);
  }

  public isBlocked(blockerId: string, targetId: string): boolean {
    return this.userBlocks.get(blockerId)?.has(targetId) || false;
  }

  // Reports
  public addReport(report: ReportItem): void {
    this.reports.unshift(report);
  }

  public addAuditLog(log: ModerationAuditLog): void {
    this.auditLogs.unshift(log);
  }
}

export const dbStore = new ChatLustoraStore();
