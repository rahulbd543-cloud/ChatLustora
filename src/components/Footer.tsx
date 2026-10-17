import React from 'react';
import { useApp } from '../context/AppContext.js';
import { BrandLogo } from './BrandLogo.js';
import { getRoomBySlug } from '../../shared/rooms.js';
import { Shield, Lock, Heart, Globe, Flame, MessageSquare, Video, Shuffle } from 'lucide-react';

export const Footer: React.FC = () => {
  const { openInfoModal, setActiveTab, navigateRoom, t, lang } = useApp();

  const handleJoinBangla = () => {
    const banglaRoom = getRoomBySlug('/bangla-chat');
    if (banglaRoom) navigateRoom(banglaRoom);
  };

  const handleJoinVideo = () => {
    const videoRoom = getRoomBySlug('/video-chat');
    if (videoRoom) navigateRoom(videoRoom);
  };

  return (
    <footer className="w-full border-t border-line bg-raised/70 backdrop-blur-md mt-auto pt-10 pb-8 transition-colors">
      <div className="container-site flex flex-col gap-8">
        {/* Top 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Column 1: Brand & Identity */}
          <div className="flex flex-col gap-3">
            <BrandLogo size="md" showTagline={true} />
            <p className="text-xs text-text-muted leading-relaxed">
              {lang === 'bn'
                ? '১৮+ প্রাপ্তবয়স্কদের সামাজিক আড্ডা প্ল্যাটফর্ম। উন্মুক্ত আলোচনা, ১-অন-১ রুলেট এবং ব্রাউজার-নেটিভ এইচডি ভিডিও কল।'
                : 'Free, anonymous adult social chat network for Bangladeshi, Bengali-speaking, and international communities.'}
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold w-fit">
              <Shield className="w-3.5 h-3.5" />
              <span>Strictly 18+ Adults Only</span>
            </div>
          </div>

          {/* Column 2: Navigation & Quick Launch */}
          <div className="flex flex-col gap-2.5">
            <h4 className="text-xs font-bold text-text-main uppercase tracking-wider">
              {lang === 'bn' ? 'আড্ডার মাধ্যম' : 'Chat Channels'}
            </h4>
            <div className="flex flex-col gap-2 text-xs font-medium text-text-muted">
              <button
                onClick={() => setActiveTab('directory')}
                className="text-left hover:text-brand transition-colors cursor-pointer"
              >
                {lang === 'bn' ? '২৩টি লাইভ রুম ডিরেক্টরি' : '23 Live Chatrooms Directory'}
              </button>
              <button
                onClick={handleJoinBangla}
                className="text-left hover:text-brand transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Flame className="w-3 h-3 text-brand" />
                <span>Bangla Chat (/bangla-chat)</span>
              </button>
              <button
                onClick={handleJoinVideo}
                className="text-left hover:text-brand transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Video className="w-3 h-3 text-indigo-400" />
                <span>WebRTC Video Chat</span>
              </button>
              <button
                onClick={() => setActiveTab('roulette')}
                className="text-left hover:text-brand transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Shuffle className="w-3 h-3 text-amber-500" />
                <span>Random 1-on-1 Roulette</span>
              </button>
            </div>
          </div>

          {/* Column 3: Community & Knowledge */}
          <div className="flex flex-col gap-2.5">
            <h4 className="text-xs font-bold text-text-main uppercase tracking-wider">
              {lang === 'bn' ? 'কমিউনিটি ও জ্ঞান' : 'Community Hub'}
            </h4>
            <div className="flex flex-col gap-2 text-xs font-medium text-text-muted">
              <button
                onClick={() => setActiveTab('blog')}
                className="text-left hover:text-brand transition-colors cursor-pointer"
              >
                {lang === 'bn' ? 'অ্যাডাল্ট সেফটি ও ডেটিং ব্লগ' : 'Safety & Flirting Blog'}
              </button>
              <button
                onClick={() => setActiveTab('forum')}
                className="text-left hover:text-brand transition-colors cursor-pointer"
              >
                {lang === 'bn' ? 'কমিউনিটি উন্মুক্ত ফোরাম' : 'Community Discussion Forum'}
              </button>
              <button
                onClick={() => openInfoModal('guidelines')}
                className="text-left hover:text-brand transition-colors cursor-pointer"
              >
                {t('communityGuidelines')}
              </button>
              <button
                onClick={() => openInfoModal('safety')}
                className="text-left hover:text-brand transition-colors cursor-pointer"
              >
                {t('safetyConsent')}
              </button>
            </div>
          </div>

          {/* Column 4: Legal & Security */}
          <div className="flex flex-col gap-2.5">
            <h4 className="text-xs font-bold text-text-main uppercase tracking-wider">
              {lang === 'bn' ? 'আইনি ও নীতি' : 'Trust & Policies'}
            </h4>
            <div className="flex flex-col gap-2 text-xs font-medium text-text-muted">
              <button
                onClick={() => openInfoModal('terms')}
                className="text-left hover:text-brand transition-colors cursor-pointer"
              >
                {t('termsOfService')}
              </button>
              <button
                onClick={() => openInfoModal('privacy')}
                className="text-left hover:text-brand transition-colors cursor-pointer"
              >
                {t('privacyPolicy')}
              </button>
              <button
                onClick={() => openInfoModal('safety')}
                className="text-left hover:text-brand transition-colors cursor-pointer"
              >
                Zero Tolerance Minor Policy
              </button>
              <button
                onClick={() => openInfoModal('contact')}
                className="text-left hover:text-brand transition-colors cursor-pointer"
              >
                {t('contactSupport')}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Tagline */}
        <div className="pt-6 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-text-muted">
          <div className="flex items-center gap-2">
            <span>&copy; {new Date().getFullYear()} ChatLustora.com. All rights reserved.</span>
            <span>&bull;</span>
            <span className="text-brand font-medium">Flirt Freely. Connect Deeply.</span>
          </div>

          <div className="flex items-center gap-3">
            <span>Adult Entertainment & Social Networking (18+)</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
