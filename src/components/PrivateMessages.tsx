import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext.js';
import {
  X,
  Send,
  Video,
  Phone,
  Slash,
  MessageCircle,
  ArrowLeft,
  Search,
  Minus,
  Maximize2,
  Minimize2,
  Loader2
} from 'lucide-react';

interface DmMessage {
  id: string;
  conversationId?: string;
  senderId: string;
  recipientId: string;
  senderNickname?: string;
  text: string;
  timestamp: number;
  isRead?: boolean;
}

interface DmConversation {
  id: string;
  participantIds: string[];
  participantNicknames?: Record<string, string>;
  lastMessage: string;
  lastTimestamp: number;
  unreadCount: number;
}

export const PrivateMessages: React.FC = () => {
  const {
    session,
    isDmDrawerOpen,
    activeDmUserId,
    activeDmPartnerNickname,
    dmWindowMode,
    setDmWindowMode,
    closeDm,
    openDmWith,
    startCall,
    blockedUsers,
    blockUser,
    unblockUser,
    t
  } = useApp();

  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [conversations, setConversations] = useState<DmConversation[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isBlocked = activeDmUserId
    ? blockedUsers.has(activeDmUserId)
    : false;

  const requestJson = useCallback(async (
    url: string,
    options: RequestInit = {}
  ) => {
    const response = await fetch(url, {
      ...options,
      credentials: 'same-origin',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.error || `Request failed (${response.status}).`);
    }

    return data;
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!session?.userId) return;

    const data = await requestJson('/api/dm/conversations');
    setConversations(
      Array.isArray(data.conversations) ? data.conversations : []
    );
  }, [session?.userId, requestJson]);

  const fetchMessages = useCallback(async (partnerId: string) => {
    const data = await requestJson(
      `/api/dm/${encodeURIComponent(partnerId)}/messages`
    );

    setMessages(
      Array.isArray(data.messages) ? data.messages : []
    );
  }, [requestJson]);

  useEffect(() => {
    if (!isDmDrawerOpen || !session?.userId) return;

    let cancelled = false;

    const load = async () => {
      try {
        setError('');
        await fetchConversations();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load conversations.');
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [isDmDrawerOpen, session?.userId, fetchConversations]);

  useEffect(() => {
    if (!isDmDrawerOpen || !activeDmUserId || !session?.userId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    let firstLoad = true;

    const load = async () => {
      try {
        if (firstLoad) setLoading(true);

        const data = await requestJson(
          `/api/dm/${encodeURIComponent(activeDmUserId)}/messages`
        );

        if (!cancelled) {
          setMessages(
            Array.isArray(data.messages) ? data.messages : []
          );
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load messages.');
        }
      } finally {
        if (!cancelled && firstLoad) {
          setLoading(false);
          firstLoad = false;
        }
      }
    };

    void load();

    // REST polling keeps the conversation updated without Socket.IO.
    const timer = window.setInterval(() => {
      void load();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isDmDrawerOpen, activeDmUserId, session?.userId, requestJson]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();

    const clean = inputText.trim();

    if (!clean || !activeDmUserId || sending || isBlocked) return;

    setSending(true);
    setError('');

    try {
      const data = await requestJson('/api/dm/send', {
        method: 'POST',
        body: JSON.stringify({
          recipientId: activeDmUserId,
          text: clean
        })
      });

      if (data.message) {
        setMessages(previous => {
          if (previous.some(message => message.id === data.message.id)) {
            return previous;
          }
          return [...previous, data.message as DmMessage];
        });
      }

      setInputText('');
      void fetchConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const handleBlockToggle = async () => {
    if (!activeDmUserId || blocking) return;

    setBlocking(true);
    setError('');

    try {
      if (isBlocked) {
        await unblockUser(activeDmUserId);
      } else {
        await blockUser(activeDmUserId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update block status.');
    } finally {
      setBlocking(false);
    }
  };

  if (!isDmDrawerOpen) return null;

  const isMaximized = dmWindowMode === 'maximized';
  const isMinimized = dmWindowMode === 'minimized';

  const windowClass = isMaximized
    ? 'relative z-20 flex h-[min(720px,calc(100vh-180px))] min-h-[420px] w-[min(430px,42%)] shrink-0 flex-col overflow-hidden rounded-2xl border border-line bg-raised shadow-xl'
    : 'fixed bottom-5 right-5 z-50 flex h-[min(570px,calc(100vh-40px))] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-line bg-raised shadow-2xl';

  const header = (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-raised/95 px-3 py-3">
      <div className="flex min-w-0 items-center gap-2">
        {activeDmUserId && (
          <button
            type="button"
            onClick={() => {
              openDmWith('');
              setError('');
            }}
            title="Back to conversations"
            className="rounded-lg p-1.5 text-text-muted hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}

        <MessageCircle className="h-5 w-5 shrink-0 text-brand" />

        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-text-main">
            {activeDmUserId ? activeDmPartnerNickname : t('privateMessages')}
          </div>
          <div className="text-[10px] text-text-muted">
            {activeDmUserId ? 'Private 1-on-1 conversation' : 'Your conversations'}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {activeDmUserId && (
          <>
            <button
              type="button"
              onClick={() => startCall(activeDmUserId, activeDmPartnerNickname, 'audio')}
              title="Voice call"
              className="rounded-lg p-1.5 text-text-muted hover:bg-white/10 hover:text-brand"
            >
              <Phone className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => startCall(activeDmUserId, activeDmPartnerNickname, 'video')}
              title="Video call"
              className="rounded-lg p-1.5 text-text-muted hover:bg-white/10 hover:text-brand"
            >
              <Video className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void handleBlockToggle()}
              disabled={blocking}
              title={isBlocked ? 'Unblock user' : 'Block user'}
              className={`rounded-lg p-1.5 transition-colors disabled:opacity-50 ${
                isBlocked
                  ? 'bg-live/10 text-live hover:bg-live/20'
                  : 'text-red-500 hover:bg-red-500/10'
              }`}
            >
              {blocking
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Slash className="h-4 w-4" />}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setDmWindowMode(isMinimized ? 'floating' : 'minimized')}
          title={isMinimized ? 'Restore window' : 'Minimize'}
          className="rounded-lg p-1.5 text-text-muted hover:bg-white/10"
        >
          {isMinimized
            ? <Maximize2 className="h-4 w-4" />
            : <Minus className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => setDmWindowMode(isMaximized ? 'floating' : 'maximized')}
          title={isMaximized ? 'Restore floating window' : 'Maximize beside group chat'}
          className="rounded-lg p-1.5 text-text-muted hover:bg-white/10"
        >
          {isMaximized
            ? <Minimize2 className="h-4 w-4" />
            : <Maximize2 className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={closeDm}
          title="Close"
          className="rounded-lg p-1.5 text-text-muted hover:bg-white/10 hover:text-text-main"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  if (isMinimized) {
    return (
      <div className="fixed bottom-5 right-5 z-50 w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-xl border border-line bg-raised shadow-2xl">
        <button
          type="button"
          onClick={() => setDmWindowMode('floating')}
          className="flex w-full items-center gap-2 px-3 py-3 text-left hover:bg-white/5"
        >
          <MessageCircle className="h-5 w-5 text-brand" />
          <span className="min-w-0 flex-1 truncate text-xs font-bold text-text-main">
            {activeDmUserId ? activeDmPartnerNickname : t('privateMessages')}
          </span>
          <Maximize2 className="h-4 w-4 text-text-muted" />
        </button>
      </div>
    );
  }

  if (!activeDmUserId) {
    const filteredConversations = conversations.filter(conversation => {
      const partnerId = conversation.participantIds.find(
        id => id !== session?.userId
      ) || '';

      const name = conversation.participantNicknames?.[partnerId] || partnerId;

      return name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
      <div className={windowClass}>
        {header}

        <div className="shrink-0 border-b border-line p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Search conversations..."
              className="w-full rounded-xl border border-line bg-black/5 py-2 pl-9 pr-3 text-xs text-text-main focus:border-brand focus:outline-none dark:bg-white/5"
            />
          </div>
        </div>

        {error && (
          <div className="shrink-0 border-b border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-text-muted">
              <MessageCircle className="h-8 w-8 text-brand opacity-40" />
              <p className="text-xs font-semibold">No direct messages yet.</p>
              <p className="text-[11px]">Select a participant in a chatroom to start a private conversation.</p>
            </div>
          ) : (
            filteredConversations.map(conversation => {
              const partnerId = conversation.participantIds.find(
                id => id !== session?.userId
              ) || '';

              const nickname =
                conversation.participantNicknames?.[partnerId] || partnerId;

              return (
                <button
                  type="button"
                  key={conversation.id}
                  onClick={() => openDmWith(partnerId, nickname)}
                  className="flex w-full items-center gap-3 rounded-xl border border-transparent p-3 text-left transition-colors hover:border-line hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                    {nickname.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-text-main">{nickname}</div>
                    <div className="truncate text-[11px] text-text-muted">
                      {conversation.lastMessage || 'No messages yet'}
                    </div>
                  </div>
                  {conversation.lastTimestamp > 0 && (
                    <span className="shrink-0 text-[10px] text-text-muted">
                      {new Date(conversation.lastTimestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={windowClass}>
      {header}

      {error && (
        <div className="shrink-0 border-b border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-3">
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-xs text-text-muted">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="my-auto flex flex-col items-center justify-center gap-2 text-center text-text-muted">
            <MessageCircle className="h-8 w-8 text-brand opacity-40" />
            <p className="text-xs font-semibold">Start your private conversation.</p>
            <p className="text-[10px]">Messages are private between both participants.</p>
          </div>
        ) : (
          messages.map(message => {
            const isMe = message.senderId === session?.userId;

            return (
              <div
                key={message.id}
                className={`flex max-w-[85%] flex-col ${
                  isMe ? 'self-end items-end' : 'self-start items-start'
                }`}
              >
                <div
                  className={`break-words rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm ${
                    isMe
                      ? 'rounded-tr-none bg-brand text-white'
                      : 'rounded-tl-none border border-line bg-black/5 text-text-main dark:bg-white/10'
                  }`}
                >
                  {message.text}
                </div>
                <span className="mt-0.5 text-[9px] text-text-muted">
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {isBlocked ? (
        <div className="shrink-0 border-t border-red-500/20 bg-red-500/10 p-3 text-center">
          <p className="mb-2 text-xs text-red-400">
            You have blocked this user. Messages cannot be sent.
          </p>
          <button
            type="button"
            onClick={() => void handleBlockToggle()}
            disabled={blocking}
            className="rounded-lg bg-live/10 px-3 py-2 text-xs font-semibold text-live hover:bg-live/20 disabled:opacity-50"
          >
            {blocking ? 'Please wait...' : 'Unblock user'}
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSend}
          className="flex shrink-0 items-center gap-2 border-t border-line bg-raised/95 p-3"
        >
          <input
            type="text"
            value={inputText}
            onChange={event => setInputText(event.target.value)}
            placeholder="Type a private message..."
            maxLength={1000}
            disabled={sending}
            className="min-w-0 flex-1 rounded-xl border border-line bg-black/5 px-3.5 py-2.5 text-xs text-text-main focus:border-brand focus:outline-none dark:bg-white/5"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="rounded-xl bg-brand p-2.5 text-white shadow transition-all hover:bg-brand-hover disabled:opacity-40"
            title="Send message"
          >
            {sending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />}
          </button>
        </form>
      )}
    </div>
  );
};
