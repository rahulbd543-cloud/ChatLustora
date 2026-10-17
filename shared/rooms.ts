/**
 * ChatLustora Authoritative Room Directory (23 Rooms)
 */

export interface Chatroom {
  id: string;
  name: string;
  slug: string;
  tag: 'General' | 'Adult' | 'International' | 'Social' | 'Regional';
  category?: string;
  language: string;
  description: string;
  isAdult?: boolean;
  features?: {
    webrtc?: boolean;
    roulette?: boolean;
    privateChat?: boolean;
  };
}

export const TOTAL_INITIAL_ROOMS = 23;

export const CATEGORIES = [
  { id: 'all', name: 'All Rooms', icon: 'Globe' },
  { id: 'General', name: 'General', icon: 'MessageSquare' },
  { id: 'Adult', name: 'Adult (18+)', icon: 'Flame' },
  { id: 'International', name: 'International', icon: 'Globe2' },
  { id: 'Social', name: 'Social', icon: 'Users' },
  { id: 'Regional', name: 'Regional', icon: 'MapPin' }
];

export const INITIAL_CHATROOMS: Chatroom[] = [
  // MAIN CHATROOMS (1-10)
  {
    id: 'bangla-chat',
    name: 'Bangla Chat',
    slug: '/bangla-chat',
    tag: 'General',
    category: 'General',
    language: 'bn',
    description: 'General Bangla community chatroom for open conversations.'
  },
  {
    id: 'sex-chat',
    name: 'Sex Chat',
    slug: '/sex-chat',
    tag: 'Adult',
    category: 'Adult',
    language: 'mixed',
    description: 'An adult-only group chat for lawful conversations among consenting adults.',
    isAdult: true
  },
  {
    id: 'adult-chat',
    name: 'Adult Chat',
    slug: '/adult-chat',
    tag: 'Adult',
    category: 'Adult',
    language: 'mixed',
    description: 'A general room for adult conversations and social interaction.',
    isAdult: true
  },
  {
    id: 'video-chat',
    name: 'Video Chat',
    slug: '/video-chat',
    tag: 'Adult',
    category: 'Adult',
    language: 'mixed',
    description: 'A room for adults who want to connect through webcam.',
    isAdult: true,
    features: { webrtc: true }
  },
  {
    id: 'roulette-chat',
    name: 'Roulette Chat',
    slug: '/roulette-chat',
    tag: 'Adult',
    category: 'Adult',
    language: 'mixed',
    description: 'One-to-one random matching between consenting adult users with a functional Skip action.',
    isAdult: true,
    features: { roulette: true }
  },
  {
    id: 'gay-chat',
    name: 'Gay Chat',
    slug: '/gay-chat',
    tag: 'Adult',
    category: 'Adult',
    language: 'mixed',
    description: 'An inclusive space for gay and bisexual adult men.',
    isAdult: true
  },
  {
    id: 'lesbian-chat',
    name: 'Lesbian Chat',
    slug: '/lesbian-chat',
    tag: 'Adult',
    category: 'Adult',
    language: 'mixed',
    description: 'A dedicated space for lesbian and bisexual adult women.',
    isAdult: true
  },
  {
    id: 'couples-chat',
    name: 'Couples Chat',
    slug: '/couples-chat',
    tag: 'Adult',
    category: 'Adult',
    language: 'mixed',
    description: 'A social room for adult couples and singles.',
    isAdult: true
  },
  {
    id: 'roleplay-chat',
    name: 'Roleplay Chat',
    slug: '/roleplay-chat',
    tag: 'Adult',
    category: 'Adult',
    language: 'mixed',
    description: 'A room for consensual adult roleplay and storytelling.',
    isAdult: true
  },
  {
    id: 'bdsm-chat',
    name: 'BDSM Chat',
    slug: '/bdsm-chat',
    tag: 'Adult',
    category: 'Adult',
    language: 'mixed',
    description: 'A room for adults to discuss consensual kink and fetish interests.',
    isAdult: true
  },

  // INTERNATIONAL AND SOCIAL ROOMS (11-15)
  {
    id: 'english-chat',
    name: 'English Chat',
    slug: '/english-chat',
    tag: 'International',
    category: 'International',
    language: 'en',
    description: 'An English-language chatroom.'
  },
  {
    id: 'asian-chat',
    name: 'Asian Chat',
    slug: '/asian-chat',
    tag: 'International',
    category: 'International',
    language: 'mixed',
    description: 'A general chatroom for people interested in connecting across Asia.'
  },
  {
    id: 'international-chat',
    name: 'International Chat',
    slug: '/international-chat',
    tag: 'International',
    category: 'International',
    language: 'mixed',
    description: 'A global room for conversations between people from different countries.'
  },
  {
    id: 'friendship-chat',
    name: 'Friendship Chat',
    slug: '/friendship-chat',
    tag: 'Social',
    category: 'Social',
    language: 'mixed',
    description: 'A room for making friends and having friendly conversations.'
  },
  {
    id: 'mature-chat',
    name: 'Mature Chat',
    slug: '/mature-chat',
    tag: 'Adult',
    category: 'Adult',
    language: 'mixed',
    description: 'A dedicated social chatroom for verified adult users aged 18 and older.',
    isAdult: true
  },

  // REGIONAL ROOMS (16-23)
  {
    id: 'usa-chat',
    name: 'USA Chat',
    slug: '/usa-chat',
    tag: 'Regional',
    category: 'Regional',
    language: 'mixed',
    description: 'A regional chatroom for users interested in connecting with people from the United States.'
  },
  {
    id: 'indian-chat',
    name: 'Indian Chat',
    slug: '/indian-chat',
    tag: 'Regional',
    category: 'Regional',
    language: 'mixed',
    description: 'An Indian-language chatroom.'
  },
  {
    id: 'bangladeshi-chat',
    name: 'Bangladeshi Chat',
    slug: '/bangladeshi-chat',
    tag: 'Regional',
    category: 'Regional',
    language: 'mixed',
    description: 'A Bangladeshi-language chatroom.'
  },
  {
    id: 'pakistani-chat',
    name: 'Pakistani Chat',
    slug: '/pakistani-chat',
    tag: 'Regional',
    category: 'Regional',
    language: 'mixed',
    description: 'A Pakistani-language chatroom.'
  },
  {
    id: 'german-chat',
    name: 'German Chat',
    slug: '/german-chat',
    tag: 'Regional',
    category: 'Regional',
    language: 'mixed',
    description: 'A German-language chatroom.'
  },
  {
    id: 'hindi-chat',
    name: 'Hindi Chat',
    slug: '/hindi-chat',
    tag: 'Regional',
    category: 'Regional',
    language: 'mixed',
    description: 'A dedicated room for Hindi-language conversations.'
  },
  {
    id: 'tamil-chat',
    name: 'Tamil Chat',
    slug: '/tamil-chat',
    tag: 'Regional',
    category: 'Regional',
    language: 'mixed',
    description: 'A dedicated room for Tamil-language conversations.'
  },
  {
    id: 'west-bengal-chat',
    name: 'West Bengal Chat',
    slug: '/west-bengal-chat',
    tag: 'Regional',
    category: 'Regional',
    language: 'mixed',
    description: 'A regional room for people interested in West Bengal and Bengali-language conversations.'
  }
];

export function getRoomById(id: string): Chatroom | undefined {
  const norm = id.startsWith('/') ? id : '/' + id;
  return INITIAL_CHATROOMS.find(r => r.id === id || r.slug === id || r.slug === norm);
}

export function getRoomBySlug(slug: string): Chatroom | undefined {
  const norm = slug.startsWith('/') ? slug : '/' + slug;
  return INITIAL_CHATROOMS.find(r => r.slug === slug || r.slug === norm || r.id === slug);
}
