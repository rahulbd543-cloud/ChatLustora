/**
 * Shared Type Definitions for ChatLustora
 */

export type GenderType = 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';

export interface UserSession {
  sessionId: string;
  userId: string;
  nickname: string;
  role: UserRole;
  isAdultConfirmed: boolean;
  termsAccepted: boolean;
  gender: GenderType;
  dateOfBirth?: string; // stored securely, not public
  isGenderVisible: boolean;
  createdAt: number;
  expiresAt: number;
  avatarSeed: string;
  ipHash?: string;
  isMuted?: boolean;
  muteUntil?: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderNickname: string;
  senderRole: UserRole;
  senderAvatarSeed: string;
  senderGender: GenderType;
  senderIsGenderVisible: boolean;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface PrivateMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  senderNickname: string;
  senderGender?: GenderType;
  senderIsGenderVisible?: boolean;
  text: string;
  timestamp: number;
  isRead: boolean;
}

export interface PrivateConversation {
  id: string;
  participantIds: [string, string];
  participantNicknames: Record<string, string>;
  participantGenders?: Record<string, GenderType>;
  participantGenderVisibilities?: Record<string, boolean>;
  lastMessage?: string;
  lastTimestamp?: number;
  unreadCount?: number;
}

export interface OnlineUser {
  userId: string;
  nickname: string;
  role: UserRole;
  avatarSeed: string;
  gender: GenderType;
  isGenderVisible: boolean;
  currentRoomId?: string;
  isCalling?: boolean;
}

// WebRTC Signaling Types
export type CallType = 'audio' | 'video';

export interface CallInvite {
  callId: string;
  callerId: string;
  callerNickname: string;
  recipientId: string;
  type: CallType;
}

export interface CallSignalPayload {
  callId: string;
  fromUserId: string;
  toUserId: string;
  signalType: 'offer' | 'answer' | 'ice-candidate';
  signalData: any;
}

// Roulette Types
export type RouletteState = 'idle' | 'queued' | 'matched' | 'skipped';

export interface RouletteMatch {
  matchId: string;
  partnerId: string;
  partnerNickname: string;
  partnerAvatarSeed: string;
  startedAt: number;
}

// Blog Types
export interface BlogArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  coverImageUrl?: string;
  authorNickname: string;
  authorRole: UserRole;
  published: boolean;
  views: number;
  createdAt: number;
  updatedAt: number;
}

export interface BlogComment {
  id: string;
  articleId: string;
  authorNickname: string;
  content: string;
  createdAt: number;
}

// Forum Types
export interface ForumCategory {
  id: string;
  name: string;
  nameBn: string;
  description: string;
  iconName: string;
  topicCount: number;
}

export interface ForumTopic {
  id: string;
  categoryId: string;
  title: string;
  content: string;
  authorNickname: string;
  authorId: string;
  createdAt: number;
  replyCount: number;
  isPinned?: boolean;
  isLocked?: boolean;
  lastActivityAt: number;
}

export interface ForumPost {
  id: string;
  topicId: string;
  content: string;
  quoteContent?: string;
  quoteAuthor?: string;
  authorNickname: string;
  authorId: string;
  authorRole: UserRole;
  createdAt: number;
}

// Moderation & Reports
export interface ReportItem {
  id: string;
  reporterNickname: string;
  reporterId: string;
  targetId: string;
  targetNickname: string;
  reason: 'harassment' | 'underage_suspicion' | 'spam' | 'non_consensual' | 'other';
  notes: string;
  roomId?: string;
  timestamp: number;
  status: 'pending' | 'reviewed' | 'action_taken' | 'dismissed';
}

export interface ModerationAuditLog {
  id: string;
  moderatorNickname: string;
  action: 'warn' | 'mute' | 'ban' | 'delete_message' | 'delete_topic' | 'pin_topic';
  targetNickname: string;
  reason: string;
  timestamp: number;
}
