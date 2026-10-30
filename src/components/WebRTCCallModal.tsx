import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.js';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  PhoneCall,
  Volume2,
  AlertCircle
} from 'lucide-react';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export const WebRTCCallModal: React.FC = () => {
  const { activeCall, acceptCall, declineCall, endCall, socket, session, t } = useApp();

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [customIceServers, setCustomIceServers] = useState<RTCIceServer[]>(RTC_CONFIG.iceServers!);

  useEffect(() => {
    fetch('/api/webrtc/config')
      .then(res => {
        if (!res.ok) return null;
        return res.json();
      })
      .then(data => {
        if (data?.iceServers && Array.isArray(data.iceServers)) {
          setCustomIceServers(data.iceServers);
        }
      })
      .catch(() => {});
  }, []);

  // Initialize WebRTC connection when call state transitions to connected
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'connected' || !socket) return;

    let pc = new RTCPeerConnection({ iceServers: customIceServers });
    peerConnectionRef.current = pc;

    // Start duration timer
    setCallDuration(0);
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    // Get user media
    const isVideo = activeCall.type === 'video';
    navigator.mediaDevices
      ?.getUserMedia({
        video: isVideo ? { width: { ideal: 640 }, height: { ideal: 480 } } : false,
        audio: true
      })
      .then(stream => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });

        // If user initiated the call, create offer
        if (!activeCall.isIncoming) {
          pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .then(() => {
              socket.emit('call:signal', {
                callId: activeCall.callId,
                toUserId: activeCall.partnerId,
                signalType: 'offer',
                signalData: pc.localDescription
              });
            })
            .catch(err => {
              console.error('Error creating offer:', err);
              setErrorStatus('Could not negotiate connection.');
            });
        }
      })
      .catch(err => {
        console.warn('getUserMedia error:', err);
        setErrorStatus('Camera or microphone permission was denied.');
      });

    // Handle incoming remote stream tracks
    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('call:signal', {
          callId: activeCall.callId,
          toUserId: activeCall.partnerId,
          signalType: 'ice-candidate',
          signalData: event.candidate
        });
      }
    };

    // Handle incoming signals from partner
    const handleSignal = async (payload: any) => {
      if (payload.callId !== activeCall.callId) return;

      try {
        if (payload.signalType === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.signalData));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('call:signal', {
            callId: activeCall.callId,
            toUserId: activeCall.partnerId,
            signalType: 'answer',
            signalData: pc.localDescription
          });
        } else if (payload.signalType === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.signalData));
        } else if (payload.signalType === 'ice-candidate') {
          await pc.addIceCandidate(new RTCIceCandidate(payload.signalData));
        }
      } catch (err) {
        console.error('Signaling error:', err);
      }
    };

    socket.on('call:signal', handleSignal);

    return () => {
      socket.off('call:signal', handleSignal);
      if (timerRef.current) clearInterval(timerRef.current);

      // Clean up media tracks and peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    };
  }, [activeCall?.status, activeCall?.callId]);

  if (!activeCall) return null;

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoDisabled(!isVideoDisabled);
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // 1. INCOMING CALL NOTIFICATION STATE
  if (activeCall.status === 'incoming') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
        <div className="w-full max-w-sm bg-raised border border-brand/40 rounded-2xl shadow-2xl p-6 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand/20 border-2 border-brand flex items-center justify-center text-brand animate-pulse">
            <PhoneCall className="w-8 h-8" />
          </div>

          <div className="flex flex-col">
            <span className="text-xs text-text-muted font-medium">
              {t('incomingCall')}
            </span>
            <h3 className="text-lg font-bold text-text-main mt-0.5">
              {activeCall.partnerNickname}
            </h3>
            <span className="text-xs text-brand font-semibold capitalize mt-1">
              {activeCall.type === 'video' ? 'WebRTC Video Cam Call' : 'WebRTC Voice Call'}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full mt-2">
            <button
              onClick={declineCall}
              className="flex-1 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-500 font-bold text-xs transition-colors"
            >
              {t('declineCall')}
            </button>
            <button
              onClick={acceptCall}
              className="flex-1 py-2.5 rounded-xl bg-live hover:bg-emerald-600 text-white font-bold text-xs shadow-lg shadow-live/25 transition-colors"
            >
              {t('acceptCall')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. OUTGOING CALLING STATE
  if (activeCall.status === 'calling') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
        <div className="w-full max-w-sm bg-raised border border-line rounded-2xl shadow-2xl p-6 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand/20 flex items-center justify-center text-brand animate-bounce">
            <PhoneCall className="w-8 h-8" />
          </div>

          <div className="flex flex-col">
            <span className="text-xs text-text-muted">{t('calling')}</span>
            <h3 className="text-lg font-bold text-text-main mt-0.5">
              {activeCall.partnerNickname}
            </h3>
            <span className="text-xs text-text-muted mt-1">Waiting for partner to accept...</span>
          </div>

          <button
            onClick={endCall}
            className="w-full py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs transition-colors mt-2"
          >
            Cancel Call
          </button>
        </div>
      </div>
    );
  }

  // 3. CONNECTED CALL ACTIVE UI
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/90 backdrop-blur-lg animate-in fade-in">
      <div className="relative w-full max-w-4xl h-[85vh] bg-black rounded-2xl overflow-hidden border border-line shadow-2xl flex flex-col">
        {/* Remote Video Stream (Main viewport) */}
        <div className="relative flex-1 bg-zinc-950 flex items-center justify-center overflow-hidden">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Partner Avatar placeholder if remote video disabled */}
          <div className="absolute flex flex-col items-center gap-2 pointer-events-none opacity-40">
            <div className="w-20 h-20 rounded-full bg-brand/40 flex items-center justify-center text-white text-2xl font-bold">
              {activeCall.partnerNickname.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-sm font-bold text-white">
              {activeCall.partnerNickname}
            </span>
          </div>

          {/* Local Camera Picture-in-Picture Preview (Muted by default to prevent feedback loop) */}
          <div className="absolute top-4 right-4 w-32 sm:w-44 aspect-video bg-zinc-900 rounded-xl overflow-hidden border-2 border-white/20 shadow-xl z-10">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />
            <span className="absolute bottom-1 left-2 text-[10px] text-white/80 font-semibold bg-black/60 px-1 rounded">
              You
            </span>
          </div>

          {/* Top Bar Call Info */}
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-white text-xs border border-white/10 z-10">
            <span className="w-2 h-2 rounded-full bg-live animate-ping" />
            <span className="font-bold">{activeCall.partnerNickname}</span>
            <span>&bull;</span>
            <span className="font-mono text-white/80">{formatDuration(callDuration)}</span>
          </div>

          {errorStatus && (
            <div className="absolute bottom-20 px-4 py-2 bg-red-500/80 text-white text-xs font-semibold rounded-lg flex items-center gap-2 z-20">
              <AlertCircle className="w-4 h-4" />
              <span>{errorStatus}</span>
            </div>
          )}
        </div>

        {/* Call Controls Toolbar */}
        <div className="h-18 bg-zinc-900/90 border-t border-white/10 flex items-center justify-center gap-4 px-4 shrink-0">
          {/* Mute Mic */}
          <button
            onClick={toggleMute}
            className={`p-3 rounded-full transition-colors cursor-pointer ${
              isMuted ? 'bg-red-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={isMuted ? t('unmuteMic') : t('muteMic')}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Toggle Cam */}
          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full transition-colors cursor-pointer ${
              isVideoDisabled ? 'bg-red-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={isVideoDisabled ? t('cameraOn') : t('cameraOff')}
          >
            {isVideoDisabled ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
          </button>

          {/* End Call */}
          <button
            onClick={endCall}
            className="px-6 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-600/30 transition-transform active:scale-95 cursor-pointer"
            title={t('endCall')}
          >
            <PhoneOff className="w-4 h-4" />
            <span>{t('endCall')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
