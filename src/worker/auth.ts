// Secure password hashing for Cloudflare Workers using Web Crypto API

const VERSION = 'v1';

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) throw new Error('Password too short');

  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    256
  );

  const hashArray = new Uint8Array(hash);
  const combined = new Uint8Array(salt.length + hashArray.length);
  combined.set(salt);
  combined.set(hashArray, salt.length);
  
  return `${VERSION}:${btoa(String.fromCharCode(...combined))}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash.startsWith(`${VERSION}:`)) return false;
  
  const rawHash = storedHash.slice(VERSION.length + 1);
  const combined = Uint8Array.from(atob(rawHash), c => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const hash = combined.slice(16);
  
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const newHash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    256
  );
  
  const newHashArray = new Uint8Array(newHash);
  let equal = true;
  for (let i = 0; i < hash.length; i++) {
    equal = equal && (hash[i] === newHashArray[i]);
  }
  return equal;
}
