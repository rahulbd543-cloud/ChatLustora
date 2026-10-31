import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { UserRole, ChatMessage, PrivateMessage, CallType } from '../../shared/types.js';
import { Chatroom, INITIAL_CHATROOMS, getRoomById } from '../../shared/rooms.js';
import { LOCALES, LocaleKey, TranslationKey } from '../../shared/locales.js';

export interface ActiveCallState {
  callId: string;
  partnerId: string;
  partnerNickname: string;
  isIncoming: boolean;
  type: CallType;
  status: 'incoming' | 'calling' | 'connected' | 'ended';
}

export type NavTab = 'directory' | 'chat' | 'roulette' | 'blog' | 'forum' | 'moderation';
export type AuthModalMode = 'guest' | 'login' | 'signup' | null;
export type DmWindowMode = 'floating' | 'minimized' | 'maximized';

export interface AppSession {
  userId: string;
  username: string;
  nickname: string;
  email?: string;
  role: UserRole;
  token?: string;
  avatarSeed: string;
  gender?: string;
  isGenderVisible?: boolean;
}

export interface AppContextType {
  session: AppSession | null;
  setSession: (session: any) => void;
  register: (data: any) => Promise<any>;
  login: (data: any) => Promise<any>;
  logout: () => Promise<void>;
  socket: Socket | null;
  activeRoom: Chatroom;
  setActiveRoom: (room: Chatroom) => void;
  navigateRoom: (room: Chatroom) => void;
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  lang: LocaleKey;
  setLang: (lang: LocaleKey) => void;
  t: (key: TranslationKey) => string;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  globalPresence: {
    totalConnected: number;
    roomCounts: Record<string, number>;
  };
  // Auth modal
  authModalMode: AuthModalMode;
  openAuthModal: (mode: AuthModalMode, returnUrl?: string) => void;
  closeAuthModal: () => void;
  returnUrl: string | null;
  // DMs
  isDmDrawerOpen: boolean;
  dmWindowMode: DmWindowMode;
  setDmWindowMode: (mode: DmWindowMode) => void;
  activeDmUserId: string | null;
  activeDmPartnerNickname: string;
  openDmWith: (userId: string, nickname?: string) => void;
  openDmDrawer: () => void;
  closeDm: () => void;
  unreadDmCount: number;
  incrementUnreadDm: () => void;
  // WebRTC
  activeCall: ActiveCallState | null;
  startCall: (recipientId: string, recipientNickname: string, type: CallType) => void;
  acceptCall: () => void;
  declineCall: () => void;
  endCall: () => void;
  // Blocking & Modals
  blockedUsers: Set<string>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  isInfoModalOpen: boolean;
  infoModalTab: 'terms' | 'privacy' | 'guidelines' | 'safety' | 'contact';
  openInfoModal: (tab: 'terms' | 'privacy' | 'guidelines' | 'safety' | 'contact') => void;
  closeInfoModal: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  // Language state
  const [lang, setLang] = useState<LocaleKey>('en');

  // Session state with localStorage persistence
  const [session, setSessionState] = useState<AppSession | null>(() => {
    try {
      const saved = localStorage.getItem('chatlustora_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setSession = (sess: any) => {
    if (sess) {
      const formatted: AppSession = {
        userId: sess.userId || sess.id || `usr-${Date.now()}`,
        username: sess.username || sess.nickname || 'User',
        nickname: sess.nickname || sess.username || 'User',
        email: sess.email || '',
        role: sess.role || 'guest',
        avatarSeed: sess.avatarSeed || 'user-seed',
        token: sess.token || sess.sessionId || '',
        gender: sess.gender || 'prefer-not-to-say',
        isGenderVisible: sess.isGenderVisible ?? true
      };
      setSessionState(formatted);
      try {
        localStorage.setItem('chatlustora_user_session', JSON.stringify(formatted));
      } catch {}
    } else {
      setSessionState(null);
      try {
        localStorage.removeItem('chatlustora_user_session');
      } catch {}
    }
  };

  useEffect(() => {
    // Check auth on mount
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data: any) => {
        if (data && (data.id || data.userId)) {
          setSession(data);
        }
      })
      .catch(() => {});
  }, []);

  const register = async (data: any) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' }
    });
    try {
      return await res.json();
    } catch {
      return { error: `Registration error (${res.status})` };
    }
  };

  const login = async (data: any) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    let result: any = null;
    try {
      result = await res.json();
    } catch {
      return { error: `Login error (${res.status})` };
    }

    if (!res.ok || !result?.success) {
      return result ?? { error: 'Login failed' };
    }

    const meRes = await fetch('/api/auth/me', {
      credentials: 'same-origin'
    });
    let me: any = null;
    try {
      me = await meRes.json();
    } catch {
      return { error: 'Session could not be verified' };
    }

    if (!meRes.ok || !(me?.id || me?.userId)) {
      return {
        error: me?.error || 'Session could not be verified. Please try again.'
      };
    }

    setSession(me);
    return result;
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setSession(null);
  };
  
  const [activeRoom, setActiveRoom] = useState<Chatroom>(INITIAL_CHATROOMS[0]);
  const [activeTab, setActiveTab] = useState<NavTab>('directory');
  
  const [socket, setSocket] = useState<Socket | null>(null);

  const [globalPresence, setGlobalPresence] = useState<{
    totalConnected: number;
    roomCounts: Record<string, number>;
  }>({
    totalConnected: 1,
    roomCounts: {}
  });

  // Direct Messaging
  const [isDmDrawerOpen, setIsDmDrawerOpen] = useState<boolean>(false);
  const [dmWindowMode, setDmWindowMode] = useState<DmWindowMode>('floating');
  const [activeDmUserId, setActiveDmUserId] = useState<string | null>(null);
  const [activeDmPartnerNickname, setActiveDmPartnerNickname] = useState<string>('Chat Partner');
  const [unreadDmCount, setUnreadDmCount] = useState<number>(0);

  // Calls
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);

  // Blocked users — server is the source of truth.
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());

  const refreshBlockedUsers = useCallback(async () => {
    if (!session?.userId) {
      setBlockedUsers(new Set());
      return;
    }

    const response = await fetch('/api/user/blocks', {
      method: 'GET',
      credentials: 'same-origin'
    });

    if (!response.ok) {
      throw new Error('Unable to load blocked users.');
    }

    const data = await response.json();
    const ids = Array.isArray(data.blockedUsers) ? data.blockedUsers : [];

    setBlockedUsers(new Set(
      ids.filter((id: unknown): id is string =>
        typeof id === 'string' && id.length > 0
      )
    ));
  }, [session?.userId]);

  useEffect(() => {
    refreshBlockedUsers().catch(error => {
      console.warn('[AppContext] Could not refresh blocked users:', error);
    });
  }, [refreshBlockedUsers]);

  // Auth modal state
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>(null);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);

  const openAuthModal = (mode: AuthModalMode, url?: string) => {
    setAuthModalMode(mode);
    if (url) setReturnUrl(url);
  };

  const closeAuthModal = () => {
    setAuthModalMode(null);
  };

  // Info modal
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [infoModalTab, setInfoModalTab] = useState<'terms' | 'privacy' | 'guidelines' | 'safety' | 'contact'>('terms');

  // Translation helper
  const t = useCallback((key: TranslationKey): string => {
    return LOCALES[lang]?.[key] || LOCALES.en[key] || (key as string);
  }, [lang]);

  // Sync theme with HTML document class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // URL Deep-linking initialization and popstate handling
  useEffect(() => {
    const resolveFromPath = (path: string) => {
      const lower = path.toLowerCase();
      if (lower === '/' || lower === '') {
        setActiveTab('directory');
        return;
      }
      if (lower === '/blog' || lower.startsWith('/blog/')) {
        setActiveTab('blog');
      } else if (lower === '/forum' || lower.startsWith('/forum/')) {
        setActiveTab('forum');
      } else if (lower === '/roulette-chat') {
        const room = INITIAL_CHATROOMS.find(r => r.slug === '/roulette-chat');
        if (room) {
          if (!session) {
            setReturnUrl(room.slug);
            openAuthModal('guest', room.slug);
            setActiveTab('directory');
          } else {
            setActiveRoom(room);
            setActiveTab('roulette');
          }
        }
      } else {
        const matched = INITIAL_CHATROOMS.find(r => r.slug.toLowerCase() === lower);
        if (matched) {
          if (!session) {
            setReturnUrl(matched.slug);
            openAuthModal('guest', matched.slug);
            setActiveTab('directory');
          } else {
            setActiveRoom(matched);
            setActiveTab('chat');
          }
        }
      }
    };

    resolveFromPath(window.location.pathname);

    const onPopState = () => {
      resolveFromPath(window.location.pathname);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [session]);

  const navigateRoom = (room: Chatroom) => {
    if (!session) {
      setReturnUrl(room.slug);
      openAuthModal('guest', room.slug);
      return;
    }
    setActiveRoom(room);
    window.history.pushState(null, '', room.slug);
    if (room.features?.roulette) {
      setActiveTab('roulette');
    } else {
      setActiveTab('chat');
    }
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };


  // Handle active room joins over socket (if Socket.IO socket exists)
  useEffect(() => {
    if (socket && socket.connected && activeRoom) {
      socket.emit('room:join', { roomId: activeRoom.id });
    }
  }, [socket, activeRoom?.id]);

  const openDmWith = (userId: string, nickname?: string) => {
    setActiveDmUserId(userId);
    if (nickname) {
      setActiveDmPartnerNickname(nickname);
    }
    setIsDmDrawerOpen(true);
    setDmWindowMode('floating');
  };

  const openDmDrawer = () => {
    setIsDmDrawerOpen(true);
    setDmWindowMode('floating');
  };

  const closeDm = () => {
    setIsDmDrawerOpen(false);
    setActiveDmUserId(null);
  };

  const incrementUnreadDm = () => {
    setUnreadDmCount(prev => prev + 1);
  };

  const startCall = (recipientId: string, recipientNickname: string, type: CallType) => {
    if (!socket || !recipientId) return;
    const callId = `call-${Date.now()}`;
    socket.emit('call:invite', { recipientId, type });
    setActiveCall({
      callId,
      partnerId: recipientId,
      partnerNickname: recipientNickname,
      isIncoming: false,
      type,
      status: 'calling'
    });
  };

  const acceptCall = () => {
    if (!socket || !activeCall) return;
    socket.emit('call:accept', {
      callId: activeCall.callId,
      callerId: activeCall.partnerId
    });
    setActiveCall(prev => prev ? { ...prev, status: 'connected' } : null);
  };

  const declineCall = () => {
    if (!socket || !activeCall) return;
    socket.emit('call:decline', {
      callId: activeCall.callId,
      callerId: activeCall.partnerId
    });
    setActiveCall(null);
  };

  const endCall = () => {
    if (socket && activeCall) {
      socket.emit('call:hangup', { toUserId: activeCall.partnerId });
    }
    setActiveCall(null);
  };

  const blockUser = async (userId: string): Promise<void> => {
    if (!session?.userId || !userId || userId === session.userId) {
      throw new Error('Invalid user to block.');
    }

    const response = await fetch('/api/user/block', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: userId })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || 'Unable to block this user.');
    }

    setBlockedUsers(prev => new Set(prev).add(userId));
  };

  const unblockUser = async (userId: string): Promise<void> => {
    if (!session?.userId || !userId) {
      throw new Error('Invalid user to unblock.');
    }

    const response = await fetch('/api/user/unblock', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: userId })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || 'Unable to unblock this user.');
    }

    setBlockedUsers(prev => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  };

  const openInfoModal = (tab: 'terms' | 'privacy' | 'guidelines' | 'safety' | 'contact') => {
    setInfoModalTab(tab);
    setIsInfoModalOpen(true);
  };

  const closeInfoModal = () => {
    setIsInfoModalOpen(false);
  };

  return (
    <AppContext.Provider
      value={{
        session,
        setSession,
        register,
        login,
        logout,
        socket,
        activeRoom,
        setActiveRoom,
        navigateRoom,
        activeTab,
        setActiveTab,
        lang,
        setLang,
        t,
        theme,
        setTheme,
        toggleTheme,
        globalPresence,
        isDmDrawerOpen,
        dmWindowMode,
        setDmWindowMode,
        activeDmUserId,
        activeDmPartnerNickname,
        openDmWith,
        openDmDrawer,
        closeDm,
        unreadDmCount,
        incrementUnreadDm,
        activeCall,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        blockedUsers,
        blockUser,
        unblockUser,
        isInfoModalOpen,
        infoModalTab,
        openInfoModal,
        closeInfoModal,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        returnUrl
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
