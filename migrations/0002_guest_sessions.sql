-- ChatLustora persistent guest sessions.
-- Local migration file only. Do not apply remotely without approval.

CREATE TABLE IF NOT EXISTS guest_profiles (
  user_id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  avatar_seed TEXT NOT NULL,
  gender TEXT NOT NULL,
  is_gender_visible INTEGER NOT NULL DEFAULT 1,
  date_of_birth TEXT NOT NULL,
  is_adult_confirmed INTEGER NOT NULL DEFAULT 1,
  terms_accepted INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  ip_hash TEXT,
  is_muted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS guest_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES guest_profiles(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_user_id
ON guest_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_expires_at
ON guest_sessions (expires_at);
