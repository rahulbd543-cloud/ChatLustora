/**
 * ChatLustora Guest Session & Authorization Manager
 */

import crypto from 'crypto';
import { UserSession, UserRole, GenderType } from '../shared/types.js';
import { dbStore } from './db.js';

export const SESSION_COOKIE_NAME = 'chatlustora_session';
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

// Predefined fun Bengali & desi guest handle suggestions
const SUGGESTED_PREFIXES = [
  'Dhaka_Dreamer', 'Bengal_Tiger', 'Padma_Breeze', 'Kolkata_Rhythm',
  'Mystic_Desi', 'Night_Owl', 'Velvet_Soul', 'Chai_Lover',
  'Sylhet_Starlight', 'Chittagong_Vibe', 'Moonlight_BD', 'Desi_Flirt',
  'Secret_Smiles', 'Sunkissed_Bengali', 'Silent_Gaze', 'Urban_Lover'
];

export function generateSuggestedNickname(): string {
  const prefix = SUGGESTED_PREFIXES[Math.floor(Math.random() * SUGGESTED_PREFIXES.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${prefix}_${num}`;
}

export function normalizeNickname(input: string): string {
  return input
    .trim()
    .replace(/[^\w\s-]/gi, '')
    .replace(/\s+/g, '_')
    .slice(0, 20);
}

export function calculateAge(dobString: string): number {
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return -1;
  const today = new Date();
  if (dob > today) return -1;
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export function validateSessionCreation(
  rawNickname: string,
  isAdultConfirmed: boolean,
  termsAccepted: boolean,
  gender?: string,
  dateOfBirth?: string
): { error?: string; nickname?: string; gender?: GenderType; validatedDob?: string } {
  if (!isAdultConfirmed) {
    return { error: 'You must confirm that you are at least 18 years of age to enter.' };
  }
  if (!termsAccepted) {
    return { error: 'You must accept the Terms of Service & Privacy Policy to enter.' };
  }

  // Validate Gender
  const validGenders: GenderType[] = ['male', 'female', 'non-binary', 'prefer-not-to-say'];
  const cleanGender = (gender || 'prefer-not-to-say').toLowerCase().trim() as GenderType;
  if (!validGenders.includes(cleanGender)) {
    return { error: 'Please select a valid gender option.' };
  }

  // Validate Date of Birth & Server-side Age Verification (Must be >= 18)
  if (!dateOfBirth) {
    return { error: 'Date of birth is required for age verification.' };
  }

  const age = calculateAge(dateOfBirth);
  if (age < 0) {
    return { error: 'Invalid or future date of birth provided.' };
  }
  if (age < 18) {
    return { error: 'Access denied. You must be at least 18 years old to register and participate on ChatLustora.' };
  }

  const trimmed = (rawNickname || '').trim();
  if (trimmed.length > 20) {
    return { error: 'Nickname must not exceed 20 characters.' };
  }

  const normalized = normalizeNickname(rawNickname);
  if (!normalized || normalized.length < 3) {
    return { error: 'Nickname must be at least 3 characters long.' };
  }

  return {
    nickname: normalized,
    gender: cleanGender,
    validatedDob: dateOfBirth
  };
}

export function createGuestSession(
  nickname: string,
  gender: GenderType,
  dateOfBirth: string,
  isGenderVisible: boolean = true,
  ip?: string
): UserSession {
  const sessionId = crypto.randomUUID();
  const userId = `usr_${crypto.randomBytes(8).toString('hex')}`;
  const ipHash = ip ? crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16) : undefined;
  const avatarSeed = `avatar-${Math.floor(Math.random() * 10000)}`;

  const now = Date.now();
  const session: UserSession = {
    sessionId,
    userId,
    nickname,
    role: 'guest',
    isAdultConfirmed: true,
    termsAccepted: true,
    gender,
    dateOfBirth, // secure, not public
    isGenderVisible,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    avatarSeed,
    ipHash,
    isMuted: false
  };

  dbStore.saveSession(session);
  return session;
}

export function resolveSessionFromToken(token?: string): UserSession | null {
  if (!token) return null;
  const session = dbStore.getSession(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    return null;
  }

  return session;
}
