import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext.js';
import { ChatMessage } from '../../shared/types.js';
import {
  Send,
  Smile,
  Users,
  Video,
  Shield,
  ChevronDown,
  ExternalLink,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

// Quick adult/flirty emoji set for instant insertion
const EMOJI_PALETTE = ['❤️', '🔥', '😘', '😉', '💋', '😈', '🌹', '🥂', '👀', '✨', '💬', '😍'];

interface RoomParticipant {
  userId: string;
  nickname: string;
  role: string;
}

export const ChatWorkspace: React.FC = () => {
  const {
    session,
    activeRoom,
    t,
    openDmWith,
    startCall,
    blockedUsers,
    blockUser,
    setActiveTab
  } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMobileUsers, setShowMobileUsers] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [selectedUserAction, setSelectedUserAction] = useState<string | null>(null);

  // Connection & Room Presence States
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [sendError, setSendError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [roomParticipants, setRoomParticipants] = useState<RoomParticipant[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(1);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const intentionalCloseRef = useRef(false);

  // Helper to load room history via REST API
  const fetchRoomHistory = useCallback(async (roomId: string) => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/messages?limit=50`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      }
    } catch (err) {
      console.warn('[ChatWorkspace] Failed to fetch REST history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Native WebSocket connection lifecycle for current room
  const connectRoomWs = useCallback(() => {
    if (!activeRoom) return;

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (wsRef.current) {
      intentionalCloseRef.current = true;
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionStatus('connecting');
    setSendError(null);
    intentionalCloseRef.current = false;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/rooms/${activeRoom.id}/ws${session?.token ? `?token=${encodeURIComponent(session.token)}` : ''}`;

    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;
    } catch (err) {
      console.error('[ChatWorkspace] Failed to construct WebSocket:', err);
      setConnectionStatus('error');
      return;
    }

    socket.onopen = () => {
      setConnectionStatus('connected');
      setSendError(null);

      // Start ping heartbeat
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Pong heartbeat response
        if (data.type === 'pong') return;

        // Presence update
        if (data.type === 'presence') {
          if (typeof data.count === 'number') {
            setOnlineCount(data.count);
          }
          if (Array.isArray(data.users)) {
            setRoomParticipants(data.users);
          }
          return;
        }

        // Room message history payload
        if (data.type === 'history') {
          if (data.roomId === activeRoom.id && Array.isArray(data.messages)) {
            setMessages(data.messages);
            setIsLoadingHistory(false);
          }
          return;
        }

        // Real-time chat message broadcast
        if (data.type === 'message') {
          if (data.roomId === activeRoom.id) {
            setMessages((prev) => {
              // Idempotency: avoid duplicates
              if (prev.some((m) => m.id === data.id)) return prev;
              return [...prev, data as ChatMessage];
            });
            // Clear any transient send error on successful message arrival
            setSendError(null);
          }
          return;
        }

        // Typing indicator update
        if (data.type === 'typing') {
          if (data.roomId === activeRoom.id && data.userId !== session?.userId) {
            setTypingUsers((prev) => {
              const next = { ...prev };
              if (data.isTyping) {
                next[data.userId] = data.nickname;
              } else {
                delete next[data.userId];
              }
              return next;
            });
          }
          return;
        }

        // Error payload from server (e.g. rate limit or persist failure)
        if (data.type === 'error') {
          setSendError(data.error || 'Chat error');
          const tId = setTimeout(() => {
            setSendError((curr) => (curr === data.error ? null : curr));
          }, 4000);
          return () => clearTimeout(tId);
        }
      } catch (e) {
        console.error('[ChatWorkspace] Failed to parse WebSocket message:', e);
      }
    };

    socket.onclose = () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      if (!intentionalCloseRef.current) {
        setConnectionStatus('disconnected');
        // Exponential backoff reconnect
        reconnectTimerRef.current = setTimeout(() => {
          connectRoomWs();
        }, 3000);
      }
    };

    socket.onerror = () => {
      setConnectionStatus('error');
    };
  }, [activeRoom?.id, session?.userId, session?.token]);

  // Handle activeRoom change: cleanly close previous room, fetch history, open new room WS
  useEffect(() => {
    if (!activeRoom) return;

    setMessages([]);
    setTypingUsers({});
    setSendError(null);
    setRoomParticipants([]);

    // 1. Fetch recent room history
    fetchRoomHistory(activeRoom.id);

    // 2. Connect to real-time room native WebSocket
    connectRoomWs();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) {
        intentionalCloseRef.current = true;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [activeRoom?.id, fetchRoomHistory, connectRoomWs]);

  // Auto-scroll to bottom on messages update
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setShowScrollBottom(!isNearBottom);
  };

  useEffect(() => {
    if (!showScrollBottom) {
      scrollToBottom('auto');
    }
  }, [messages]);

  // Typing debounce emit
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !activeRoom) return;

    ws.send(JSON.stringify({ type: 'typing', isTyping: true }));

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'typing', isTyping: false }));
      }
    }, 1500);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputText.trim();
    if (!clean || !activeRoom) return;

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setSendError('You are disconnected from this room. Please click Reconnect.');
      return;
    }

    if (clean.length > 500) {
      setSendError('Message exceeds maximum 500 characters.');
      return;
    }

    // Send native message payload matching RoomDO contract
    ws.send(JSON.stringify({
      type: 'message',
      text: clean
    }));

    // Clear typing indicator
    ws.send(JSON.stringify({
      type: 'typing',
      isTyping: false
    }));

    setInputText('');
    setShowEmojiPicker(false);
  };

  const addEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Safe linkification
  const renderSafeText = (text: string) => {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlPattern);

    return parts.map((part, i) => {
      if (part.match(urlPattern)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-brand underline break-all hover:text-brand-hover"
          >
            <span>{part}</span>
            <ExternalLink className="w-3 h-3 inline shrink-0" />
          </a>
        );
      }
      return part;
    });
  };

  // Filter messages to hide blocked users
  const visibleMessages = messages.filter((m) => !blockedUsers.has(m.senderId));

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden relative">
      {/* ========================================================= */}
      {/* MAIN CHAT AREA (Approximately 75% on Desktop)             */}
      {/* ========================================================= */}
      <section className="flex-1 flex flex-col h-full min-w-0 border-r border-line bg-raised/40">
        {/* Room Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-raised/80 backdrop-blur shrink-0">
          <div className="flex items-center gap-3 truncate">
            <div className="flex flex-col truncate">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-text-main truncate">
                  {activeRoom.name}
                </h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/10 text-brand font-mono font-bold uppercase">
                  {activeRoom.language}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-text-muted">
                  {activeRoom.category}
                </span>
              </div>
              <p className="text-xs text-text-muted truncate max-w-md hidden sm:block">
                {activeRoom.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Real WebSocket Connection Status Indicator */}
            {connectionStatus === 'connected' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="hidden sm:inline">Connected</span>
              </div>
            )}

            {connectionStatus === 'connecting' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-bold border border-amber-500/20">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="hidden sm:inline">Connecting...</span>
              </div>
            )}

            {(connectionStatus === 'disconnected' || connectionStatus === 'error') && (
              <button
                onClick={connectRoomWs}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 text-xs font-bold border border-red-500/20 cursor-pointer transition-colors"
                title="Click to reconnect"
              >
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline • Reconnect</span>
              </button>
            )}

            {/* Room presence counter */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-live/10 text-live text-xs font-bold border border-live/20">
              <span className="w-2 h-2 rounded-full bg-live" />
              <span>{onlineCount}</span>
              <span className="hidden sm:inline font-normal text-[11px] text-text-muted">
                {t('onlineInRoom')}
              </span>
            </div>

            {/* If room supports WebRTC / Roulette */}
            {activeRoom.features?.roulette && (
              <button
                onClick={() => setActiveTab('roulette')}
                className="px-2.5 py-1 rounded-lg bg-brand text-white text-xs font-bold flex items-center gap-1.5 hover:bg-brand-hover shadow-sm"
              >
                <span>Roulette 1-on-1</span>
              </button>
            )}

            {/* Mobile online users toggle */}
            <button
              onClick={() => setShowMobileUsers(!showMobileUsers)}
              className="md:hidden p-2 rounded-lg text-text-muted hover:text-text-main border border-line"
              title="Toggle Online Users"
            >
              <Users className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Transient Error / Rate Limit Banner */}
        {sendError && (
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{sendError}</span>
            </div>
            <button
              onClick={() => setSendError(null)}
              className="text-[11px] underline hover:text-white transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Message Stream */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0 relative"
        >
          {isLoadingHistory && visibleMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center my-auto text-center text-text-muted gap-2 py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-brand" />
              <p className="text-xs">Loading {activeRoom.name} messages...</p>
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center my-auto text-center text-text-muted gap-2 py-8">
              <Smile className="w-8 h-8 opacity-40 text-brand" />
              <p className="text-sm font-semibold">No messages in {activeRoom.name} yet.</p>
              <p className="text-xs">Be the first to say hello and break the ice!</p>
            </div>
          ) : (
            visibleMessages.map((msg) => {
              const isMe = msg.senderId === session?.userId;
              if (msg.isSystem) {
                return (
                  <div
                    key={msg.id}
                    className="self-center my-2 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-line text-center text-xs text-text-muted max-w-lg leading-relaxed"
                  >
                    <span className="text-brand font-bold mr-1">[Notice]:</span>
                    {msg.text}
                  </div>
                );
              }

              const nicknameDisplay = msg.senderNickname || 'User';

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 max-w-[85%] group ${
                    isMe ? 'self-end flex-row-reverse' : 'self-start'
                  }`}
                >
                  {/* Sender Avatar */}
                  <div
                    onClick={() =>
                      !isMe &&
                      setSelectedUserAction(selectedUserAction === msg.senderId ? null : msg.senderId)
                    }
                    className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand/80 to-amber-600 flex items-center justify-center text-white text-xs font-bold shrink-0 cursor-pointer shadow-sm select-none"
                    title={nicknameDisplay}
                  >
                    {nicknameDisplay.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="flex flex-col">
                    {/* Header info */}
                    <div
                      className={`flex items-center gap-1.5 mb-1 text-[11px] ${
                        isMe ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <span className="font-bold text-text-main hover:underline cursor-pointer">
                        {nicknameDisplay}
                      </span>
                      {msg.senderRole && msg.senderRole !== 'guest' && (
                        <span className="px-1 rounded bg-brand/20 text-brand text-[9px] font-mono font-bold uppercase">
                          {msg.senderRole}
                        </span>
                      )}
                      <span className="text-text-muted text-[10px]">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={`px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed break-words shadow-sm ${
                        isMe
                          ? 'bg-brand text-white rounded-tr-none'
                          : 'bg-raised border border-line text-text-main rounded-tl-none'
                      }`}
                    >
                      {renderSafeText(msg.text)}
                    </div>

                    {/* Quick user interaction popup when clicked */}
                    {!isMe && selectedUserAction === msg.senderId && (
                      <div className="mt-1 flex items-center gap-1.5 bg-raised border border-line p-1 rounded-lg text-[10px] shadow-lg animate-in fade-in duration-100 z-10">
                        <button
                          onClick={() => {
                            openDmWith(msg.senderId, nicknameDisplay);
                            setSelectedUserAction(null);
                          }}
                          className="px-2 py-1 rounded hover:bg-brand hover:text-white transition-colors"
                        >
                          {t('startDM')}
                        </button>
                        <button
                          onClick={() => {
                            startCall(msg.senderId, nicknameDisplay, 'video');
                            setSelectedUserAction(null);
                          }}
                          className="px-2 py-1 rounded hover:bg-brand hover:text-white transition-colors flex items-center gap-1"
                        >
                          <Video className="w-3 h-3" /> Cam
                        </button>
                        <button
                          onClick={() => {
                            blockUser(msg.senderId);
                            setSelectedUserAction(null);
                          }}
                          className="px-2 py-1 rounded text-red-500 hover:bg-red-500/10 transition-colors"
                        >
                          {t('blockUser')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Typing indicator */}
        {Object.keys(typingUsers).length > 0 && (
          <div className="px-4 py-1 text-[11px] text-text-muted italic flex items-center gap-1 shrink-0 bg-raised/20">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            <span>
              {Object.values(typingUsers).join(', ')} {t('typing')}
            </span>
          </div>
        )}

        {/* Scroll to bottom float button */}
        {showScrollBottom && (
          <button
            onClick={() => scrollToBottom('smooth')}
            className="absolute bottom-20 right-6 px-3 py-1.5 rounded-full bg-brand text-white text-xs font-bold shadow-lg flex items-center gap-1 hover:bg-brand-hover animate-bounce cursor-pointer z-20"
          >
            <span>Latest</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Emoji palette drawer */}
        {showEmojiPicker && (
          <div className="flex items-center gap-1.5 p-2 bg-raised border-t border-line overflow-x-auto shrink-0 animate-in fade-in">
            {EMOJI_PALETTE.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => addEmoji(emoji)}
                className="text-lg p-1.5 hover:bg-white/10 rounded-lg transition-transform active:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Chat Composer */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 border-t border-line bg-raised/90 backdrop-blur flex items-center gap-2 shrink-0"
        >
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 rounded-xl text-text-muted hover:text-brand hover:bg-black/5 dark:hover:bg-white/5 border border-line transition-colors shrink-0"
            title="Emoji picker"
          >
            <Smile className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder={
              connectionStatus === 'connected'
                ? t('typeMessage')
                : 'Connecting to room chat...'
            }
            disabled={connectionStatus !== 'connected'}
            maxLength={500}
            className="flex-1 px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-line focus:border-brand focus:outline-none text-xs sm:text-sm text-text-main placeholder:text-text-muted transition-colors disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || connectionStatus !== 'connected'}
            className="p-2.5 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-40 text-white font-bold flex items-center justify-center transition-all cursor-pointer shadow-md shadow-brand/20 shrink-0"
            title={t('send')}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </section>

      {/* ========================================================= */}
      {/* ONLINE USER PANEL (Desktop 25% ~ 280px-340px)             */}
      {/* ========================================================= */}
      <aside
        className={`${
          showMobileUsers ? 'flex absolute inset-0 z-30' : 'hidden md:flex'
        } md:w-72 lg:w-80 flex-col h-full bg-raised/70 backdrop-blur shrink-0 border-l border-line`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-brand" />
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
              {t('onlineInRoom')} ({onlineCount})
            </span>
          </div>

          <button
            onClick={() => setShowMobileUsers(false)}
            className="md:hidden text-xs text-text-muted hover:text-text-main p-1"
          >
            Close
          </button>
        </div>

        {/* Current user self card */}
        {session && (
          <div className="p-3 border-b border-line bg-black/5 dark:bg-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold">
                {session.nickname.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-text-main">
                  {session.nickname} (You)
                </span>
                <span className="text-[10px] text-live flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-live" /> Active in room
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Real active room participants list */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          <div className="px-2 py-1 text-[11px] font-semibold text-text-muted">
            Room Participants ({roomParticipants.length})
          </div>

          {roomParticipants.length === 0 ? (
            <div className="p-4 text-center text-xs text-text-muted">
              Connecting to participant directory...
            </div>
          ) : (
            roomParticipants.map((user) => {
              if (user.userId === session?.userId) return null;
              const isBlocked = blockedUsers.has(user.userId);

              return (
                <div
                  key={user.userId}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand/60 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                        {user.nickname.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-live ring-2 ring-raised" />
                    </div>
                    <div className="flex flex-col truncate">
                      <span className="text-xs font-semibold text-text-main truncate group-hover:text-brand">
                        {user.nickname}
                      </span>
                      <span className="text-[10px] text-text-muted capitalize">
                        {user.role}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openDmWith(user.userId, user.nickname)}
                      title={t('startDM')}
                      className="p-1.5 rounded-lg hover:bg-brand hover:text-white text-text-muted text-xs transition-colors"
                    >
                      DM
                    </button>
                    <button
                      onClick={() => startCall(user.userId, user.nickname, 'video')}
                      title="Video Call"
                      className="p-1.5 rounded-lg hover:bg-brand hover:text-white text-text-muted transition-colors"
                    >
                      <Video className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Safe Conduct Advisory in Room sidebar */}
        <div className="p-3 border-t border-line text-[11px] text-text-muted bg-black/5 dark:bg-white/5 flex flex-col gap-1">
          <span className="font-bold text-text-main flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-brand" /> Adults 18+ Advisory
          </span>
          <p className="text-[10px] leading-relaxed">
            Respect personal boundaries. Non-consensual sharing of media or abusive harassment results in an immediate permanent ban.
          </p>
        </div>
      </aside>
    </div>
  );
};
