import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.js';
import {
  Shuffle,
  Send,
  Video,
  PhoneOff,
  User,
  Shield,
  Loader2,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

interface RouletteMsg {
  senderNickname: string;
  text: string;
  timestamp: number;
}

export const RoulettePanel: React.FC = () => {
  const { session, socket, t, lang, startCall } = useApp();

  const [rouletteState, setRouletteState] = useState<'idle' | 'queued' | 'matched'>('idle');
  const [partnerInfo, setPartnerInfo] = useState<{ id: string; nickname: string } | null>(null);
  const [messages, setMessages] = useState<RouletteMsg[]>([]);
  const [inputText, setInputText] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [ws, setWs] = useState<WebSocket | null>(null);

  // Connect/Disconnect logic
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/roulette/ws`);
    
    socket.onopen = () => {
      setWs(socket);
    };

    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'queued') {
        setRouletteState('queued');
        setStatusNotice(t('rouletteSearching'));
        setPartnerInfo(null);
      } else if (data.type === 'matched') {
        setRouletteState('matched');
        setPartnerInfo({ id: data.partnerId, nickname: data.partnerId }); // Simplified for now
        setStatusNotice(null);
      } else if (data.type === 'left') {
        setRouletteState('idle');
        setPartnerInfo(null);
        setStatusNotice('Partner disconnected.');
      } else if (data.type === 'signal') {
        const pc = peerConnection.current;
        if (!pc) return;

        if (data.signalType === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws?.send(JSON.stringify({
            type: 'signal',
            signalType: 'answer',
            payload: answer,
            recipientId: data.senderId
          }));
        } else if (data.signalType === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
        } else if (data.signalType === 'ice-candidate') {
          await pc.addIceCandidate(new RTCIceCandidate(data.payload));
        }
      }
    };

    socket.onclose = () => setWs(null);
    return () => socket.close();
  }, []);

  const handleStartQueue = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'join' }));
    }
  };

  const handleSkip = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'skip' }));
    }
  };

  // WebRTC
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const startMedia = async (video: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
      localStream.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err) {
      console.error('Media access denied:', err);
      return null;
    }
  };

  const initCall = async (partnerId: string, video: boolean) => {
    const stream = await startMedia(video);
    if (!stream) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        ws?.send(JSON.stringify({
          type: 'signal',
          signalType: 'ice-candidate',
          payload: event.candidate,
          recipientId: partnerId
        }));
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };

    peerConnection.current = pc;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    ws?.send(JSON.stringify({
      type: 'signal',
      signalType: 'offer',
      payload: offer,
      recipientId: partnerId
    }));
  };

  const cleanupCall = () => {
    if (localStream.current) {
      localStream.current.getTracks().forEach(t => t.stop());
      localStream.current = null;
    }
    peerConnection.current?.close();
    peerConnection.current = null;
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputText.trim();
    if (!clean || !socket) return;

    socket.emit('roulette:message', { text: clean });
    setMessages(prev => [
      ...prev,
      {
        senderNickname: session?.nickname || 'You',
        text: clean,
        timestamp: Date.now()
      }
    ]);
    setInputText('');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-raised/40 p-4 sm:p-6 lg:p-8 overflow-hidden">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-line gap-2 shrink-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-text-main flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-brand" />
            <span>{t('rouletteTitle')}</span>
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            {t('rouletteDesc')}
          </p>
        </div>

        {/* Global Action Status */}
        {rouletteState === 'matched' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => partnerInfo && startCall(partnerInfo.id, partnerInfo.nickname, 'video')}
              className="px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Start Cam</span>
            </button>
            <button
              onClick={handleSkip}
              className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t('skipPartner')}</span>
            </button>
            <button
              onClick={handleLeave}
              className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-red-500/20 hover:text-red-500 text-text-muted text-xs font-semibold transition-colors"
            >
              Leave
            </button>
          </div>
        )}
      </div>

      {/* Main Roulette Work Area */}
      <div className="flex-1 flex flex-col mt-4 rounded-2xl bg-raised border border-line overflow-hidden shadow-lg min-h-0">
        {/* 1. IDLE STATE */}
        {rouletteState === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-5 my-auto">
            <div className="w-20 h-20 rounded-full bg-brand/10 border-2 border-brand/30 flex items-center justify-center text-brand">
              <Shuffle className="w-10 h-10" />
            </div>

            <div className="max-w-md flex flex-col gap-2">
              <h3 className="text-lg font-bold text-text-main">
                Ready for random adult matching?
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Connect 1-on-1 with another active adult member. Chat freely, exchange webcam feeds, or hit Skip at any moment to find someone new.
              </p>
            </div>

            {statusNotice && (
              <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-line text-xs text-brand font-medium">
                {statusNotice}
              </div>
            )}

            <button
              onClick={handleStartQueue}
              className="py-3 px-8 rounded-xl bg-brand hover:bg-brand-hover text-white font-extrabold text-sm shadow-xl shadow-brand/25 transition-all active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <Shuffle className="w-4 h-4" />
              <span>{t('startRoulette')}</span>
            </button>
          </div>
        )}

        {/* 2. QUEUED STATE */}
        {rouletteState === 'queued' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4 my-auto animate-in fade-in">
            <Loader2 className="w-12 h-12 text-brand animate-spin" />
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-bold text-text-main">
                {t('rouletteSearching')}
              </h3>
              <p className="text-xs text-text-muted">
                Matching you with an available consenting adult...
              </p>
            </div>
            <button
              onClick={handleLeave}
              className="mt-2 px-4 py-2 rounded-xl border border-line text-xs font-semibold text-text-muted hover:text-text-main transition-colors"
            >
              Cancel Search
            </button>
          </div>
        )}

        {/* 3. MATCHED STATE */}
        {rouletteState === 'matched' && partnerInfo && (
          <div className="flex-1 flex flex-col h-full min-h-0">
            {/* Top Partner Bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-black/5 dark:bg-white/5 border-b border-line shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold">
                  {partnerInfo.nickname.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-text-main">
                    {partnerInfo.nickname}
                  </span>
                  <span className="text-[10px] text-live flex items-center gap-1 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-live" /> Paired
                  </span>
                </div>
              </div>

              <span className="text-[11px] text-text-muted hidden sm:inline">
                Press "Skip" at any time to disconnect and match again.
              </span>
            </div>

            {/* Conversation Stream */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 min-h-0">
              {messages.map((m, idx) => {
                const isMe = m.senderNickname === session?.nickname;
                const isSys = m.senderNickname === 'System';

                if (isSys) {
                  return (
                    <div
                      key={idx}
                      className="self-center my-1 text-[11px] text-text-muted bg-black/5 dark:bg-white/5 px-3 py-1 rounded-full border border-line"
                    >
                      {m.text}
                    </div>
                  );
                }

                return (
                  <div
                    key={idx}
                    className={`flex flex-col max-w-[80%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
                  >
                    <span className="text-[10px] text-text-muted mb-0.5 font-bold">
                      {isMe ? 'You' : m.senderNickname}
                    </span>
                    <div
                      className={`px-3 py-2 rounded-2xl text-xs sm:text-sm break-words shadow-sm leading-relaxed ${
                        isMe
                          ? 'bg-brand text-white rounded-tr-none'
                          : 'bg-black/5 dark:bg-white/10 text-text-main rounded-tl-none border border-line'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Composer */}
            <form
              onSubmit={handleSend}
              className="p-3 border-t border-line bg-raised/80 backdrop-blur flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Say something playful to your match..."
                maxLength={1000}
                className="flex-1 px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-line focus:border-brand focus:outline-none text-xs sm:text-sm text-text-main"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold transition-all shadow disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
