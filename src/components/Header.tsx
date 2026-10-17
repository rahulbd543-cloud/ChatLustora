import React, { useState } from 'react';
import { useApp, NavTab } from '../context/AppContext.js';
import { BrandLogo } from './BrandLogo.js';
import { getRoomBySlug } from '../../shared/rooms.js';
import {
  MessageSquare,
  Users,
  Shuffle,
  BookOpen,
  HelpCircle,
  Shield,
  Sun,
  Moon,
  Globe,
  Mail,
  LogOut,
  User,
  Menu,
  X,
  Video,
  Flame,
  Home,
  Sparkles
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    session,
    logout,
    activeTab,
    setActiveTab,
    navigateRoom,
    lang,
    setLang,
    t,
    theme,
    toggleTheme,
    globalPresence,
    unreadDmCount,
    openDmDrawer,
    openAuthModal
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleStartChatting = () => {
    openAuthModal('guest');
    setMobileMenuOpen(false);
  };

  const handleVideoChatClick = () => {
    const videoRoom = getRoomBySlug('/video-chat');
    if (videoRoom) {
      navigateRoom(videoRoom);
    } else {
      setActiveTab('chat');
    }
    setMobileMenuOpen(false);
  };

  return (
    <header className="w-full border-b border-line bg-raised/80 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="container-site flex items-center justify-between h-16">
        {/* Left: Brand Identity */}
        <div
          onClick={() => { setActiveTab('directory'); setMobileMenuOpen(false); }}
          className="cursor-pointer transition-transform active:scale-95 flex items-center gap-2"
        >
          <BrandLogo size="md" showTagline={false} />
        </div>

        {/* Center: Desktop Main Navigation */}
        <nav className="hidden lg:flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-line">
          {/* Home */}
          <button
            onClick={() => setActiveTab('directory')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'directory'
                ? 'bg-brand text-white shadow-sm shadow-brand/20'
                : 'text-text-muted hover:text-text-main hover:bg-white/5'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'হোম' : 'Home'}</span>
          </button>

          {/* Chat Rooms */}
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-brand text-white shadow-sm shadow-brand/20'
                : 'text-text-muted hover:text-text-main hover:bg-white/5'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'রুম আড্ডা' : 'Chat Rooms'}</span>
          </button>

          {/* Video Chat Shortcut */}
          <button
            onClick={handleVideoChatClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-muted hover:text-text-main hover:bg-white/5 transition-all cursor-pointer"
          >
            <Video className="w-3.5 h-3.5 text-indigo-400" />
            <span>{lang === 'bn' ? 'ভিডিও চ্যাট' : 'Video Chat'}</span>
          </button>

          {/* Roulette */}
          <button
            onClick={() => setActiveTab('roulette')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'roulette'
                ? 'bg-brand text-white shadow-sm shadow-brand/20'
                : 'text-text-muted hover:text-text-main hover:bg-white/5'
            }`}
          >
            <Shuffle className="w-3.5 h-3.5 text-amber-400" />
            <span>{lang === 'bn' ? 'রুলেট' : 'Roulette'}</span>
          </button>

          {/* Blog */}
          <button
            onClick={() => setActiveTab('blog')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'blog'
                ? 'bg-brand text-white shadow-sm shadow-brand/20'
                : 'text-text-muted hover:text-text-main hover:bg-white/5'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'ব্লগ' : 'Blog'}</span>
          </button>

          {/* Forum */}
          <button
            onClick={() => setActiveTab('forum')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'forum'
                ? 'bg-brand text-white shadow-sm shadow-brand/20'
                : 'text-text-muted hover:text-text-main hover:bg-white/5'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'ফোরাম' : 'Forum'}</span>
          </button>

          {/* Moderation if Admin/Mod */}
          {(session?.role === 'admin' || session?.role === 'moderator') && (
            <button
              onClick={() => setActiveTab('moderation')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'moderation'
                  ? 'bg-brand text-white'
                  : 'text-text-muted hover:text-text-main hover:bg-white/5'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-red-400" />
              <span>{t('modTab')}</span>
            </button>
          )}
        </nav>

        {/* Right Controls: Online counter, Auth buttons, DMs, Lang, Theme, User */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Synchronized Online Status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-live/10 border border-live/25 text-live text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-live animate-ping" />
            <span className="tabular-nums">{globalPresence.totalConnected || 1}</span>
            <span className="hidden sm:inline font-medium text-[11px] opacity-90">{t('activeOnline')}</span>
          </div>

          {/* Direct Messages Quick Action */}
          {session && (
            <button
              onClick={openDmDrawer}
              title={t('privateMessages')}
              className="relative p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-white/5 transition-colors border border-transparent hover:border-line cursor-pointer"
            >
              <Mail className="w-5 h-5" />
              {unreadDmCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand text-white text-[11px] font-bold flex items-center justify-center animate-bounce shadow">
                  {unreadDmCount}
                </span>
              )}
            </button>
          )}

          {/* Language Switcher */}
          <button
            onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
            title="Switch Language (English / বাংলা)"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border border-line hover:border-brand/50 text-text-muted hover:text-text-main transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-brand" />
            <span>{lang === 'en' ? 'বাং' : 'EN'}</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? t('lightTheme') : t('darkTheme')}
            className="p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-white/5 border border-line transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          </button>

          {/* User Profile Badge & Logout vs 3 Auth Options */}
          {session ? (
            <div className="flex items-center gap-1.5 pl-1 border-l border-line">
              <div
                className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand to-rose-500 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
                title={`${session.nickname} (${session.role})`}
              >
                {session.nickname.slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden xl:flex flex-col text-left">
                <span className="text-xs font-bold leading-tight truncate max-w-[90px]">
                  {session.nickname}
                </span>
                <span className="text-[10px] text-text-muted font-mono capitalize">
                  {session.role}
                </span>
              </div>
              <button
                onClick={logout}
                title="Exit / Logout Session"
                className="p-1.5 rounded-md hover:bg-red-500/10 text-text-muted hover:text-red-500 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-1.5">
              <button
                onClick={() => openAuthModal('guest')}
                className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-text-main text-xs font-bold border border-line transition-colors cursor-pointer"
              >
                {lang === 'bn' ? 'গেস্ট' : 'Guest'}
              </button>
              <button
                onClick={() => openAuthModal('login')}
                className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-text-main text-xs font-bold border border-line transition-colors cursor-pointer"
              >
                {lang === 'bn' ? 'লগইন' : 'Login'}
              </button>
              <button
                onClick={() => openAuthModal('signup')}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-brand to-brand-hover text-white text-xs font-bold shadow-md shadow-brand/20 hover:brightness-110 transition-all cursor-pointer"
              >
                {lang === 'bn' ? 'সাইন আপ' : 'Sign Up'}
              </button>
            </div>
          )}

          {/* Mobile Hamburger Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
            aria-expanded={mobileMenuOpen}
            className="flex lg:hidden p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-white/5 border border-line transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-brand" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer / Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-line bg-raised/95 backdrop-blur-xl px-4 py-3 flex flex-col gap-2 shadow-2xl animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setActiveTab('directory'); setMobileMenuOpen(false); }}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold text-left transition-colors cursor-pointer ${
                activeTab === 'directory' ? 'bg-brand text-white' : 'bg-black/5 dark:bg-white/5 text-text-main'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>{lang === 'bn' ? 'হোম ডিরেক্টরি' : 'Home'}</span>
            </button>

            <button
              onClick={() => { setActiveTab('chat'); setMobileMenuOpen(false); }}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold text-left transition-colors cursor-pointer ${
                activeTab === 'chat' ? 'bg-brand text-white' : 'bg-black/5 dark:bg-white/5 text-text-main'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>{lang === 'bn' ? 'চ্যাট রুম' : 'Chat Rooms'}</span>
            </button>

            <button
              onClick={handleVideoChatClick}
              className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold text-left bg-black/5 dark:bg-white/5 text-text-main hover:text-brand transition-colors cursor-pointer"
            >
              <Video className="w-4 h-4 text-indigo-400" />
              <span>{lang === 'bn' ? 'ভিডিও চ্যাট' : 'Video Chat'}</span>
            </button>

            <button
              onClick={() => { setActiveTab('roulette'); setMobileMenuOpen(false); }}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold text-left transition-colors cursor-pointer ${
                activeTab === 'roulette' ? 'bg-brand text-white' : 'bg-black/5 dark:bg-white/5 text-text-main'
              }`}
            >
              <Shuffle className="w-4 h-4 text-amber-400" />
              <span>{lang === 'bn' ? 'রুলেট' : 'Roulette'}</span>
            </button>

            <button
              onClick={() => { setActiveTab('blog'); setMobileMenuOpen(false); }}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold text-left transition-colors cursor-pointer ${
                activeTab === 'blog' ? 'bg-brand text-white' : 'bg-black/5 dark:bg-white/5 text-text-main'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>{lang === 'bn' ? 'ব্লগ' : 'Blog'}</span>
            </button>

            <button
              onClick={() => { setActiveTab('forum'); setMobileMenuOpen(false); }}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold text-left transition-colors cursor-pointer ${
                activeTab === 'forum' ? 'bg-brand text-white' : 'bg-black/5 dark:bg-white/5 text-text-main'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              <span>{lang === 'bn' ? 'ফোরাম' : 'Forum'}</span>
            </button>

            {(session?.role === 'admin' || session?.role === 'moderator') && (
              <button
                onClick={() => { setActiveTab('moderation'); setMobileMenuOpen(false); }}
                className={`col-span-2 flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold text-left transition-colors cursor-pointer ${
                  activeTab === 'moderation' ? 'bg-brand text-white' : 'bg-black/5 dark:bg-white/5 text-red-400'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>{t('modTab')}</span>
              </button>
            )}
          </div>

          {/* Quick Start Chatting Bar for Mobile */}
          <button
            onClick={handleStartChatting}
            className="w-full mt-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand to-brand-hover text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-brand/20 cursor-pointer"
          >
            <Flame className="w-4 h-4" />
            <span>{lang === 'bn' ? 'সরাসরি আড্ডায় যোগ দিন' : 'Start Chatting Now'}</span>
          </button>
        </div>
      )}
    </header>
  );
};

