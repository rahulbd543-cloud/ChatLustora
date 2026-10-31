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
  const {
    activeTab,
    isDmDrawerOpen,
    dmWindowMode
  } = useApp();

  const showAdjacentDm =
    activeTab === 'chat' &&
    isDmDrawerOpen &&
    dmWindowMode === 'maximized';

  return (
    <div className="min-h-screen flex flex-col bg-site-bg text-text-main transition-colors">
      <AdultGateModal />
      <Header />

      <div className="container-site py-10 max-lg:pb-2 flex-1 flex flex-col min-h-0">
        <div
          className={
            showAdjacentDm
              ? 'flex flex-1 min-h-0 items-stretch gap-4 max-lg:flex-col'
              : 'flex flex-1 min-h-0'
          }
        >
          <main
            className={
              showAdjacentDm
                ? 'chat-shell min-w-0 flex-1'
                : 'chat-shell flex-1'
            }
          >
            {activeTab === 'directory' && <RoomDirectory />}
            {activeTab === 'chat' && <ChatWorkspace />}
            {activeTab === 'roulette' && <RoulettePanel />}
            {activeTab === 'blog' && <BlogSection />}
            {activeTab === 'forum' && <ForumSection />}
            {activeTab === 'moderation' && <ModerationPanel />}
          </main>

          {showAdjacentDm && <PrivateMessages />}
        </div>
      </div>

      {!showAdjacentDm && <PrivateMessages />}

      <WebRTCCallModal />
      <InfoPagesModal />
      <Footer />
    </div>
  );
};

export default function App() {
  return <AppContent />;
}
