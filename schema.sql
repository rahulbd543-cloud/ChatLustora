-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  language TEXT NOT NULL,
  description TEXT
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_nickname TEXT,
  sender_role TEXT,
  text TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_room_timestamp ON messages(room_id, timestamp DESC);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  participant_1 TEXT NOT NULL,
  participant_2 TEXT NOT NULL
);

-- Private Messages
CREATE TABLE IF NOT EXISTS private_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Blocks
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

-- Seed Initial Rooms
INSERT OR IGNORE INTO rooms (id, slug, name, category, language, description) VALUES
('bangla-chat', '/bangla-chat', 'Bangla Chat', 'General', 'bn', 'General Bangla community chatroom.'),
('sex-chat', '/sex-chat', 'Sex Chat', 'Adult', 'mixed', 'Adult-only group chat.'),
('adult-chat', '/adult-chat', 'Adult Chat', 'Adult', 'mixed', 'General adult conversations.'),
('video-chat', '/video-chat', 'Video Chat', 'Adult', 'mixed', 'Video-focused room.'),
('roulette-chat', '/roulette-chat', 'Roulette Chat', 'Adult', 'mixed', 'Random matching.'),
('gay-chat', '/gay-chat', 'Gay Chat', 'Adult', 'mixed', 'Space for gay men.'),
('lesbian-chat', '/lesbian-chat', 'Lesbian Chat', 'Adult', 'mixed', 'Space for lesbian women.'),
('couples-chat', '/couples-chat', 'Couples Chat', 'Adult', 'mixed', 'Room for couples.'),
('roleplay-chat', '/roleplay-chat', 'Roleplay Chat', 'Adult', 'mixed', 'Adult roleplay.'),
('bdsm-chat', '/bdsm-chat', 'BDSM Chat', 'Adult', 'mixed', 'Kink and fetish discussion.'),
('english-chat', '/english-chat', 'English Chat', 'International', 'en', 'English chatroom.'),
('asian-chat', '/asian-chat', 'Asian Chat', 'International', 'mixed', 'Asian communities.'),
('international-chat', '/international-chat', 'International Chat', 'International', 'mixed', 'Global conversations.'),
('friendship-chat', '/friendship-chat', 'Friendship Chat', 'Social', 'mixed', 'Making friends.'),
('mature-chat', '/mature-chat', 'Mature Chat', 'Adult', 'mixed', '18+ chatroom.'),
('usa-chat', '/usa-chat', 'USA Chat', 'Regional', 'mixed', 'Connecting with USA.'),
('indian-chat', '/indian-chat', 'Indian Chat', 'Regional', 'mixed', 'Indian chatroom.'),
('bangladeshi-chat', '/bangladeshi-chat', 'Bangladeshi Chat', 'Regional', 'mixed', 'Bangladeshi chatroom.'),
('pakistani-chat', '/pakistani-chat', 'Pakistani Chat', 'Regional', 'mixed', 'Pakistani chatroom.'),
('german-chat', '/german-chat', 'German Chat', 'Regional', 'mixed', 'German chatroom.'),
('hindi-chat', '/hindi-chat', 'Hindi Chat', 'Regional', 'mixed', 'Hindi chatroom.'),
('tamil-chat', '/tamil-chat', 'Tamil Chat', 'Regional', 'mixed', 'Tamil chatroom.'),
('west-bengal-chat', '/west-bengal-chat', 'West Bengal Chat', 'Regional', 'mixed', 'West Bengal chatroom.');
