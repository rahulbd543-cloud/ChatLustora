import React from 'react';
import { useApp } from '../context/AppContext.js';
import { X, ShieldCheck, FileText, Lock, AlertTriangle, Mail } from 'lucide-react';

export const InfoPagesModal: React.FC = () => {
  const { isInfoModalOpen, infoModalTab, openInfoModal, closeInfoModal, t, lang } = useApp();

  if (!isInfoModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-2xl max-h-[85vh] bg-raised border border-line rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-raised/90 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto">
            {(['terms', 'privacy', 'guidelines', 'safety', 'contact'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => openInfoModal(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize whitespace-nowrap ${
                  infoModalTab === tab
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-text-muted hover:text-text-main hover:bg-white/5'
                }`}
              >
                {tab === 'terms' && t('termsOfService')}
                {tab === 'privacy' && t('privacyPolicy')}
                {tab === 'guidelines' && t('communityGuidelines')}
                {tab === 'safety' && t('safetyConsent')}
                {tab === 'contact' && t('contactSupport')}
              </button>
            ))}
          </div>

          <button
            onClick={closeInfoModal}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-white/10 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 text-text-main text-xs sm:text-sm leading-relaxed space-y-4">
          {infoModalTab === 'terms' && (
            <>
              <h2 className="text-lg font-bold text-brand">ChatLustora Terms of Service</h2>
              <p className="text-text-muted">Last updated: October 2026</p>
              <h3 className="font-bold text-text-main text-sm mt-3">1. Mandatory Age Requirement (18+)</h3>
              <p>
                ChatLustora is exclusively built and intended for individuals aged 18 and older. Any access by minors is strictly prohibited. By entering, you declare under penalty of perjury and applicable laws that you are of legal age in your jurisdiction.
              </p>
              <h3 className="font-bold text-text-main text-sm mt-3">2. Prohibition of Non-Consensual Material</h3>
              <p>
                The dissemination of non-consensual sexual content, explicit material involving minors, extortion, or blackmail is illegal and will result in immediate lifetime banning and reporting to law enforcement authorities.
              </p>
              <h3 className="font-bold text-text-main text-sm mt-3">3. Disclaimer of Liability</h3>
              <p>
                ChatLustora provides an open communication platform for consenting adults. We do not endorse or verify personal statements made by guests. Exercise standard personal vigilance.
              </p>
            </>
          )}

          {infoModalTab === 'privacy' && (
            <>
              <h2 className="text-lg font-bold text-brand">Privacy Policy</h2>
              <p className="text-text-muted">Last updated: October 2026</p>
              <h3 className="font-bold text-text-main text-sm mt-3">1. Anonymous Guest Experience</h3>
              <p>
                ChatLustora does not require real names, phone numbers, or credit card information for guest entry. Your chosen nickname is temporary.
              </p>
              <h3 className="font-bold text-text-main text-sm mt-3">2. Media & WebRTC Streams</h3>
              <p>
                One-to-one video calls and audio chats are routed peer-to-peer using native WebRTC protocols. ChatLustora servers act strictly as signaling coordinators and do not record or archive private video streams.
              </p>
              <h3 className="font-bold text-text-main text-sm mt-3">3. Data Retention & Deletion</h3>
              <p>
                Temporary guest tokens automatically expire after 7 days of inactivity. Users can request immediate session deletion by clicking Logout.
              </p>
            </>
          )}

          {infoModalTab === 'guidelines' && (
            <>
              <h2 className="text-lg font-bold text-brand">Adult Community Guidelines</h2>
              <p>
                Our community is built around mutual respect, adult freedom, and clear boundaries.
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-text-main/90">
                <li><strong>No Harassment:</strong> "No" means no. If someone asks you to stop messaging, discontinue contact immediately.</li>
                <li><strong>Respect Dialects & Cultures:</strong> ChatLustora welcomes Bengali, South Asian, and global members. Treat everyone with warmth.</li>
                <li><strong>No Commercial Spam:</strong> Unsolicited advertisements, links to paid third-party webcam sites, or crypto solicitations are banned.</li>
                <li><strong>Zero Tolerance:</strong> Hate speech, violence threats, or non-consensual exploitation trigger immediate device bans.</li>
              </ul>
            </>
          )}

          {infoModalTab === 'safety' && (
            <>
              <h2 className="text-lg font-bold text-brand">Safety, Consent & Anonymity Tips</h2>
              <p>
                Protecting your personal privacy while enjoying adult social chats:
              </p>
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-brand/10 border border-brand/20">
                  <h4 className="font-bold text-brand">Never Share Financial or Personal Info</h4>
                  <p className="text-xs text-text-muted mt-0.5">
                    Never reveal your home address, workplace, personal social media profiles (Facebook, Instagram, WhatsApp), or financial details.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-line">
                  <h4 className="font-bold text-text-main">Webcam Background Caution</h4>
                  <p className="text-xs text-text-muted mt-0.5">
                    When switching on your webcam, verify that no diplomas, letters, identifiable landmarks, or personal photos are visible in the camera frame.
                  </p>
                </div>
              </div>
            </>
          )}

          {infoModalTab === 'contact' && (
            <>
              <h2 className="text-lg font-bold text-brand">Contact Support & Disputes</h2>
              <p>
                For technical assistance, copyright claims, or moderation appeals, contact our compliance team:
              </p>
              <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-line space-y-2">
                <p><strong>Email:</strong> support@chatlustora.com</p>
                <p><strong>Abuse Reports:</strong> abuse@chatlustora.com</p>
                <p><strong>Domain:</strong> ChatLustora.com</p>
                <p className="text-xs text-text-muted mt-2">
                  All formal reports regarding minors or non-consensual content are responded to within 12 hours.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
