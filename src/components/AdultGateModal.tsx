import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.js';
import { BrandLogo } from './BrandLogo.js';
import { GenderType } from './GenderBadge.js';
import { ShieldAlert, Dice5, Lock, ArrowRight, AlertTriangle, Calendar, UserCheck, X, User, LogIn, UserPlus } from 'lucide-react';

export const AdultGateModal: React.FC = () => {
  const { authModalMode, closeAuthModal, setSession, login, t, lang, setLang, openInfoModal } = useApp();

  const [mode, setMode] = useState<'guest' | 'login' | 'signup'>(authModalMode || 'guest');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState<GenderType>('prefer-not-to-say');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [isGenderVisible, setIsGenderVisible] = useState(true);
  const [isAdultConfirmed, setIsAdultConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync internal mode with authModalMode prop when opened
  useEffect(() => {
    if (authModalMode) {
      setMode(authModalMode);
      setError(null);
    }
  }, [authModalMode]);

  if (!authModalMode) return null;

  const handleRandomNickname = async () => {
    try {
      const res = await fetch('/api/auth/suggest-nickname');
      const data = await res.json();
      if (data.nickname) {
        setNickname(data.nickname);
      }
    } catch {
      setNickname(`Desi_Lover_${Math.floor(100 + Math.random() * 900)}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'login') {
      const loginEmail = nickname.trim();

      if (!loginEmail || !password) {
        setError('Please enter your email and password.');
        return;
      }

      setLoading(true);
      try {
        const result = await login({ email: loginEmail, password });

        if (result?.error || !result?.success) {
          setError(result?.error || 'Login failed. Please check your credentials.');
          return;
        }

        closeAuthModal();
      } catch {
        setError('Unable to log in right now. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Guest or Signup validation
    if (!isAdultConfirmed) {
      setError(
        lang === 'bn'
          ? 'অনুগ্রহ করে নিশ্চিত করুন যে আপনার বয়স ১৮ বা তার বেশি।'
          : 'You must confirm that you are at least 18 years old.'
      );
      return;
    }

    if (!termsAccepted) {
      setError(
        lang === 'bn'
          ? 'অনুগ্রহ করে ব্যবহারের শর্তাবলী ও প্রাইভেসি পলিসি স্বীকার করুন।'
          : 'You must accept the Terms of Service & Privacy Policy.'
      );
      return;
    }

    if (!dateOfBirth) {
      setError(
        lang === 'bn'
          ? 'অনুগ্রহ করে আপনার জন্মতারিখ (Date of Birth) দিন।'
          : 'Please enter your date of birth for age verification.'
      );
      return;
    }

    const trimmed = nickname.trim();
    if (trimmed.length < 3 || trimmed.length > 20) {
      setError(
        lang === 'bn'
          ? 'নিকনেম অবশ্যই ৩ থেকে ২০ অক্ষরের মধ্যে হতে হবে।'
          : 'Nickname must be between 3 and 20 characters.'
      );
      return;
    }

    if (mode === 'signup') {
      if (!email.trim() || !password) {
        setError(
          lang === 'bn'
            ? 'অনুগ্রহ করে ইমেইল ও পাসওয়ার্ড প্রদান করুন।'
            : 'Please enter your email and password to create an account.'
        );
        return;
      }

      setLoading(true);
      try {
        const regRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: trimmed,
            email: email.trim(),
            password,
            dateOfBirth
          })
        });

        let regData: any = {};
        const contentType = regRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          try {
            regData = await regRes.json();
          } catch {
            regData = {};
          }
        }

        if (!regRes.ok || !regData.success) {
          setError(regData.error || `Registration failed (${regRes.status})`);
          return;
        }

        // Automatically log in following successful registration
        const loginResult = await login({ email: email.trim(), password });
        if (loginResult?.error || !loginResult?.success) {
          setError(
            lang === 'bn'
              ? 'অ্যাকাউন্ট তৈরি হয়েছে! অনুগ্রহ করে লগইন করুন।'
              : 'Account created successfully! Please log in.'
          );
          setMode('login');
          return;
        }

        closeAuthModal();
      } catch (err: any) {
        setError(err.message || 'An error occurred during registration.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Guest Mode
    setLoading(true);

    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: trimmed,
          gender,
          dateOfBirth,
          isGenderVisible,
          isAdultConfirmed,
          termsAccepted
        })
      });

      let data: any = {};
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          data = await res.json();
        } catch {
          data = {};
        }
      }

      if (!res.ok) {
        throw new Error(data.error || `Failed to authenticate (${res.status})`);
      }

      setSession(data.session);
      closeAuthModal();
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-full max-w-lg bg-raised border border-line rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8 flex flex-col gap-6 relative my-auto">
        {/* Close button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-white/5 transition-colors cursor-pointer"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Header with Brand */}
        <div className="flex flex-col items-center text-center gap-2">
          <BrandLogo size="lg" showTagline={true} />

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-bold mt-2">
            <ShieldAlert className="w-4 h-4" />
            <span>{t('adultNotice18')}</span>
          </div>

          <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed">
            {t('adultWarning')}
          </p>
        </div>

        {/* 3 Main Options Switcher Tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-black/10 dark:bg-white/5 rounded-xl border border-line">
          <button
            type="button"
            onClick={() => { setMode('guest'); setError(null); }}
            className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'guest'
                ? 'bg-brand text-white shadow-md'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'গেস্ট' : 'Guest Login'}</span>
          </button>

          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'login'
                ? 'bg-brand text-white shadow-md'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'লগইন' : 'Member Login'}</span>
          </button>

          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); }}
            className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'signup'
                ? 'bg-brand text-white shadow-md'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'সাইন আপ' : 'Sign Up'}</span>
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs animate-in shake">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'login' ? (
            /* Member Login Form */
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-main">
                  <span>{lang === 'bn' ? 'নিকনেম বা ইমেইল' : 'Nickname or Email'}</span>
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  placeholder="e.g. Dhaka_Member_01"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-black/10 dark:bg-white/5 border border-line focus:border-brand focus:outline-none text-sm font-medium transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-main">
                  <span>{lang === 'bn' ? 'পাসওয়ার্ড' : 'Password'}</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-black/10 dark:bg-white/5 border border-line focus:border-brand focus:outline-none text-sm font-medium transition-colors"
                />
              </div>


            </>
          ) : (
            /* Guest or Signup Form (requires gender, DOB 18+, terms) */
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-main flex items-center justify-between">
                  <span>{t('guestNickname')}</span>
                  <span className="text-[10px] text-text-muted">3-20 characters</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    placeholder={lang === 'bn' ? 'যেমন: Dhaka_Romance_99' : 'e.g. Dhaka_Romance_99'}
                    maxLength={20}
                    required
                    className="flex-1 px-4 py-2.5 rounded-xl bg-black/10 dark:bg-white/5 border border-line focus:border-brand focus:outline-none text-sm font-medium transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleRandomNickname}
                    title={t('chooseRandom')}
                    className="px-3 py-2.5 rounded-xl border border-line hover:border-brand hover:bg-brand/10 text-brand font-semibold text-xs flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Dice5 className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('chooseRandom')}</span>
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-text-main">
                      <span>{lang === 'bn' ? 'ইমেইল এড্রেস' : 'Email Address'}</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="e.g. member@chatlustora.com"
                      required
                      className="w-full px-4 py-2.5 rounded-xl bg-black/10 dark:bg-white/5 border border-line focus:border-brand focus:outline-none text-sm font-medium transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-text-main">
                      <span>{lang === 'bn' ? 'পাসওয়ার্ড' : 'Password'}</span>
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-4 py-2.5 rounded-xl bg-black/10 dark:bg-white/5 border border-line focus:border-brand focus:outline-none text-sm font-medium transition-colors"
                    />
                  </div>
                </>
              )}

              {/* Gender Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-main flex items-center justify-between">
                  <span>Select Gender (Required)</span>
                  <span className="text-[10px] text-text-muted">Displayed with distinct sign</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'male', label: 'Male', symbol: '♂', color: 'text-blue-500 border-blue-500/40 bg-blue-500/5' },
                    { id: 'female', label: 'Female', symbol: '♀', color: 'text-pink-500 border-pink-500/40 bg-pink-500/5' },
                    { id: 'non-binary', label: 'Non-binary', symbol: '⚧', color: 'text-purple-500 border-purple-500/40 bg-purple-500/5' },
                    { id: 'prefer-not-to-say', label: 'Not specified', symbol: '⚲', color: 'text-gray-400 border-gray-500/40 bg-gray-500/5' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setGender(opt.id as GenderType)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-xs font-bold cursor-pointer ${
                        gender === opt.id
                          ? 'border-brand bg-brand/15 text-brand shadow-md ring-1 ring-brand'
                          : 'border-line bg-black/5 dark:bg-white/5 text-text-muted hover:border-line-hover'
                      }`}
                    >
                      <span className={`text-base font-extrabold ${opt.color.split(' ')[0]}`}>{opt.symbol}</span>
                      <span className="mt-1 text-text-main">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date of Birth & Age Verification */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-main flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-brand" />
                    <span>Date of Birth (18+ Verification)</span>
                  </span>
                  <span className="text-[10px] text-text-muted">Stored securely</span>
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={e => setDateOfBirth(e.target.value)}
                  max={new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-black/10 dark:bg-white/5 border border-line focus:border-brand focus:outline-none text-sm font-medium transition-colors"
                />
              </div>

              {/* Gender visibility control toggle */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-line cursor-pointer select-none">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-brand" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-text-main">Show Gender Badge publicly</span>
                    <span className="text-[10px] text-text-muted">Display your gender symbol next to your name</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isGenderVisible}
                  onChange={e => setIsGenderVisible(e.target.checked)}
                  className="w-4 h-4 accent-brand rounded cursor-pointer"
                />
              </label>

              {/* Adult 18+ Checkbox */}
              <label className="flex items-start gap-3 p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-line hover:border-brand/40 cursor-pointer select-none transition-colors">
                <input
                  type="checkbox"
                  checked={isAdultConfirmed}
                  onChange={e => setIsAdultConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-brand rounded cursor-pointer"
                />
                <div className="flex flex-col text-xs text-text-main font-semibold">
                  <span>{t('iAm18')}</span>
                  <span className="text-[11px] text-text-muted font-normal mt-0.5">
                    {lang === 'bn'
                      ? 'আমি স্বীকার করছি যে এটি একটি প্রাপ্তবয়স্ক ফোরাম এবং আমি স্বঘোষিত প্রাপ্তবয়স্ক।'
                      : 'I acknowledge that this platform features adult discussions and I am at least 18 years old.'}
                  </span>
                </div>
              </label>

              {/* Terms & Privacy Checkbox */}
              <label className="flex items-start gap-3 p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-line hover:border-brand/40 cursor-pointer select-none transition-colors">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={e => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-brand rounded cursor-pointer"
                />
                <div className="flex flex-col text-xs text-text-main font-semibold">
                  <span>{t('iAcceptTerms')}</span>
                  <div className="text-[11px] text-text-muted font-normal mt-0.5 flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); openInfoModal('terms'); }}
                      className="text-brand hover:underline"
                    >
                      {t('termsOfService')}
                    </button>
                    <span>&bull;</span>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); openInfoModal('privacy'); }}
                      className="text-brand hover:underline"
                    >
                      {t('privacyPolicy')}
                    </button>
                  </div>
                </div>
              </label>
            </>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-6 rounded-xl bg-brand hover:bg-brand-hover active:scale-[0.99] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand/25 transition-all cursor-pointer disabled:opacity-50 mt-2"
          >
            {loading ? (
              <span>Processing...</span>
            ) : (
              <>
                <span>
                  {mode === 'login' ? (lang === 'bn' ? 'লগইন করুন' : 'Login') : mode === 'signup' ? (lang === 'bn' ? 'অ্যাকাউন্ট তৈরি করুন' : 'Create Member Account') : t('enterChat')}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Disclaimer footer */}
        <div className="pt-2 border-t border-line text-center text-[10px] text-text-muted leading-relaxed">
          <p>
            {t('guestSessionNotice')}
          </p>
          <div className="flex items-center justify-center gap-3 mt-2">
            <button
              onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
              className="hover:text-brand font-medium"
            >
              Language: {lang === 'en' ? 'বাংলা সংস্করণ' : 'English Version'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
