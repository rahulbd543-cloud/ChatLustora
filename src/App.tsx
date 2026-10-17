import React from 'react';
import { useApp } from './context/AppContext.js';
import { Header } from './components/Header.js';
import { Footer } from './components/Footer.js';
import { AdultGateModal } from './components/AdultGateModal.js';
import { RoomDirectory } from './components/RoomDirectory.js';
import { ChatWorkspace } from './components/ChatWorkspace.js';
import { RoulettePanel } from './components/RoulettePanel.js';
import { BlogSection } from './components/BlogSection.js';
import { ForumSection } from './components/ForumSection.js';
import { ModerationPanel } from './components/ModerationPanel.js';
import { PrivateMessages } from './components/PrivateMessages.js';
import { WebRTCCallModal } from './components/WebRTCCallModal.js';
import { InfoPagesModal } from './components/InfoPagesModal.js';

export const AppContent: React.FC = () => {
  const { activeTab } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-site-bg text-text-main transition-colors">
      {/* 18+ Adult Gate Verification Modal */}
      <AdultGateModal />

      {/* Persistent Global Header */}
      <Header />

      {/* Main Container matching required layout frame */}
      <div className="container-site py-10 max-lg:pb-2 flex-1 flex flex-col">
        <main className="chat-shell flex-1">
          {activeTab === 'directory' && <RoomDirectory />}
          {activeTab === 'chat' && <ChatWorkspace />}
          {activeTab === 'roulette' && <RoulettePanel />}
          {activeTab === 'blog' && <BlogSection />}
          {activeTab === 'forum' && <ForumSection />}
          {activeTab === 'moderation' && <ModerationPanel />}
        </main>
      </div>

      {/* 1-on-1 Direct Messaging Drawer */}
      <PrivateMessages />

      {/* Native WebRTC Video/Audio Call Modal */}
      <WebRTCCallModal />

      {/* Informational Pages Modal (Terms, Privacy, Safety, Guidelines, Contact) */}
      <InfoPagesModal />

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default function App() {
  return <AppContent />;
}
