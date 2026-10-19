import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext.js';
import {
  Shuffle,
  Send,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Phone,
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

type CallStatus = 'idle' | 'calling' | 'connected' | 'error';
type CallType = 'video' | 'audio' | null;

export const RoulettePanel: React.FC = () => {
  const { session, t } = useApp();

  const [rouletteState, setRouletteState] = useState<'idle' | 'queued' | 'matched'>('idle');
  const [partnerInfo, setPartnerInfo] = useState<{ id: string; nickname: string } | null>(null);
  const [messages, setMessages] = useState<RouletteMsg[]>([]);
  const [inputText, setInputText] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // WebRTC Call State
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callType, setCallType] = useState<CallType>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [callErrorMessage, setCallErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  // WebRTC References
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const pendingIceCandidates = useRef<RTCIceCandidateInit[]>([]);
  const activeMatchPartnerId = useRef<string | null>(null);

  // Default ICE servers with standard public STUN fallback
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ];

  // Full Call Cleanup
  const cleanupCall = useCallback(() => {
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        track.stop();
      });
      localStream.current = null;
    }

    if (peerConnection.current) {
      peerConnection.current.onicecandidate = null;
      peerConnection.current.ontrack = null;
      peerConnection.current.onconnectionstatechange = null;
      peerConnection.current.close();
      peerConnection.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    pendingIceCandidates.current = [];
    setCallStatus('idle');
    setCallType(null);
    setIsAudioMuted(false);
    setIsVideoMuted(false);
  }, []);

  // Flush queued ICE candidates
  const flushPendingIceCandidates = async (pc: RTCPeerConnection) => {
    if (pendingIceCandidates.current.length > 0) {
      for (const candidate of pendingIceCandidates.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('Error applying pending ICE candidate:', err);
        }
      }
      pendingIceCandidates.current = [];
    }
  };

  // Create a new RTCPeerConnection with listeners
  const createPeerConnection = useCallback((targetPartnerId: string, type: 'video' | 'audio') => {
    const pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = (event) => {
      if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'signal',
          signalType: 'ice-candidate',
          payload: event.candidate.toJSON(),
          recipientId: targetPartnerId
        }));
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0] && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setCallStatus('connected');
        setCallErrorMessage(null);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallStatus('connected');
        setCallErrorMessage(null);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setCallStatus('error');
        setCallErrorMessage('Call connection dropped or failed.');
      } else if (pc.connectionState === 'closed') {
        cleanupCall();
      }
    };

    peerConnection.current = pc;
    return pc;
  }, [ws, cleanupCall]);

  // Start Media Acquisition
  const acquireMedia = async (videoRequired: boolean): Promise<MediaStream | null> => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: videoRequired ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStream.current = stream;

      if (localVideoRef.current && videoRequired) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err: any) {
      let msg = 'Failed to access camera or microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera or microphone access denied. Please grant permission in your browser.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No audio or video input device was found.';
      }
      setCallStatus('error');
      setCallErrorMessage(msg);
      setStatusNotice(msg);
      return null;
    }
  };

  // Initiate an Outgoing Call (Offerer)
  const startCall = async (type: 'video' | 'audio') => {
    if (!partnerInfo || !ws || ws.readyState !== WebSocket.OPEN) return;

    cleanupCall();
    setCallStatus('calling');
    setCallType(type);
    setCallErrorMessage(null);

    const stream = await acquireMedia(type === 'video');
    if (!stream) return;

    const pc = createPeerConnection(partnerInfo.id, type);
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: type === 'video'
      });
      await pc.setLocalDescription(offer);

      ws.send(JSON.stringify({
        type: 'signal',
        signalType: 'offer',
        payload: { sdp: offer, callType: type },
        recipientId: partnerInfo.id
      }));
    } catch (err) {
      setCallStatus('error');
      setCallErrorMessage('Failed to create call offer.');
      cleanupCall();
    }
  };

  // End Current Call
  const handleEndCall = () => {
    if (ws && ws.readyState === WebSocket.OPEN && partnerInfo) {
      ws.send(JSON.stringify({
        type: 'signal',
        signalType: 'call-ended',
        recipientId: partnerInfo.id
      }));
    }
    cleanupCall();
    setStatusNotice('Call ended.');
  };

  // Toggle Mute Audio
  const toggleMuteAudio = () => {
    if (localStream.current) {
      const audioTracks = localStream.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsAudioMuted(prev => !prev);
    }
  };

  // Toggle Mute Video
  const toggleMuteVideo = () => {
    if (localStream.current) {
      const videoTracks = localStream.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoMuted(prev => !prev);
    }
  };

  // WebSocket Connection Management
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/roulette/ws`);

    socket.onopen = () => {
      setWs(socket);
    };

    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'queued') {
          cleanupCall();
          setRouletteState('queued');
          setStatusNotice(t('rouletteSearching'));
          setPartnerInfo(null);
          activeMatchPartnerId.current = null;
        } else if (data.type === 'matched') {
          cleanupCall();
          setRouletteState('matched');
          const pInfo = { id: data.partnerId, nickname: data.partnerId.substring(0, 8) };
          setPartnerInfo(pInfo);
          activeMatchPartnerId.current = data.partnerId;
          setStatusNotice(null);
          setMessages([
            {
              senderNickname: 'System',
              text: 'Matched with a partner! Say hi or start a video/audio call.',
              timestamp: Date.now()
            }
          ]);
        } else if (data.type === 'left') {
          cleanupCall();
          setRouletteState('idle');
          setPartnerInfo(null);
          activeMatchPartnerId.current = null;
          setStatusNotice('Partner disconnected or skipped.');
        } else if (data.type === 'message') {
          setMessages(prev => [
            ...prev,
            {
              senderNickname: data.senderNickname || 'Partner',
              text: data.text,
              timestamp: data.timestamp || Date.now()
            }
          ]);
        } else if (data.type === 'signal') {
          const { signalType, payload } = data;
          const partnerId = activeMatchPartnerId.current;
          if (!partnerId) return;

          if (signalType === 'offer') {
            const incomingCallType = payload.callType || 'video';
            cleanupCall();
            setCallStatus('calling');
            setCallType(incomingCallType);

            const stream = await acquireMedia(incomingCallType === 'video');
            if (!stream) {
              socket.send(JSON.stringify({
                type: 'signal',
                signalType: 'call-declined',
                payload: { reason: 'permission_denied' },
                recipientId: partnerId
              }));
              return;
            }

            const pc = createPeerConnection(partnerId, incomingCallType);
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            const sdpOffer = payload.sdp || payload;
            await pc.setRemoteDescription(new RTCSessionDescription(sdpOffer));
            await flushPendingIceCandidates(pc);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socket.send(JSON.stringify({
              type: 'signal',
              signalType: 'answer',
              payload: answer,
              recipientId: partnerId
            }));
          } else if (signalType === 'answer') {
            const pc = peerConnection.current;
            if (pc && pc.signalingState !== 'stable') {
              await pc.setRemoteDescription(new RTCSessionDescription(payload));
              await flushPendingIceCandidates(pc);
              setCallStatus('connected');
            }
          } else if (signalType === 'ice-candidate') {
            const pc = peerConnection.current;
            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(payload));
              } catch (err) {
                console.warn('Failed to add candidate:', err);
              }
            } else {
              pendingIceCandidates.current.push(payload);
            }
          } else if (signalType === 'call-ended' || signalType === 'call-declined') {
            cleanupCall();
            setStatusNotice(signalType === 'call-declined' ? 'Call was declined by partner.' : 'Call ended by partner.');
          }
        }
      } catch (err) {
        console.error('Error handling roulette websocket message:', err);
      }
    };

    socket.onclose = () => {
      setWs(null);
      cleanupCall();
    };

    return () => {
      cleanupCall();
      socket.close();
    };
  }, [cleanupCall, createPeerConnection, t]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStartQueue = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      setStatusNotice(null);
      cleanupCall();
      ws.send(JSON.stringify({ type: 'join' }));
    }
  };

  const handleSkip = () => {
    cleanupCall();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'skip' }));
    }
  };

  const handleLeave = () => {
    cleanupCall();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'skip' }));
    }
    setRouletteState('idle');
    setPartnerInfo(null);
    activeMatchPartnerId.current = null;
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputText.trim();
    if (!clean) return;

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'message',
        text: clean,
        senderNickname: session?.nickname || 'You'
      }));
      setMessages(prev => [
        ...prev,
        {
          senderNickname: session?.nickname || 'You',
          text: clean,
          timestamp: Date.now()
        }
      ]);
      setInputText('');
    }
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
            {callStatus === 'idle' ? (
              <>
                <button
                  onClick={() => startCall('video')}
                  className="px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Video Call</span>
                </button>
                <button
                  onClick={() => startCall('audio')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Audio Call</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleEndCall}
                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>End Call</span>
              </button>
            )}

            <button
              onClick={handleSkip}
              className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t('skipPartner')}</span>
            </button>
            <button
              onClick={handleLeave}
              className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-red-500/20 hover:text-red-500 text-text-muted text-xs font-semibold transition-colors cursor-pointer"
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
              className="mt-2 px-4 py-2 rounded-xl border border-line text-xs font-semibold text-text-muted hover:text-text-main transition-colors cursor-pointer"
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

              <div className="flex items-center gap-2">
                {callStatus !== 'idle' && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-brand/10 border border-brand/30 text-brand font-medium animate-pulse">
                    {callStatus === 'calling' && 'Connecting Call...'}
                    {callStatus === 'connected' && (callType === 'video' ? 'Live Video Active' : 'Live Audio Active')}
                    {callStatus === 'error' && 'Call Failed'}
                  </span>
                )}
                <span className="text-[11px] text-text-muted hidden sm:inline">
                  Press "Skip" at any time to disconnect and match again.
                </span>
              </div>
            </div>

            {/* Dedicated WebRTC Media Stage (When in active or initiating call) */}
            {callStatus !== 'idle' && (
              <div className="relative w-full bg-black/90 aspect-video max-h-72 sm:max-h-80 flex items-center justify-center overflow-hidden border-b border-line shrink-0">
                {/* Remote Video */}
                {callType === 'video' ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-white">
                    <div className="w-16 h-16 rounded-full bg-brand/20 border-2 border-brand flex items-center justify-center text-brand animate-pulse">
                      <Phone className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-semibold">Audio Call with {partnerInfo.nickname}</span>
                    <audio ref={remoteVideoRef as any} autoPlay playsInline />
                  </div>
                )}

                {/* Local Video PIP (For Video Calls) */}
                {callType === 'video' && (
                  <div className="absolute bottom-3 right-3 w-28 h-20 sm:w-36 sm:h-24 rounded-xl overflow-hidden border-2 border-brand/60 shadow-xl bg-black">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {isVideoMuted && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-[10px] text-white">
                        Camera Off
                      </div>
                    )}
                  </div>
                )}

                {/* In-Call Controls Floating Overlay */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur border border-white/20 shadow-2xl">
                  <button
                    onClick={toggleMuteAudio}
                    title={isAudioMuted ? 'Unmute Mic' : 'Mute Mic'}
                    className={`p-2 rounded-full text-white transition-colors cursor-pointer ${
                      isAudioMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30'
                    }`}
                  >
                    {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  {callType === 'video' && (
                    <button
                      onClick={toggleMuteVideo}
                      title={isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
                      className={`p-2 rounded-full text-white transition-colors cursor-pointer ${
                        isVideoMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30'
                      }`}
                    >
                      {isVideoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                    </button>
                  )}

                  <button
                    onClick={handleEndCall}
                    title="End Call"
                    className="p-2 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer"
                  >
                    <PhoneOff className="w-4 h-4" />
                  </button>
                </div>

                {callErrorMessage && (
                  <div className="absolute top-3 left-3 px-3 py-1 rounded-lg bg-red-600/90 text-white text-[11px] font-medium shadow">
                    {callErrorMessage}
                  </div>
                )}
              </div>
            )}

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
                className="p-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold transition-all shadow disabled:opacity-40 cursor-pointer"
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
