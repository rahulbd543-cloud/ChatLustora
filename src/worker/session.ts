export type ResolvedSession = {
  userId: string;
  nickname: string;
  role: 'guest' | 'member' | 'moderator' | 'admin';
  avatarSeed: string;
  gender?: string;
  isGenderVisible?: boolean;
  email?: string;
  sessionType: 'guest' | 'member';
  sessionId: string;
};

function readCookie(cookieHeader: string, name: string): string | null {
  const prefix = `${name}=`;

  const item = cookieHeader
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(prefix));

  if (!item) return null;

  const value = item.slice(prefix.length);
  if (!value) return null;

  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export async function resolveWorkerSession(
  db: D1Database,
  cookieHeader: string
): Promise<ResolvedSession | null> {
  // Registered member session takes precedence when both cookies exist.
  const memberSessionId = readCookie(cookieHeader, 'session_id');

  if (memberSessionId) {
    const member = await db.prepare(`
      SELECT
        s.id AS session_id,
        u.id AS user_id,
        u.username,
        u.email,
        u.role
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > ?
      LIMIT 1
    `).bind(memberSessionId, Date.now()).first<{
      session_id: string;
      user_id: string;
      username: string;
      email: string | null;
      role: string | null;
    }>();

    if (member) {
      const allowedRoles = ['member', 'moderator', 'admin'] as const;
      const role = allowedRoles.includes(member.role as typeof allowedRoles[number])
        ? member.role as ResolvedSession['role']
        : 'member';

      return {
        userId: member.user_id,
        nickname: member.username || 'User',
        role,
        avatarSeed: member.user_id,
        email: member.email || undefined,
        sessionType: 'member',
        sessionId: member.session_id
      };
    }
  }

  // Guest sessions are stored separately from registered users.
  const guestSessionId = readCookie(cookieHeader, 'chatlustora_session');

  if (!guestSessionId) return null;

  const guest = await db.prepare(`
    SELECT
      s.id AS session_id,
      p.user_id,
      p.nickname,
      p.avatar_seed,
      p.gender,
      p.is_gender_visible
    FROM guest_sessions s
    JOIN guest_profiles p ON p.user_id = s.user_id
    WHERE s.id = ? AND s.expires_at > ?
    LIMIT 1
  `).bind(guestSessionId, Date.now()).first<{
    session_id: string;
    user_id: string;
    nickname: string;
    avatar_seed: string;
    gender: string;
    is_gender_visible: number;
  }>();

  if (!guest) return null;

  return {
    userId: guest.user_id,
    nickname: guest.nickname,
    role: 'guest',
    avatarSeed: guest.avatar_seed,
    gender: guest.gender,
    isGenderVisible: Boolean(guest.is_gender_visible),
    sessionType: 'guest',
    sessionId: guest.session_id
  };
}
