import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CommandCenterHeader } from './components/command-center/CommandCenterHeader';
import { RuntimeSummary } from './components/command-center/RuntimeSummary';
import { AgentInspector } from './components/agents/AgentInspector';
import { VisualOffice } from './components/visual-office/VisualOffice';
import { TopNavigation } from './components/navigation/TopNavigation';
import { BottomNavigation } from './components/navigation/BottomNavigation';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { fetchAgents, fetchGateway } from './lib/openclaw';
import { SettingsPage } from './components/settings/SettingsPage';
import { LayoutSwitcher } from './components/command-center/LayoutSwitcher';
import type { Agent, ConnectionState, GatewaySnapshot, NavPage } from './types';

type LayoutOrder = 'office-first' | 'status-first';

const pageVariants = {
  initial: { opacity: 0, y: 10, filter: 'blur(4px)', scale: 0.99 },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, y: -10, filter: 'blur(4px)', scale: 0.99, transition: { duration: 0.2, ease: 'easeIn' } }
};

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [gateway, setGateway] = useState<GatewaySnapshot | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [showInspector, setShowInspector] = useState(false);
  const [activePage, setActivePage] = useState<NavPage>('center');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [connectionState] = useState<ConnectionState>('connected');

  const [layoutOrder, setLayoutOrder] = useState<LayoutOrder>(() => {
    const saved = localStorage.getItem('coreboard:center-layout-order');
    if (saved === 'office-first' || saved === 'status-first') return saved;
    return 'office-first';
  });

  useEffect(() => {
    localStorage.setItem('coreboard:center-layout-order', layoutOrder);
  }, [layoutOrder]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        const [agentData, gatewayData] = await Promise.all([fetchAgents(), fetchGateway()]);
        if (!alive) return;
        setAgents(agentData);
        setGateway(gatewayData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => { alive = false; };
  }, []);

  const selectedAgent = useMemo(() => agents.find((a) => a.id === selectedId), [agents, selectedId]);

  function handleSelectAgent(agentId: string) {
    setSelectedId(agentId);
    setShowInspector(true);
  }

  if (loading) {
    return (
      <div className="app-loading" role="status" aria-label="Loading">
        <motion.span
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          Initializing CoreBoard...
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
      />
      <TopNavigation activePage={activePage} onNavigate={setActivePage} />

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="app-banner" role="alert">
          {error}
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {activePage === 'center' && gateway && (
          <motion.div key="center" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="page-container">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {layoutOrder === 'office-first' ? (
                <>
                  <motion.div layout key="office" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
                    <main className="app-main">
                      <VisualOffice agents={agents} gateway={gateway} selectedId={selectedId} onSelect={handleSelectAgent} />
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
                      <VisualOffice agents={agents} gateway={gateway} selectedId={selectedId} onSelect={handleSelectAgent} />
                    </main>
                  </motion.div>
                </>
              )}
            </div>
          </motion.div>
        )}

        {activePage === 'settings' && <SettingsPage key="settings" />}

        {['studio', 'board', 'chat'].includes(activePage) && (
          <motion.div key={activePage} variants={pageVariants} initial="initial" animate="animate" exit="exit" className="placeholder-page">
            <div className="placeholder-card premium-card">
              <div className="premium-border-trail" aria-hidden="true" />
              <div className="placeholder-page__icon">
                {activePage === 'studio' && '⟨/⟩'}
                {activePage === 'board' && '📋'}
                {activePage === 'chat' && '💬'}
              </div>
              <div className="placeholder-page__title">{activePage.charAt(0).toUpperCase() + activePage.slice(1)}</div>
              <div className="placeholder-page__desc">Module coming in next phase</div>
            </div>
          </motion.div>
        )}
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