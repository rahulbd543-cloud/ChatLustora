-- ChatLustora moderation foundation.
-- Apply to STAGING only after reviewing the existing D1 schema.

ALTER TABLE users
ADD COLUMN role TEXT NOT NULL DEFAULT 'member'
CHECK (role IN ('member', 'moderator', 'admin'));

CREATE TABLE IF NOT EXISTS room_moderators (
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS room_bans (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_room_bans_lookup
ON room_bans (room_id, user_id, expires_at);

CREATE TABLE IF NOT EXISTS room_mutes (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_room_mutes_lookup
ON room_mutes (room_id, user_id, expires_at);

CREATE TABLE IF NOT EXISTS moderation_audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  actor_nickname TEXT NOT NULL,
  action TEXT NOT NULL CHECK (
    action IN (
      'warn', 'kick', 'mute', 'unmute',
      'ban', 'unban', 'report_review', 'dismiss'
    )
  ),
  target_id TEXT,
  room_id TEXT,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_moderation_audit_created
ON moderation_audit_logs (created_at DESC);

ALTER TABLE reports
ADD COLUMN room_id TEXT;

ALTER TABLE reports
ADD COLUMN notes TEXT NOT NULL DEFAULT '';

ALTER TABLE reports
ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'
CHECK (status IN ('pending', 'reviewed', 'action_taken', 'dismissed'));

ALTER TABLE reports
ADD COLUMN reviewed_by TEXT;

ALTER TABLE reports
ADD COLUMN reviewed_at INTEGER;
