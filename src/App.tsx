import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RuntimeProvider, useRuntime } from './contexts/RuntimeContext';
import { CommandCenterHeader } from './components/command-center/CommandCenterHeader';
import { RuntimeSummary } from './components/command-center/RuntimeSummary';
import { AgentInspector } from './components/agents/AgentInspector';
import { VisualOffice } from './components/visual-office/VisualOffice';
import { TopNavigation } from './components/navigation/TopNavigation';
import { BottomNavigation } from './components/navigation/BottomNavigation';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { useAgentEvents } from './lib/useAgentEvents';
import { SettingsPage } from './components/settings/SettingsPage';
import { ChatPage } from './components/chat/ChatPage';
import { StudioPage } from './components/studio/StudioPage';
import { BoardPage } from './components/board/BoardPage';
import { LayoutSwitcher } from './components/command-center/LayoutSwitcher';
import type { NavPage } from './types';

type LayoutOrder = 'office-first' | 'status-first';

const pageVariants = {
  initial: { opacity: 0, y: 10, filter: 'blur(4px)', scale: 0.99 },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, y: -10, filter: 'blur(4px)', scale: 0.99, transition: { duration: 0.2, ease: 'easeIn' } }
};

// ── Inner app — consumes RuntimeContext ─────────────────────
function AppInner() {
  const { agents, gateway, initialLoading, refreshing, refreshError, stale } = useRuntime();
  const [selectedId, setSelectedId] = useState<string>('');
  const [showInspector, setShowInspector] = useState(false);
  const [activePage, setActivePage] = useState<NavPage>('center');

  const isMock = String(import.meta.env.VITE_USE_MOCK || 'false') === 'true';
  const { bubbles } = useAgentEvents(isMock);

  const [layoutOrder, setLayoutOrder] = useState<LayoutOrder>(() => {
    const saved = localStorage.getItem('coreboard:center-layout-order');
    if (saved === 'office-first' || saved === 'status-first') return saved;
    return 'office-first';
  });

  const selectedAgent = useMemo(() => agents.find((a) => a.id === selectedId), [agents, selectedId]);

  function handleSelectAgent(agentId: string) {
    setSelectedId(agentId);
    setShowInspector(true);
  }

  // Only block initial render — background refreshes never gate here
  if (initialLoading) {
    return (
      <div className="app-loading" role="status" aria-label="Loading">
        <motion.span
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          Initializing CoreBoard…
        </motion.span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Ambient background effects */}
      <div className="ambient-bg" aria-hidden="true" />
      <div className="ambient-grid" aria-hidden="true" />

      <CommandCenterHeader
        gateway={gateway}
        activePage={activePage}
        layoutOrder={layoutOrder}
        onLayoutChange={setLayoutOrder}
        refreshing={refreshing}
        stale={stale}
      />
      <TopNavigation activePage={activePage} onNavigate={setActivePage} />

      {/* Transient error banner — never clears last good data */}
      {refreshError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="app-banner"
          role="alert"
        >
          Connection issue — showing last known data. {refreshError}
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {activePage === 'center' && (
          // ⚠️ No gateway null-gate here — VisualOffice renders even when gateway is
          // transitionally undefined, using whatever last known value we have.
          <motion.div key="center" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="page-container">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {layoutOrder === 'office-first' ? (
                <>
                  <motion.div layout key="office" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
                    <main className="app-main">
                      <VisualOffice agents={agents} gateway={gateway} selectedId={selectedId} onSelect={handleSelectAgent} eventBubbles={bubbles} />
                    </main>
                  </motion.div>
                  <motion.div layout key="status" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
                    <RuntimeSummary agents={agents} gateway={gateway} />
                  </motion.div>
                </>
              ) : (
                <>
                  <motion.div layout key="status" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
                    <RuntimeSummary agents={agents} gateway={gateway} />
                  </motion.div>
                  <motion.div layout key="office" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
                    <main className="app-main">
                      <VisualOffice agents={agents} gateway={gateway} selectedId={selectedId} onSelect={handleSelectAgent} eventBubbles={bubbles} />
                    </main>
                  </motion.div>
                </>
              )}
            </div>
          </motion.div>
        )}

        {activePage === 'settings' && <SettingsPage key="settings" />}
        {activePage === 'chat' && <ChatPage key="chat" />}
        {activePage === 'studio' && <StudioPage key="studio" />}
        {activePage === 'board' && <BoardPage key="board" onOpenChat={() => setActivePage('chat')} />}
      </AnimatePresence>

      <AnimatePresence>
        {showInspector && selectedAgent && (
          <ErrorBoundary>
            <AgentInspector agent={selectedAgent} onClose={() => setShowInspector(false)} />
          </ErrorBoundary>
        )}
      </AnimatePresence>

      <BottomNavigation activePage={activePage} onNavigate={setActivePage} />
    </div>
  );
}

// ── Root — wraps everything in RuntimeProvider ───────────────
export default function App() {
  return (
    <RuntimeProvider>
      <AppInner />
    </RuntimeProvider>
  );
}