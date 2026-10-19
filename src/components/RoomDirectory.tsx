import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.js';
import { INITIAL_CHATROOMS, Chatroom, CATEGORIES, RoomCategory, getRoomBySlug } from '../../shared/rooms.js';
import {
  Search,
  Users,
  Video,
  Shuffle,
  Globe,
  ArrowRight,
  Shield,
  Flame,
  Sparkles,
  Lock,
  Heart,
  MessageCircle,
  HelpCircle,
  CheckCircle2,
  ChevronDown,
  BookOpen,
  Zap,
  EyeOff,
  UserCheck,
  Radio,
  Share2
} from 'lucide-react';

export const RoomDirectory: React.FC = () => {
  const { navigateRoom, setActiveTab, globalPresence, openInfoModal, openAuthModal, session, t, lang } = useApp();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<RoomCategory | 'all'>('all');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Filter 23 canonical rooms
  const filteredRooms = useMemo(() => {
    return INITIAL_CHATROOMS.filter(room => {
      if (selectedCategory !== 'all' && room.category !== selectedCategory && room.tag !== selectedCategory) {
        return false;
      }
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchName = room.name.toLowerCase().includes(query);
        const matchDesc = room.description.toLowerCase().includes(query);
        const matchLang = room.language.toLowerCase().includes(query);
        const matchTags = (room.tags || [room.tag]).some((t: string) => t.toLowerCase().includes(query));
        const matchSlug = room.slug.toLowerCase().includes(query);
        return matchName || matchDesc || matchLang || matchTags || matchSlug;
      }
      return true;
    });
  }, [search, selectedCategory]);

  const handleJoinBangla = () => {
    const banglaRoom = getRoomBySlug('/bangla-chat');
    if (banglaRoom) navigateRoom(banglaRoom);
  };

  const handleJoinVideo = () => {
    const videoRoom = getRoomBySlug('/video-chat');
    if (videoRoom) navigateRoom(videoRoom);
  };

  const handleJoinRoulette = () => {
    setActiveTab('roulette');
  };

  const scrollToDirectory = () => {
    const el = document.getElementById('rooms-directory-anchor');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const toggleFaq = (idx: number) => {
    setOpenFaqIndex(openFaqIndex === idx ? null : idx);
  };

  // FAQs data
  const faqs = [
    {
      qEn: 'Is ChatLustora really 100% free to use?',
      qBn: 'চ্যাটলাস্টোরা কি সত্যিই সম্পূর্ণ ফ্রি?',
      aEn: 'Yes! ChatLustora is completely free of charge. You do not need a subscription, credit card, or payment to join any of our 23 group chatrooms, chat 1-on-1, or use live video features.',
      aBn: 'হ্যাঁ! চ্যাটলাস্টোরা পুরোপুরি বিনামূল্যে উন্মুক্ত। ২৩টি রুমের যেকোনোটিতে আড্ডা দেওয়া, ১-অন-১ চ্যাট কিংবা লাইভ ভিডিও কলে কোনো সাবস্ক্রিপশন বা ফি প্রযোজ্য নয়।'
    },
    {
      qEn: 'Do I need to register or provide an email to start chatting?',
      qBn: 'আড্ডা শুরু করতে কি রেজিস্ট্রেশন বা ইমেইল দেওয়া বাধ্যতামূলক?',
      aEn: 'No registration is required! As an adult (18+), you can simply confirm your age, enter any nickname you like, and instantly start conversing in public rooms, private direct messages, or random stranger roulette.',
      aBn: 'না, কোনো বাধ্যতামূলক রেজিস্ট্রেশনের প্রয়োজন নেই! ১৮+ প্রাপ্তবয়স্ক নিশ্চিত করে যেকোনো পছন্দের নাম দিয়ে আপনি সরাসরি পাবলিক রুম, প্রাইভেট মেসেজ ও রুলেটে আড্ডা দিতে পারবেন।'
    },
    {
      qEn: 'How does 1-on-1 WebRTC Video Calling work?',
      qBn: '১-অন-১ ওয়েবআরটিসি (WebRTC) ভিডিও কল কীভাবে কাজ করে?',
      aEn: 'Our video calling uses browser-native WebRTC technology with direct peer-to-peer media transmission. Calls are initiated privately between consenting users, and no central video recordings are ever made or saved on our servers.',
      aBn: 'আমাদের ভিডিও কল ব্রাউজার-নেটিভ ওয়েবআরটিসি প্রযুক্তি ব্যবহার করে পিয়ার-টু-পিয়ার সরাসরি সংযুক্ত হয়। ব্যবহারকারীদের পারস্পরিক সম্মতিতে কল শুরু হয় এবং সার্ভারে কোনো ভিডিও রেকর্ড করা হয় না।'
    },
    {
      qEn: 'What are the rules and age restrictions on ChatLustora?',
      qBn: 'চ্যাটলাস্টোরার বয়সসীমা এবং কমিউনিটি নিয়মাবলী কী?',
      aEn: 'ChatLustora is strictly for consenting adults aged 18 and older. We maintain zero tolerance for non-consensual sharing, harassment, underage participation, or illegal activities. Violators face immediate permanent banning.',
      aBn: 'চ্যাটলাস্টোরা কেবল ১৮ বছর বা তার বেশি বয়সী প্রাপ্তবয়স্কদের জন্য। সম্মতিহীন বিষয়বস্তু, হেনস্তা, অপ্রাপ্তবয়স্ক উপস্থিতি বা যেকোনো বেআইনি কার্যকলাপের বিরুদ্ধে আমরা জিরো টলারেন্স নীতি বজায় রাখি।'
    },
    {
      qEn: 'Can I use ChatLustora on my smartphone or tablet?',
      qBn: 'স্মার্টফোন বা ট্যাবলেটে কি চ্যাটলাস্টোরা ব্যবহার করা যায়?',
      aEn: 'Yes! ChatLustora is engineered as a responsive progressive web platform that runs smoothly on Chrome, Safari, Firefox, and Edge on iOS and Android devices without requiring any app download.',
      aBn: 'হ্যাঁ! চ্যাটলাস্টোরা যেকোনো স্মার্টফোন ও ট্যাবলেটে স্মুথভাবে কাজ করে। কোনো অ্যাপ ইনস্টল ছাড়াই ব্রাউজার থেকে সরাসরি উপভোগ করতে পারবেন।'
    },
    {
      qEn: 'How do I block or report someone who behaves inappropriately?',
      qBn: 'কেউ অশোভন আচরণ করলে কীভাবে ব্লক বা রিপোর্ট করব?',
      aEn: 'Every user in chatrooms and direct messages has an immediate "Block" and "Report" button. Blocking instantly filters their messages from your screen, and reporting dispatches the chat context directly to our active moderation queue.',
      aBn: 'প্রত্যেক ব্যবহারকারীর প্রোফাইলে তাৎক্ষণিক ব্লক ও রিপোর্ট বাটন রয়েছে। ব্লক করলে তার মেসেজ তৎক্ষণাৎ অদৃশ্য হয়ে যায় এবং রিপোর্ট সরাসরি আমাদের সক্রিয় মডারেশন কিউতে পৌঁছে যায়।'
    }
  ];

  return (
    <div className="flex flex-col gap-10 p-4 sm:p-6 lg:p-8">
      {/* =========================================================================
          SECTION B: HERO SECTION
          ========================================================================= */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-raised via-raised/80 to-brand/10 border border-line p-6 sm:p-10 lg:p-12 shadow-xl shadow-black/10">
        {/* Subtle decorative background glow */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto gap-6">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand/15 border border-brand/30 text-brand text-xs font-extrabold tracking-wide uppercase shadow-sm">
            <Flame className="w-3.5 h-3.5 text-brand animate-pulse" />
            <span>{lang === 'bn' ? 'আপনার উন্মুক্ত সামাজিক আড্ডা • ১৮+ লাইভ' : 'YOUR SPACE TO CONNECT • 18+ ADULT SOCIAL'}</span>
          </div>

          {/* Main Title & Tagline */}
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-text-main leading-tight">
              Flirt Freely. <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-rose-500">Connect Deeply.</span>
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-text-muted max-w-2xl mx-auto leading-relaxed mt-1">
              {lang === 'bn'
                ? 'বাংলাদেশ, পশ্চিমবঙ্গ এবং বিশ্বজুড়ে বাংলাভাষী প্রাপ্তবয়স্কদের সেরা সামাজিক আড্ডা। ২৩টি লাইভ চ্যাটরুম, ১-অন-১ রুলেট এবং ব্রাউজার-নেটিভ এইচডি ভিডিও চ্যাটে অংশ নিন।'
                : 'The premier adult social chat network for Bangladeshi, Bengali-speaking, South Asian, and international communities. Join 23 curated rooms, anonymous stranger roulette, and HD peer-to-peer video calls.'}
            </p>
          </div>

          {/* Primary Quick Actions / 3 Authentication Options */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {!session ? (
              <>
                <button
                  onClick={() => openAuthModal('guest')}
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-brand to-brand-hover hover:brightness-110 active:scale-95 text-white font-extrabold text-sm flex items-center gap-2 shadow-lg shadow-brand/30 transition-all cursor-pointer"
                >
                  <Flame className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'গেস্ট হিসেবে প্রবেশ করুন' : 'Enter as Guest'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => openAuthModal('login')}
                  className="px-6 py-3.5 rounded-2xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 border border-line text-text-main font-bold text-sm flex items-center gap-2 transition-all cursor-pointer"
                >
                  <span>{lang === 'bn' ? 'মেম্বার লগইন' : 'Member Login'}</span>
                </button>

                <button
                  onClick={() => openAuthModal('signup')}
                  className="px-6 py-3.5 rounded-2xl bg-brand/15 hover:bg-brand/25 border border-brand/30 text-brand font-bold text-sm flex items-center gap-2 transition-all cursor-pointer"
                >
                  <span>{lang === 'bn' ? 'সাইন আপ' : 'Sign Up'}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleJoinBangla}
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-brand to-brand-hover hover:brightness-110 active:scale-95 text-white font-extrabold text-sm flex items-center gap-2 shadow-lg shadow-brand/30 transition-all cursor-pointer"
                >
                  <Flame className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'বাংলা চ্যাটে যোগ দিন' : 'Start Chatting Now'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={handleJoinRoulette}
                  className="px-5 py-3.5 rounded-2xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 border border-line text-text-main font-bold text-sm flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Shuffle className="w-4 h-4 text-amber-500" />
                  <span>{lang === 'bn' ? 'র্যান্ডম রুলেট' : 'Random Roulette'}</span>
                </button>
              </>
            )}

            <button
              onClick={scrollToDirectory}
              className="px-4 py-3.5 rounded-2xl text-text-muted hover:text-brand font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>{lang === 'bn' ? '২৩টি রুম দেখুন' : 'Explore 23 Rooms'}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Live Community Value Propositions / Stats Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 w-full pt-4 border-t border-line/60">
            <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-line">
              <div className="flex items-center gap-1.5 text-live font-extrabold text-lg sm:text-xl">
                <span className="w-2.5 h-2.5 rounded-full bg-live animate-ping" />
                <span className="tabular-nums">{globalPresence.totalConnected || 1}</span>
              </div>
              <span className="text-[11px] font-semibold text-text-muted">
                {lang === 'bn' ? 'অনলাইন সদস্য' : 'Live Online Users'}
              </span>
            </div>

            <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-line">
              <div className="flex items-center gap-1 text-brand font-extrabold text-lg sm:text-xl">
                <Radio className="w-4 h-4 text-brand" />
                <span>23</span>
              </div>
              <span className="text-[11px] font-semibold text-text-muted">
                {lang === 'bn' ? 'সক্রিয় রুম' : 'Active Chatrooms'}
              </span>
            </div>

            <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-line">
              <div className="flex items-center gap-1 text-text-main font-extrabold text-lg sm:text-xl">
                <Lock className="w-4 h-4 text-indigo-400" />
                <span>100%</span>
              </div>
              <span className="text-[11px] font-semibold text-text-muted">
                {lang === 'bn' ? 'ফ্রি ও বেনামী' : 'Free & Anonymous'}
              </span>
            </div>

            <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-line">
              <div className="flex items-center gap-1 text-rose-500 font-extrabold text-lg sm:text-xl">
                <Shield className="w-4 h-4 text-rose-500" />
                <span>18+</span>
              </div>
              <span className="text-[11px] font-semibold text-text-muted">
                {lang === 'bn' ? 'প্রাপ্তবয়স্ক ভেরিফাইড' : 'Adults Only'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION C: QUICK-MODE SELECTION CARDS
          ========================================================================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: 23 Themed Rooms */}
        <div
          onClick={scrollToDirectory}
          className="p-5 rounded-2xl bg-raised border border-line hover:border-brand/40 transition-all hover:shadow-lg hover:shadow-black/10 cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex flex-col gap-2">
            <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="text-base font-extrabold text-text-main group-hover:text-brand transition-colors">
              {lang === 'bn' ? '২৩টি থিমড রুম' : '23 Themed Chatrooms'}
            </h2>
            <p className="text-xs text-text-muted leading-relaxed">
              {lang === 'bn'
                ? 'বাংলা আড্ডা, সেক্স চ্যাট, কাপল ও রিজিওনাল টপিকে সরাসরি পাবলিক আলোচনা।'
                : 'Lively group discussions across General, Adult, Dating, and Regional categories.'}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs font-bold text-brand">
            <span>{lang === 'bn' ? 'রুম ব্রাউজ করুন' : 'Browse Rooms'}</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </div>

        {/* Card 2: 1-on-1 Stranger Roulette */}
        <div
          onClick={handleJoinRoulette}
          className="p-5 rounded-2xl bg-raised border border-line hover:border-amber-500/40 transition-all hover:shadow-lg hover:shadow-black/10 cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex flex-col gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Shuffle className="w-5 h-5" />
            </div>
            <h2 className="text-base font-extrabold text-text-main group-hover:text-amber-500 transition-colors">
              {lang === 'bn' ? '১-অন-১ র্যান্ডম রুলেট' : 'Random 1-on-1 Roulette'}
            </h2>
            <p className="text-xs text-text-muted leading-relaxed">
              {lang === 'bn'
                ? 'বেনামে অপরিচিত প্রাপ্তবয়স্কদের সাথে তাৎক্ষণিক মিল এবং এক ক্লিকে স্কিপ সুবিধা।'
                : 'Pair anonymously with active strangers instantly. Skip anytime with zero pressure.'}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs font-bold text-amber-500">
            <span>{lang === 'bn' ? 'রুলেট চালু করুন' : 'Launch Roulette'}</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </div>

        {/* Card 3: HD WebRTC Video Calls */}
        <div
          onClick={handleJoinVideo}
          className="p-5 rounded-2xl bg-raised border border-line hover:border-indigo-500/40 transition-all hover:shadow-lg hover:shadow-black/10 cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex flex-col gap-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Video className="w-5 h-5" />
            </div>
            <h2 className="text-base font-extrabold text-text-main group-hover:text-indigo-400 transition-colors">
              {lang === 'bn' ? 'এইচডি ওয়েবআরটিসি ভিডিও' : 'P2P Video & Voice'}
            </h2>
            <p className="text-xs text-text-muted leading-relaxed">
              {lang === 'bn'
                ? 'ব্রাউজারে সরাসরি পিয়ার-টু-পিয়ার ভিডিও ও অডিও কল। কোনো রেকর্ড বা ক্লাউড স্টোরেজ নেই।'
                : 'Private cam-to-cam calling directly in browser. Crystal clear, private, and zero cloud copies.'}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs font-bold text-indigo-400">
            <span>{lang === 'bn' ? 'ভিডিও রুমে যান' : 'Go to Video Chat'}</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </div>

        {/* Card 4: Bangla & Desi Community */}
        <div
          onClick={handleJoinBangla}
          className="p-5 rounded-2xl bg-raised border border-line hover:border-emerald-500/40 transition-all hover:shadow-lg hover:shadow-black/10 cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex flex-col gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Globe className="w-5 h-5" />
            </div>
            <h2 className="text-base font-extrabold text-text-main group-hover:text-emerald-400 transition-colors">
              {lang === 'bn' ? 'দেশি ও বাংলা সংস্কৃতি' : 'Bangla & Desi Adda'}
            </h2>
            <p className="text-xs text-text-muted leading-relaxed">
              {lang === 'bn'
                ? 'ঢাকা, চট্টগ্রাম, কলকাতা এবং প্রবাসী বাঙালিদের জন্য নিবেদিত উন্মুক্ত কমিউনিটি।'
                : 'Tailored for speakers from Dhaka, Kolkata, Chittagong, and the global South Asian diaspora.'}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs font-bold text-emerald-400">
            <span>{lang === 'bn' ? 'বাংলা রুমে যোগ দিন' : 'Enter Bangla Chat'}</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION D: AUTHORITATIVE 23 CHATROOMS DIRECTORY & SEARCH
          ========================================================================= */}
      <section id="rooms-directory-anchor" className="flex flex-col gap-6 pt-4 scroll-mt-20">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 border-b border-line pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-brand text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'সম্পূর্ণ ক্যাটালগ' : 'Live Directory'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-text-main tracking-tight">
              {lang === 'bn' ? '২৩টি লাইভ চ্যাটরুম ডিরেক্টরি' : 'Explore All 23 Live Chatrooms'}
            </h2>
            <p className="text-xs sm:text-sm text-text-muted mt-1">
              {lang === 'bn'
                ? 'আপনার পছন্দের বিষয় বা ভাষা বেছে নিয়ে সরাসরি আড্ডায় অংশ নিন।'
                : 'Select any room below to enter instantly. No registration or download required.'}
            </p>
          </div>

          <div className="text-xs font-bold px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-line text-text-muted">
            <span className="text-brand font-black">{filteredRooms.length}</span> of 23 Rooms Shown
          </div>
        </div>

        {/* Filter Toolbar: Search Bar + Category Pills */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'bn' ? 'রুমের নাম, স্ল্যাগ বা ট্যাগ দিয়ে খুঁজুন...' : 'Search rooms by name, slug, tag, or topic...'}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-line focus:border-brand focus:outline-none text-sm text-text-main transition-colors placeholder:text-text-muted/60"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {CATEGORIES.map(cat => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id as RoomCategory | 'all')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-brand text-white shadow-sm shadow-brand/25'
                      : 'bg-black/5 dark:bg-white/5 text-text-muted hover:text-text-main hover:bg-black/10 dark:hover:bg-white/10 border border-line'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* 23 Room Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRooms.map(room => {
            const onlineCount = globalPresence.roomCounts[room.id] || 0;
            return (
              <div
                key={room.id}
                className="flex flex-col justify-between p-5 rounded-2xl bg-raised border border-line hover:border-brand/40 transition-all duration-200 hover:shadow-xl hover:shadow-black/10 group"
              >
                <div className="flex flex-col gap-3">
                  {/* Top Bar: Category, Language & Real-time Online Counter */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-[11px] font-bold text-text-muted">
                        {room.category}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md bg-brand/10 text-brand text-[10px] font-mono font-bold uppercase border border-brand/20">
                        {room.language}
                      </span>
                      {room.features?.webrtc && (
                        <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[10px] font-bold flex items-center gap-1 border border-indigo-500/20">
                          <Video className="w-3 h-3" /> Cam
                        </span>
                      )}
                      {room.features?.roulette && (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 text-[10px] font-bold flex items-center gap-1 border border-amber-500/20">
                          <Shuffle className="w-3 h-3" /> Skip
                        </span>
                      )}
                    </div>

                    {/* Real-time online counter */}
                    <div className="flex items-center gap-1 text-xs font-bold text-live shrink-0">
                      <span className="w-2 h-2 rounded-full bg-live animate-pulse" />
                      <span>{onlineCount}</span>
                    </div>
                  </div>

                  {/* Room Name & Canonical Slug */}
                  <div>
                    <h3 className="text-base font-extrabold text-text-main group-hover:text-brand transition-colors">
                      {room.name}
                    </h3>
                    <span className="text-[11px] font-mono text-text-muted">
                      {room.slug}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                    {room.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(room.tags || []).slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-text-muted font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Enter / Join Room CTA */}
                <button
                  onClick={() => navigateRoom(room)}
                  className="mt-4 w-full py-2.5 px-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-brand hover:text-white border border-line hover:border-brand text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm group-hover:shadow-brand/20"
                >
                  <span>{lang === 'bn' ? 'রুমে প্রবেশ করুন' : 'Join Room'}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            );
          })}
        </div>

        {filteredRooms.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-text-muted gap-2 bg-raised rounded-2xl border border-line">
            <Users className="w-10 h-10 opacity-30 text-brand" />
            <p className="text-sm font-semibold">No chatrooms found matching "{search}"</p>
            <button
              onClick={() => { setSearch(''); setSelectedCategory('all'); }}
              className="text-xs text-brand hover:underline font-bold mt-1 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </section>

      {/* =========================================================================
          SECTION E: WHY CHOOSE CHATLUSTORA (PLATFORM HIGHLIGHTS)
          ========================================================================= */}
      <section className="flex flex-col gap-6 pt-6 border-t border-line">
        <div className="text-center max-w-2xl mx-auto flex flex-col gap-2">
          <div className="inline-flex items-center justify-center gap-1.5 text-brand text-xs font-bold uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'আমাদের বিশেষত্ব' : 'Platform Advantages'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-text-main tracking-tight">
            {lang === 'bn' ? 'কেন চ্যাটলাস্টোরা বেছে নেবেন?' : 'Why Adults Choose ChatLustora'}
          </h2>
          <p className="text-xs sm:text-sm text-text-muted">
            {lang === 'bn'
              ? 'গোপনীয়তা, গতি এবং সম্মানের ভিত্তিতে নির্মিত একটি আধুনিক সামাজিক আড্ডার প্ল্যাটফর্ম।'
              : 'Built from the ground up for speed, privacy, mutual respect, and genuine human connection.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-6 rounded-2xl bg-raised border border-line flex flex-col gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-text-main">
              {lang === 'bn' ? 'তাত্ক্ষণিক নো-রেজিস্ট্রেশন অ্যাক্সেস' : 'Instant No-Registration Access'}
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              {lang === 'bn'
                ? 'কোনো জটিল সাইন-আপ বা ব্যক্তিগত তথ্যের দরকার নেই। শুধু ১৮+ নিশ্চিত করুন ও পছন্দের নাম দিয়ে শুরু করুন।'
                : 'Skip tedious email confirmations and phone number verifications. Pick an anonymous nickname and start chatting in seconds.'}
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-raised border border-line flex flex-col gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-text-main">
              {lang === 'bn' ? 'কঠোরভাবে ১৮+ ও সম্মানের পরিবেশ' : 'Strictly 18+ & Consensual Space'}
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              {lang === 'bn'
                ? 'প্রাপ্তবয়স্কদের জন্য নিরাপদ ক্ষেত্র। হেনস্তা ও অপ্রাপ্তবয়স্কদের অনুপ্রবেশ রুখতে সার্বক্ষণিক ফিল্টারিং ও মডারেশন।'
                : 'Dedicated adult environment with zero tolerance for harassment, underage presence, or non-consensual behavior.'}
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-raised border border-line flex flex-col gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-text-main">
              {lang === 'bn' ? 'পিয়ার-টু-পিয়ার গোপনীয়তা' : 'End-to-End P2P Privacy'}
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              {lang === 'bn'
                ? 'ওয়েবআরটিসি ভিডিও ও অডিও কল সরাসরি ব্যবহারকারীদের ডিভাইসে আদান-প্রদান হয়, কোনো সেন্ট্রাল ক্লাউড রেকর্ড হয় না।'
                : 'Video and audio streams are sent directly between users using WebRTC. Zero central video storage or recordings.'}
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-raised border border-line flex flex-col gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-text-main">
              {lang === 'bn' ? 'বাংলা ও আন্তর্জাতিক মেলবন্ধন' : 'Bangla & Global Community'}
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              {lang === 'bn'
                ? 'বাংলা এবং ইংরেজির সম্পূর্ণ দ্বিভাষিক সমর্থন যা বাংলাদেশের বাসিন্দা এবং আন্তর্জাতিক প্রবাসীদের সহজে সংযুক্ত করে।'
                : 'Complete bilingual English and Bangla UI bridging Bangladesh, West Bengal, and the worldwide South Asian diaspora.'}
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-raised border border-line flex flex-col gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <EyeOff className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-text-main">
              {lang === 'bn' ? 'ব্যক্তিগত ডিএম ও ১-ক্লিক ব্লক' : 'Discreet DMs & Instant Blocking'}
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              {lang === 'bn'
                ? 'ব্যক্তিগত বার্তা আদান-প্রদান এবং যেকোনো বিরক্তিকর ব্যবহারকারীকে তৎক্ষণাৎ ব্লক ও রিপোর্ট করার পূর্ণ স্বাধীনতা।'
                : 'Private one-on-one message drawers with unread badges, instant user blocking, and automated report queue triggers.'}
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-raised border border-line flex flex-col gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Radio className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-text-main">
              {lang === 'bn' ? 'আল্ট্রা-ফাস্ট লাইভ সকেট' : 'Ultra-Low Latency Engine'}
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              {lang === 'bn'
                ? 'Node.js এবং Socket.IO-তে চালিত রিয়েল-টাইম ইভেন্ট ইঞ্জিন যা দ্রুততম মেসেজ আদান-প্রদান নিশ্চিত করে।'
                : 'Built with optimized WebSockets delivering lightning-fast messages, typing indicators, and instant live presence.'}
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION F: HOW IT WORKS (3-STEP GUIDE)
          ========================================================================= */}
      <section className="flex flex-col gap-6 pt-6 border-t border-line">
        <div className="text-center max-w-xl mx-auto flex flex-col gap-2">
          <div className="inline-flex items-center justify-center gap-1.5 text-brand text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'সহজ ৩ ধাপ' : 'Easy 3 Steps'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-text-main tracking-tight">
            {lang === 'bn' ? 'কীভাবে আড্ডা শুরু করবেন?' : 'How ChatLustora Works'}
          </h2>
          <p className="text-xs sm:text-sm text-text-muted">
            {lang === 'bn'
              ? 'মাত্র ৩০ সেকেন্ডের মধ্যে যেকোনো প্রাপ্তবয়স্ক চ্যাটে সরাসরি যুক্ত হন।'
              : 'Get from landing page to active conversation in less than 30 seconds.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Step 1 */}
          <div className="p-6 rounded-2xl bg-raised border border-line flex flex-col items-center text-center gap-3 relative">
            <div className="w-12 h-12 rounded-2xl bg-brand text-white font-black text-xl flex items-center justify-center shadow-md shadow-brand/25">
              1
            </div>
            <h3 className="text-base font-bold text-text-main">
              {lang === 'bn' ? '১৮+ নিশ্চিত করে নাম বাছুন' : 'Confirm 18+ & Choose Nickname'}
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              {lang === 'bn'
                ? 'প্রাপ্তবয়স্ক গেটে সম্মতি দিন এবং আপনার পছন্দের যেকোনো বেনামী ডাকনাম প্রবেশ করান।'
                : 'Accept our adult consent terms and enter an anonymous handle. No credit card or registration needed.'}
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-6 rounded-2xl bg-raised border border-line flex flex-col items-center text-center gap-3 relative">
            <div className="w-12 h-12 rounded-2xl bg-brand text-white font-black text-xl flex items-center justify-center shadow-md shadow-brand/25">
              2
            </div>
            <h3 className="text-base font-bold text-text-main">
              {lang === 'bn' ? 'রুম বা রুলেট নির্বাচন করুন' : 'Pick a Room or Launch Roulette'}
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              {lang === 'bn'
                ? '২৩টি থিমভিত্তিক রুমের মধ্যে যেকোনোটি বেছে নিন অথবা সরাসরি ১-অন-১ অপরিচিতের সাথে যুক্ত হতে রুলেট ব্যবহার করুন।'
                : 'Enter Bangla Chat, Adult Chat, or jump straight into random 1-on-1 roulette for instant matching.'}
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-6 rounded-2xl bg-raised border border-line flex flex-col items-center text-center gap-3 relative">
            <div className="w-12 h-12 rounded-2xl bg-brand text-white font-black text-xl flex items-center justify-center shadow-md shadow-brand/25">
              3
            </div>
            <h3 className="text-base font-bold text-text-main">
              {lang === 'bn' ? 'উন্মুক্ত আড্ডায় মেতে উঠুন' : 'Flirt, Chat & Video Call'}
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              {lang === 'bn'
                ? 'গ্রুপ আড্ডা, গোপনীয় ব্যক্তিগত বার্তা ও সরাসরি ব্রাউজারে ওয়েবআরটিসি ভিডিও কলের মাধ্যমে মন খুলে কথা বলুন।'
                : 'Share text messages, exchange discrete private DMs, and activate cam-to-cam video calls freely.'}
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION G: SAFETY, CONSENT & MODERATION STANDARDS
          ========================================================================= */}
      <section className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-raised via-raised/90 to-rose-500/5 border border-line flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col gap-2 max-w-2xl text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold w-fit mx-auto md:mx-0">
            <Shield className="w-3.5 h-3.5" />
            <span>Strict 18+ Policy & Mutual Consent</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-text-main">
            {lang === 'bn' ? 'নিরাপত্তা, পারস্পরিক সম্মতি এবং মডারেশন নীতি' : 'Safety, Consent & Zero Tolerance Standards'}
          </h2>
          <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
            {lang === 'bn'
              ? 'চ্যাটলাস্টোরা সম্পূর্ণ প্রাপ্তবয়স্কদের স্থান। অপ্রাপ্তবয়স্ক প্রবেশ, অসম্মতিমূলক আচরণ বা অনাকাঙ্ক্ষিত হেনস্তা তৎক্ষণাৎ স্থায়ী নিষেধাজ্ঞার কারণ হবে।'
              : 'ChatLustora enforces strict age verification and mutual consent. Any non-consensual media, harassment, or minor involvement triggers immediate permanent ban and law enforcement escalation.'}
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-2">
            <button
              onClick={() => openInfoModal('guidelines')}
              className="px-3.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-line text-xs font-bold text-text-main hover:text-brand transition-colors cursor-pointer"
            >
              {lang === 'bn' ? 'কমিউনিটি নির্দেশিকা' : 'Community Guidelines'}
            </button>
            <button
              onClick={() => openInfoModal('safety')}
              className="px-3.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-line text-xs font-bold text-text-main hover:text-brand transition-colors cursor-pointer"
            >
              {lang === 'bn' ? 'নিরাপত্তা ও সম্মতি' : 'Safety & Consent Rules'}
            </button>
            <button
              onClick={() => openInfoModal('terms')}
              className="px-3.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-line text-xs font-bold text-text-main hover:text-brand transition-colors cursor-pointer"
            >
              {lang === 'bn' ? 'ব্যবহারের শর্তাবলী' : 'Terms of Service'}
            </button>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-center justify-center p-6 rounded-2xl bg-black/5 dark:bg-white/5 border border-line text-center gap-1 w-full md:w-auto">
          <div className="text-3xl font-black text-rose-500">18+</div>
          <span className="text-xs font-extrabold text-text-main uppercase tracking-wider">Adults Only</span>
          <span className="text-[10px] text-text-muted max-w-[140px]">Age verified gateway active on every session</span>
        </div>
      </section>

      {/* =========================================================================
          SECTION H: FREQUENTLY ASKED QUESTIONS (ACCORDION)
          ========================================================================= */}
      <section className="flex flex-col gap-6 pt-6 border-t border-line">
        <div className="text-center max-w-xl mx-auto flex flex-col gap-2">
          <div className="inline-flex items-center justify-center gap-1.5 text-brand text-xs font-bold uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'সাধারণ জিজ্ঞাসা' : 'Got Questions?'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-text-main tracking-tight">
            {lang === 'bn' ? 'সচরাচর জিজ্ঞাসিত প্রশ্নাবলী (FAQ)' : 'Frequently Asked Questions'}
          </h2>
          <p className="text-xs sm:text-sm text-text-muted">
            {lang === 'bn'
              ? 'চ্যাটলাস্টোরা প্ল্যাটফর্ম সম্পর্কিত সাধারণ প্রশ্ন ও উত্তর।'
              : 'Everything you need to know about anonymous adult social chat on ChatLustora.'}
          </p>
        </div>

        <div className="max-w-3xl mx-auto w-full flex flex-col gap-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-raised border border-line overflow-hidden transition-all"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <span className="text-sm font-bold text-text-main">
                    {lang === 'bn' ? faq.qBn : faq.qEn}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-text-muted shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-brand' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 sm:px-5 pb-5 text-xs text-text-muted leading-relaxed border-t border-line/50 pt-3 animate-in fade-in-50 duration-200">
                    {lang === 'bn' ? faq.aBn : faq.aEn}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* =========================================================================
          SECTION I: COMMUNITY BLOG & FORUM SPOTLIGHT
          ========================================================================= */}
      <section className="flex flex-col gap-6 pt-6 border-t border-line">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-brand text-xs font-bold uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'কমিউনিটি নলেজ' : 'Community Hub'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-text-main tracking-tight">
              {lang === 'bn' ? 'ব্লগ ও ফোরাম আলোচনা' : 'Community Blog & Forum Spotlight'}
            </h2>
            <p className="text-xs sm:text-sm text-text-muted mt-1">
              {lang === 'bn'
                ? 'অনলাইন ফ্লার্টিং, নিরাপত্তা এবং সামাজিক আড্ডা সংক্রান্ত তথ্য ও পরামর্শ।'
                : 'Tips, safety guides, and trending topics shared by our adult community.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('blog')}
              className="px-3.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-line text-xs font-bold text-text-main hover:text-brand transition-colors cursor-pointer"
            >
              {lang === 'bn' ? 'সব ব্লগ দেখুন' : 'View Blog'}
            </button>
            <button
              onClick={() => setActiveTab('forum')}
              className="px-3.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-line text-xs font-bold text-text-main hover:text-brand transition-colors cursor-pointer"
            >
              {lang === 'bn' ? 'ফোরামে যোগ দিন' : 'Open Forum'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Blog Teaser Card */}
          <div
            onClick={() => setActiveTab('blog')}
            className="p-5 rounded-2xl bg-raised border border-line hover:border-brand/40 transition-all hover:shadow-lg cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] uppercase font-bold text-brand px-2 py-0.5 rounded-md bg-brand/10 w-fit">
                Safety & Dating Guide
              </span>
              <h3 className="text-base font-extrabold text-text-main group-hover:text-brand transition-colors">
                {lang === 'bn' ? 'অনলাইন অ্যাডাল্ট আড্ডায় নিরাপত্তা ও সম্মতির গুরুত্ব' : 'The Art of Respectful Online Flirting & Consent'}
              </h3>
              <p className="text-xs text-text-muted leading-relaxed line-clamp-2">
                {lang === 'bn'
                  ? 'কীভাবে নিজের পরিচয় গোপন রেখে নিরাপদ ও আন্তরিকভাবে নতুন মানুষের সাথে পরিচয় গড়ে তুলবেন।'
                  : 'Practical advice on breaking the ice, maintaining privacy boundaries, and respecting consent in adult chatrooms.'}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-brand">
              <span>{lang === 'bn' ? 'আর্টিকেলটি পড়ুন' : 'Read Full Article'}</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </div>

          {/* Forum Teaser Card */}
          <div
            onClick={() => setActiveTab('forum')}
            className="p-5 rounded-2xl bg-raised border border-line hover:border-brand/40 transition-all hover:shadow-lg cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] uppercase font-bold text-amber-500 px-2 py-0.5 rounded-md bg-amber-500/10 w-fit">
                Trending Discussion
              </span>
              <h3 className="text-base font-extrabold text-text-main group-hover:text-amber-500 transition-colors">
                {lang === 'bn' ? 'বাংলা চ্যাটে কোন বিষয়গুলোতে সবচেয়ে জমে আড্ডা?' : 'Bengali Adda Traditions in Modern Digital Chatrooms'}
              </h3>
              <p className="text-xs text-text-muted leading-relaxed line-clamp-2">
                {lang === 'bn'
                  ? 'ঢাকা, কোলকাতা কিংবা প্রবাসে বসে বাঙালি আড্ডার আনন্দ ও স্মৃতি নিয়ে মুক্ত আলোচনা।'
                  : 'Explore how classic Dhaka and Kolkata coffee house adda cultures thrive inside anonymous digital spaces.'}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-amber-500">
              <span>{lang === 'bn' ? 'আলোচনায় যোগ দিন' : 'Join Discussion'}</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION J: HIGH-IMPACT CALL-TO-ACTION (CTA) BANNER
          ========================================================================= */}
      <section className="rounded-3xl bg-gradient-to-r from-brand via-brand-hover to-rose-600 p-8 sm:p-12 text-white flex flex-col items-center text-center gap-5 shadow-2xl shadow-brand/30">
        <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight max-w-2xl">
          {lang === 'bn'
            ? 'নতুন মানুষের সাথে সরাসরি আড্ডা দিতে প্রস্তুত?'
            : 'Ready to Meet New People & Flirt Freely?'}
        </h2>
        <p className="text-xs sm:text-sm text-white/90 max-w-xl leading-relaxed">
          {lang === 'bn'
            ? 'কোনো অ্যাপ ইন্সটল বা রেজিস্ট্রেশনের ঝামেলা নেই। এখনই ১৮+ নিশ্চিত করে প্রবেশ করুন।'
            : 'Zero downloads, zero friction, and 100% free adult social rooms. Pick your favorite room or spin the roulette right now.'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={handleJoinBangla}
            className="px-6 py-3.5 rounded-2xl bg-white text-brand font-black text-sm hover:bg-neutral-100 active:scale-95 transition-all shadow-lg cursor-pointer flex items-center gap-2"
          >
            <Flame className="w-4 h-4 text-brand" />
            <span>{lang === 'bn' ? 'বাংলা চ্যাটে প্রবেশ করুন' : 'Enter Bangla Chat Now'}</span>
          </button>
          <button
            onClick={handleJoinRoulette}
            className="px-6 py-3.5 rounded-2xl bg-black/25 hover:bg-black/35 text-white font-bold text-sm border border-white/20 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
          >
            <Shuffle className="w-4 h-4 text-amber-300" />
            <span>{lang === 'bn' ? 'র্যান্ডম রুলেট স্পিন' : 'Spin Random Roulette'}</span>
          </button>
        </div>
      </section>
    </div>
  );
};
