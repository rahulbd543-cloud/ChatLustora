-- ============================================================================
-- ChatLustora Database Schema & Migrations (Supabase PostgreSQL)
-- Target Domain: ChatLustora.com
-- Adults-Only Social Chat, Dating & Private Messaging Platform
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ROOMS TABLE (Canonical 23 Initial Rooms)
CREATE TABLE IF NOT EXISTS public.rooms (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('General', 'Adult', 'International', 'Social', 'Regional')),
  language VARCHAR(20) NOT NULL,
  features JSONB DEFAULT '{}'::jsonb,
  is_age_restricted BOOLEAN DEFAULT true,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_slug ON public.rooms (slug);
CREATE INDEX IF NOT EXISTS idx_rooms_category ON public.rooms (category);

-- 2. GUEST SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.guest_sessions (
  session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(64) NOT NULL UNIQUE,
  nickname VARCHAR(40) NOT NULL,
  role VARCHAR(20) DEFAULT 'guest' CHECK (role IN ('guest', 'member', 'moderator', 'admin')),
  is_adult_confirmed BOOLEAN NOT NULL DEFAULT false,
  terms_accepted BOOLEAN NOT NULL DEFAULT false,
  ip_hash VARCHAR(128),
  avatar_seed VARCHAR(64),
  is_muted BOOLEAN DEFAULT false,
  mute_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.guest_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.guest_sessions (expires_at);

-- 3. CHAT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id VARCHAR(64) NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  sender_id VARCHAR(64) NOT NULL,
  sender_nickname VARCHAR(40) NOT NULL,
  sender_role VARCHAR(20) DEFAULT 'guest',
  sender_avatar_seed VARCHAR(64),
  text TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON public.chat_messages (room_id, created_at DESC);

-- 4. PRIVATE CONVERSATIONS & MESSAGES
CREATE TABLE IF NOT EXISTS public.private_conversations (
  id VARCHAR(128) PRIMARY KEY,
  participant_1 VARCHAR(64) NOT NULL,
  participant_2 VARCHAR(64) NOT NULL,
  last_message TEXT,
  last_timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_private_conv_p1 ON public.private_conversations (participant_1);
CREATE INDEX IF NOT EXISTS idx_private_conv_p2 ON public.private_conversations (participant_2);

CREATE TABLE IF NOT EXISTS public.private_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id VARCHAR(128) NOT NULL REFERENCES public.private_conversations(id) ON DELETE CASCADE,
  sender_id VARCHAR(64) NOT NULL,
  recipient_id VARCHAR(64) NOT NULL,
  sender_nickname VARCHAR(40) NOT NULL,
  text TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_private_messages_conv_created ON public.private_messages (conversation_id, created_at ASC);

-- 5. BLOG ARTICLES & COMMENTS
CREATE TABLE IF NOT EXISTS public.blog_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(80) NOT NULL,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  cover_image_url TEXT,
  author_nickname VARCHAR(40) NOT NULL,
  author_role VARCHAR(20) DEFAULT 'admin',
  published BOOLEAN DEFAULT true,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_slug ON public.blog_articles (slug);
CREATE INDEX IF NOT EXISTS idx_blog_published ON public.blog_articles (published, created_at DESC);

CREATE TABLE IF NOT EXISTS public.blog_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES public.blog_articles(id) ON DELETE CASCADE,
  author_nickname VARCHAR(40) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_comments_article ON public.blog_comments (article_id, created_at ASC);

-- 6. COMMUNITY FORUM
CREATE TABLE IF NOT EXISTS public.forum_categories (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  name_bn VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  icon_name VARCHAR(50) DEFAULT 'message-square',
  topic_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.forum_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id VARCHAR(64) NOT NULL REFERENCES public.forum_categories(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  author_nickname VARCHAR(40) NOT NULL,
  author_id VARCHAR(64) NOT NULL,
  reply_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_topics_cat ON public.forum_topics (category_id, is_pinned DESC, last_activity_at DESC);

CREATE TABLE IF NOT EXISTS public.forum_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID NOT NULL REFERENCES public.forum_topics(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  quote_content TEXT,
  quote_author VARCHAR(40),
  author_nickname VARCHAR(40) NOT NULL,
  author_id VARCHAR(64) NOT NULL,
  author_role VARCHAR(20) DEFAULT 'guest',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_topic ON public.forum_posts (topic_id, created_at ASC);

-- 7. MODERATION, REPORTS & BLOCKS
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_nickname VARCHAR(40) NOT NULL,
  reporter_id VARCHAR(64) NOT NULL,
  target_id VARCHAR(64) NOT NULL,
  target_nickname VARCHAR(40) NOT NULL,
  reason VARCHAR(50) NOT NULL,
  notes TEXT,
  room_id VARCHAR(64),
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'action_taken', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  moderator_nickname VARCHAR(40) NOT NULL,
  action VARCHAR(50) NOT NULL,
  target_nickname VARCHAR(40) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id VARCHAR(64) NOT NULL,
  blocked_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

-- Public can read rooms, published articles, forum topics & posts
CREATE POLICY "Public read rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Public read published blog" ON public.blog_articles FOR SELECT USING (published = true);
CREATE POLICY "Public read forum categories" ON public.forum_categories FOR SELECT USING (true);
CREATE POLICY "Public read forum topics" ON public.forum_topics FOR SELECT USING (true);
CREATE POLICY "Public read forum posts" ON public.forum_posts FOR SELECT USING (true);

-- Authenticated/Active guests read messages in their rooms
CREATE POLICY "Public read chat messages" ON public.chat_messages FOR SELECT USING (true);

-- ============================================================================
-- SEED DATA: 23 AUTHORITATIVE ROOMS
-- ============================================================================
INSERT INTO public.rooms (id, name, slug, description, category, language, features, tags) VALUES
('room-1', 'Bangla Chat', '/bangla-chat', 'General Bangla community chatroom for open conversations.', 'General', 'bn', '{}', ARRAY['bangla', 'bengali', 'community', 'adda']),
('room-2', 'Sex Chat', '/sex-chat', 'A main adult group chatroom for conversations with other adults.', 'Adult', 'mixed', '{}', ARRAY['adult', '18+', 'desi', 'intimate']),
('room-3', 'Adult Chat', '/adult-chat', 'A general room for adult conversations and social interaction.', 'Adult', 'mixed', '{}', ARRAY['adult', 'flirting', 'dating', 'singles']),
('room-4', 'Video Chat', '/video-chat', 'A video-focused room for adults who want to connect through webcam.', 'Adult', 'mixed', '{"webrtc": true}', ARRAY['video', 'webrtc', 'cam', 'live']),
('room-5', 'Roulette Chat', '/roulette-chat', 'One-to-one random matching between consenting adult users with an active Skip action.', 'Adult', 'mixed', '{"roulette": true, "webrtc": true}', ARRAY['roulette', 'random', 'skip', 'speed-dating']),
('room-6', 'Gay Chat', '/gay-chat', 'An inclusive space for gay and bisexual adult men.', 'Adult', 'mixed', '{}', ARRAY['lgbtq', 'gay', 'bisexual', 'men']),
('room-7', 'Lesbian Chat', '/lesbian-chat', 'A dedicated space for lesbian and bisexual adult women.', 'Adult', 'mixed', '{}', ARRAY['lgbtq', 'lesbian', 'women', 'queer']),
('room-8', 'Couples Chat', '/couples-chat', 'A social room for adult couples and singles.', 'Adult', 'mixed', '{}', ARRAY['couples', 'swingers', 'open', 'dating']),
('room-9', 'Roleplay Chat', '/roleplay-chat', 'A room for consensual adult roleplay and storytelling.', 'Adult', 'mixed', '{}', ARRAY['roleplay', 'fantasy', 'storytelling', 'erotic']),
('room-10', 'BDSM Chat', '/bdsm-chat', 'A room for adults to discuss consensual kink and fetish interests.', 'Adult', 'mixed', '{}', ARRAY['kink', 'bdsm', 'fetish', 'consensual']),
('room-11', 'English Chat', '/english-chat', 'An English-language chatroom.', 'International', 'en', '{}', ARRAY['english', 'global', 'international', 'chat']),
('room-12', 'Asian Chat', '/asian-chat', 'A general chatroom for people interested in connecting across Asia.', 'International', 'mixed', '{}', ARRAY['asia', 'asian', 'eastern', 'friends']),
('room-13', 'International Chat', '/international-chat', 'A global room for conversations between people from different countries.', 'International', 'mixed', '{}', ARRAY['worldwide', 'cross-cultural', 'foreign', 'travel']),
('room-14', 'Friendship Chat', '/friendship-chat', 'A room for making friends and having friendly conversations.', 'Social', 'mixed', '{}', ARRAY['friends', 'casual', 'social', 'bonding']),
('room-15', 'Mature Chat', '/mature-chat', 'A dedicated social chatroom for adult users aged 18 and older.', 'Adult', 'mixed', '{}', ARRAY['mature', 'experienced', 'dating', 'adults']),
('room-16', 'USA Chat', '/usa-chat', 'A regional chatroom for users interested in connecting with people from the United States.', 'Regional', 'mixed', '{}', ARRAY['usa', 'america', 'states', 'diaspora']),
('room-17', 'Indian Chat', '/indian-chat', 'An Indian-language chatroom.', 'Regional', 'mixed', '{}', ARRAY['india', 'desi', 'bharat', 'hindi']),
('room-18', 'Bangladeshi Chat', '/bangladeshi-chat', 'A Bangladeshi-language chatroom.', 'Regional', 'mixed', '{}', ARRAY['bangladesh', 'dhaka', 'bengali', 'deshi']),
('room-19', 'Pakistani Chat', '/pakistani-chat', 'A Pakistani-language chatroom.', 'Regional', 'mixed', '{}', ARRAY['pakistan', 'desi', 'urdu', 'lahore']),
('room-20', 'German Chat', '/german-chat', 'A German-language chatroom.', 'Regional', 'de', '{}', ARRAY['deutsch', 'germany', 'berlin', 'deutschland']),
('room-21', 'Hindi Chat', '/hindi-chat', 'A dedicated room for Hindi-language conversations.', 'Regional', 'hi', '{}', ARRAY['hindi', 'india', 'bollywood', 'desi']),
('room-22', 'Tamil Chat', '/tamil-chat', 'A dedicated room for Tamil-language conversations.', 'Regional', 'ta', '{}', ARRAY['tamil', 'chennai', 'south-india', 'tamizhan']),
('room-23', 'West Bengal Chat', '/west-bengal-chat', 'A regional room for people interested in connecting around West Bengal and Bengali-language conversations.', 'Regional', 'bn', '{}', ARRAY['kolkata', 'west-bengal', 'bengali', 'adda'])
ON CONFLICT (id) DO NOTHING;

-- SEED FORUM CATEGORIES
INSERT INTO public.forum_categories (id, name, name_bn, description, icon_name, topic_count) VALUES
('fc-dating', 'Flirting & Dating Advice', 'ফ্লার্টিং ও ডেটিং পরামর্শ', 'Discussions on healthy adult dating, conversation starters, and relationship building.', 'heart', 1),
('fc-safety', 'Online Safety & Boundaries', 'অনলাইন নিরাপত্তা ও প্রাইভেসি', 'Tips for protecting personal anonymity, avoiding scams, and establishing consent.', 'shield-alert', 1),
('fc-desi', 'Desi & Bangla Adda', 'দেশি ও বাংলা আড্ডা', 'Open cultural and casual discussions for Bengali and South Asian communities worldwide.', 'coffee', 1)
ON CONFLICT (id) DO NOTHING;
