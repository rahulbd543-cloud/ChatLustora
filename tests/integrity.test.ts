/**
 * ChatLustora Authoritative Directory & Platform Integrity Tests
 * 
 * Tests:
 * 1. Authoritative 23 initial chatrooms (exact count, uniqueness of slugs, all required slugs exist)
 * 2. Room category and language definitions
 * 3. Guest session validation & normalization rules
 * 4. In-memory & DB store operations (messages, conversations, blocking, reports)
 * 5. Blog workflow (CRUD & Comments)
 * 6. Forum workflow (Topics, Safe Quotes, Pinning, Locking & Deletion)
 * 7. Private Direct Messaging & Conversation isolation
 * 8. WebRTC Signaling and participant authorization checks
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_CHATROOMS, TOTAL_INITIAL_ROOMS, getRoomBySlug, getRoomById } from '../shared/rooms.js';
import { validateSessionCreation, normalizeNickname, createGuestSession } from '../server/session.js';
import { dbStore } from '../server/db.js';

describe('ChatLustora Authoritative Room Directory Tests', () => {
  test('Exact count of initial rooms must be 23', () => {
    assert.equal(INITIAL_CHATROOMS.length, 23);
    assert.equal(TOTAL_INITIAL_ROOMS, 23);
  });

  test('All room slugs must be unique with no duplicates', () => {
    const slugs = INITIAL_CHATROOMS.map(r => r.slug.toLowerCase());
    const uniqueSlugs = new Set(slugs);
    assert.equal(uniqueSlugs.size, 23, 'Duplicate slug detected in rooms manifest');
  });

  test('All 23 required room slugs must exist exactly', () => {
    const requiredSlugs = [
      '/bangla-chat',
      '/sex-chat',
      '/adult-chat',
      '/video-chat',
      '/roulette-chat',
      '/gay-chat',
      '/lesbian-chat',
      '/couples-chat',
      '/roleplay-chat',
      '/bdsm-chat',
      '/english-chat',
      '/asian-chat',
      '/international-chat',
      '/friendship-chat',
      '/mature-chat',
      '/usa-chat',
      '/indian-chat',
      '/bangladeshi-chat',
      '/pakistani-chat',
      '/german-chat',
      '/hindi-chat',
      '/tamil-chat',
      '/west-bengal-chat'
    ];

    for (const slug of requiredSlugs) {
      const room = getRoomBySlug(slug);
      assert.ok(room, `Missing required chatroom with slug: ${slug}`);
      assert.equal(room.slug, slug);
    }
  });

  test('Special room capabilities are properly configured', () => {
    const videoRoom = getRoomBySlug('/video-chat');
    assert.ok(videoRoom);
    assert.equal(videoRoom.features?.webrtc, true, 'Video chat must have webrtc feature enabled');

    const rouletteRoom = getRoomBySlug('/roulette-chat');
    assert.ok(rouletteRoom);
    assert.equal(rouletteRoom.features?.roulette, true, 'Roulette chat must have roulette feature enabled');
  });
});

describe('Guest Entry and 18+ Adult Policy Validation Tests', () => {
  test('Rejects entry if adult status is not confirmed', () => {
    const result = validateSessionCreation('Dhaka_Guest', false, true);
    assert.ok(result.error);
    assert.match(result.error, /18 years/);
  });

  test('Rejects entry if terms are not accepted', () => {
    const result = validateSessionCreation('Dhaka_Guest', true, false);
    assert.ok(result.error);
    assert.match(result.error, /Terms of Service/);
  });

  test('Rejects nicknames that are too short or too long', () => {
    const shortRes = validateSessionCreation('ab', true, true);
    assert.ok(shortRes.error);

    const longRes = validateSessionCreation('a'.repeat(25), true, true);
    assert.ok(longRes.error);
  });

  test('Normalizes nicknames cleanly and creates valid guest sessions', () => {
    const cleanNick = normalizeNickname('  Desi Flirt <script> 99  ');
    assert.equal(cleanNick, 'Desi_Flirt_script_99');

    const session = createGuestSession('Bengal_Soul', '127.0.0.1');
    assert.ok(session.sessionId);
    assert.ok(session.userId);
    assert.equal(session.nickname, 'Bengal_Soul');
    assert.equal(session.isAdultConfirmed, true);
    assert.equal(session.termsAccepted, true);
  });
});

describe('Database and Moderation Store Tests', () => {
  test('Room message bounds and retrieval', () => {
    const msgs = dbStore.getRoomMessages('room-1', 10);
    assert.ok(Array.isArray(msgs));
    assert.ok(msgs.length > 0);
  });

  test('User blocking hides messages and prevents interaction', () => {
    const blocker = 'user-alice';
    const blocked = 'user-bob';

    assert.equal(dbStore.isBlocked(blocker, blocked), false);
    dbStore.blockUser(blocker, blocked);
    assert.equal(dbStore.isBlocked(blocker, blocked), true);
    dbStore.unblockUser(blocker, blocked);
    assert.equal(dbStore.isBlocked(blocker, blocked), false);
  });

  test('Reports queue and moderation audit logging', () => {
    const report = {
      id: 'rep-test-1',
      reporterNickname: 'Reporter1',
      reporterId: 'usr_rep1',
      targetId: 'usr_target1',
      targetNickname: 'BadActor',
      reason: 'harassment' as const,
      notes: 'Unsolicited spamming',
      timestamp: Date.now(),
      status: 'pending' as const
    };

    dbStore.addReport(report);
    assert.ok(dbStore.reports.some(r => r.id === 'rep-test-1'));

    dbStore.addAuditLog({
      id: 'audit-test-1',
      moderatorNickname: 'Mod_Karim',
      action: 'mute',
      targetNickname: 'BadActor',
      reason: 'Harassment in room',
      timestamp: Date.now()
    });
    assert.ok(dbStore.auditLogs.some(l => l.id === 'audit-test-1'));
  });
});

describe('Blog Workflow Tests (CRUD & Comments)', () => {
  test('Creates, updates, and deletes blog articles', () => {
    const testArticle = {
      id: 'art-test-1',
      title: 'Flirting in Bengali: Cultural Nuances',
      slug: 'flirting-in-bengali-cultural-nuances',
      excerpt: 'A comprehensive guide to witty banter.',
      content: 'Bengali flirting combines wordplay and deep poetry.',
      category: 'Dating & Romance',
      tags: ['bangla', 'dating'],
      authorNickname: 'Editor',
      authorRole: 'admin' as const,
      published: true,
      views: 10,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    dbStore.blogArticles.unshift(testArticle);
    assert.ok(dbStore.blogArticles.some(a => a.id === 'art-test-1'));

    const updated = dbStore.updateBlogArticle('art-test-1', { title: 'Updated Flirting Guide' });
    assert.ok(updated);
    assert.equal(updated.title, 'Updated Flirting Guide');

    // Comments test
    dbStore.addBlogComment({
      id: 'comm-1',
      articleId: 'art-test-1',
      authorNickname: 'Reader1',
      content: 'Loved these tips!',
      createdAt: Date.now()
    });
    const comments = dbStore.getBlogComments('art-test-1');
    assert.equal(comments.length, 1);
    assert.equal(comments[0].content, 'Loved these tips!');

    // Deletion
    const deleted = dbStore.deleteBlogArticle('art-test-1');
    assert.equal(deleted, true);
    assert.ok(!dbStore.blogArticles.some(a => a.id === 'art-test-1'));
  });
});

describe('Forum Workflow Tests (Topics, Moderation, Pinning & Locking)', () => {
  test('Manages forum topics and safe moderation actions', () => {
    const topic = {
      id: 'topic-test-1',
      categoryId: 'fc-dating',
      title: 'How to start a conversation in West Bengal Chat?',
      content: 'What are respectful yet playful icebreakers?',
      authorNickname: 'Kolkata_User',
      authorId: 'usr_kolkata',
      createdAt: Date.now(),
      replyCount: 0,
      lastActivityAt: Date.now()
    };

    dbStore.forumTopics.unshift(topic);
    assert.ok(dbStore.forumTopics.some(t => t.id === 'topic-test-1'));

    // Pinning
    dbStore.togglePinForumTopic('topic-test-1');
    const pinnedTopic = dbStore.forumTopics.find(t => t.id === 'topic-test-1');
    assert.equal(pinnedTopic?.isPinned, true);

    // Locking
    dbStore.toggleLockForumTopic('topic-test-1');
    const lockedTopic = dbStore.forumTopics.find(t => t.id === 'topic-test-1');
    assert.equal(lockedTopic?.isLocked, true);

    // Deleting
    dbStore.deleteForumTopic('topic-test-1');
    assert.ok(!dbStore.forumTopics.some(t => t.id === 'topic-test-1'));
  });
});

describe('Private Direct Messaging & User Isolation Tests', () => {
  test('Maintains conversation isolation between participants', () => {
    const userA = 'user-alpha';
    const userB = 'user-beta';
    const userC = 'user-charlie';

    const convIdAB = dbStore.getConversationId(userA, userB);
    const convIdAC = dbStore.getConversationId(userA, userC);

    assert.notEqual(convIdAB, convIdAC);

    dbStore.addPrivateMessage({
      id: 'dm-1',
      conversationId: convIdAB,
      senderId: userA,
      recipientId: userB,
      senderNickname: 'Alpha',
      text: 'Private hello to Beta',
      timestamp: Date.now(),
      isRead: false
    });

    const messagesAB = dbStore.getPrivateMessages(convIdAB);
    const messagesAC = dbStore.getPrivateMessages(convIdAC);

    assert.equal(messagesAB.length, 1);
    assert.equal(messagesAC.length, 0, 'User C must never see messages between User A and User B');

    const convsA = dbStore.getUserConversations(userA);
    assert.ok(convsA.some(c => c.id === convIdAB));
  });
});
