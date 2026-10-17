import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.js';
import { PrivateMessage, PrivateConversation } from '../../shared/types.js';
import {
  X,
  Send,
  Video,
  Phone,
  Slash,
  MessageCircle,
  ArrowLeft,
  Search,
  User
} from 'lucide-react';

export const PrivateMessages: React.FC = () => {
  const {
    session,
    socket,
    isDmDrawerOpen,
    activeDmUserId,
    activeDmPartnerNickname,
    closeDm,
    openDmWith,
    startCall,
    blockedUsers,
    blockUser,
    t
  } = useApp();

  const [partnerNickname, setPartnerNickname] = useState(activeDmPartnerNickname);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [conversations, setConversations] = useState<PrivateConversation[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync partner nickname
  useEffect(() => {
    if (activeDmPartnerNickname) {
      setPartnerNickname(activeDmPartnerNickname);
    }
  }, [activeDmPartnerNickname]);

  // Fetch conversations list when drawer is opened
  const fetchConversations = () => {
    if (!session?.token) return;
    fetch('/api/dm/conversations', {
      headers: { Authorization: `Bearer ${session.token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.conversations) {
          setConversations(data.conversations);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (isDmDrawerOpen) {
      fetchConversations();
    }
  }, [isDmDrawerOpen, activeDmUserId]);

  // Load message history when an active DM user is selected
  useEffect(() => {
    if (!socket || !activeDmUserId) return;

    socket.emit('dm:get_history', { partnerId: activeDmUserId });

    const handleDmHistory = (data: { partnerId: string; messages: PrivateMessage[] }) => {
      if (data.partnerId === activeDmUserId) {
        setMessages(data.messages);
      }
    };

    const handleNewDm = (msg: PrivateMessage) => {
      if (
        (msg.senderId === activeDmUserId && msg.recipientId === session?.userId) ||
        (msg.senderId === session?.userId && msg.recipientId === activeDmUserId)
      ) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
      fetchConversations();
    };

    socket.on('dm:history', handleDmHistory);
    socket.on('dm:new', handleNewDm);

    return () => {
      socket.off('dm:history', handleDmHistory);
      socket.off('dm:new', handleNewDm);
    };
  }, [socket, activeDmUserId, session?.userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isDmDrawerOpen) return null;

  const isBlocked = activeDmUserId ? blockedUsers.has(activeDmUserId) : false;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputText.trim();
    if (!clean || !socket || !activeDmUserId) return;

    socket.emit('dm:send', {
      recipientId: activeDmUserId,
      text: clean
    });

    setInputText('');
  };

  // 1. CONVERSATIONS LIST (INBOX VIEW)
  if (!activeDmUserId) {
    const filteredConvs = conversations.filter(c => {
      const partnerId = c.participantIds.find(id => id !== session?.userId) || '';
      const name = c.participantNicknames?.[partnerId] || partnerId;
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-raised border-l border-line shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-raised/90 backdrop-blur">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-brand" />
            <h3 className="text-sm font-bold text-text-main">{t('privateMessages')}</h3>
          </div>
          <button
            onClick={closeDm}
            className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-main transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-line">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-line text-xs focus:border-brand focus:outline-none"
            />
          </div>
        </div>

        {/* Conversations Stream */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {filteredConvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center my-auto p-6 text-center text-text-muted gap-2">
              <MessageCircle className="w-8 h-8 opacity-40 text-brand" />
              <p className="text-xs font-semibold">No direct messages yet.</p>
              <p className="text-[11px]">Click on any user in a chatroom to start a private conversation.</p>
            </div>
          ) : (
            filteredConvs.map(conv => {
              const partnerId = conv.participantIds.find(id => id !== session?.userId) || '';
              const nickname = conv.participantNicknames?.[partnerId] || partnerId;

              return (
                <div
                  key={conv.id}
                  onClick={() => openDmWith(partnerId, nickname)}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-line"
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand to-rose-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {nickname.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col truncate text-left">
                      <span className="text-xs font-bold text-text-main truncate">
                        {nickname}
                      </span>
                      <span className="text-[11px] text-text-muted truncate max-w-[180px]">
                        {conv.lastMessage || 'No messages yet'}
                      </span>
                    </div>
                  </div>

                  {conv.lastTimestamp && (
                    <span className="text-[10px] text-text-muted shrink-0">
                      {new Date(conv.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // 2. ACTIVE CONVERSATION WITH PARTNER
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-raised border-l border-line shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-raised/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            onClick={() => openDmWith('')}
            title="Back to conversations list"
            className="p-1 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-main transition-colors mr-0.5"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold shrink-0">
            {partnerNickname.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-text-main truncate max-w-[120px]">
              {partnerNickname}
            </span>
            <span className="text-[10px] text-live font-medium">1-on-1 Direct Chat</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Audio & Video Call buttons */}
          <button
            onClick={() => startCall(activeDmUserId, partnerNickname, 'video')}
            className="p-1.5 rounded-lg hover:bg-brand hover:text-white text-text-muted transition-colors"
            title="Start Video Call"
          >
            <Video className="w-4 h-4" />
          </button>
          <button
            onClick={() => startCall(activeDmUserId, partnerNickname, 'audio')}
            className="p-1.5 rounded-lg hover:bg-brand hover:text-white text-text-muted transition-colors"
            title="Start Voice Call"
          >
            <Phone className="w-4 h-4" />
          </button>
          {/* Block user button */}
          <button
            onClick={() => blockUser(activeDmUserId)}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
            title="Block User"
          >
            <Slash className="w-4 h-4" />
          </button>
          {/* Close drawer */}
          <button
            onClick={closeDm}
            className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-main transition-colors ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center my-auto text-center text-text-muted gap-2">
            <MessageCircle className="w-8 h-8 opacity-40 text-brand" />
            <p className="text-xs font-semibold">Start your private 1-on-1 conversation.</p>
            <p className="text-[10px]">Messages are confidential between both participants.</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.senderId === session?.userId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[80%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
              >
                <div
                  className={`px-3 py-2 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                    isMe
                      ? 'bg-brand text-white rounded-tr-none'
                      : 'bg-black/5 dark:bg-white/10 text-text-main rounded-tl-none border border-line'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[9px] text-text-muted mt-0.5">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Blocked banner or Composer */}
      {isBlocked ? (
        <div className="p-4 bg-red-500/10 border-t border-red-500/20 text-center text-xs text-red-400">
          You have blocked this user. Messages cannot be sent.
        </div>
      ) : (
        <form
          onSubmit={handleSend}
          className="p-3 border-t border-line bg-raised/90 backdrop-blur flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Type a private message..."
            maxLength={1000}
            className="flex-1 px-3.5 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-line focus:border-brand focus:outline-none text-xs text-text-main"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-40 text-white font-bold transition-all shadow"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}
    </div>
  );
};
