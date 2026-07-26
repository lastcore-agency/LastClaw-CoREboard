import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CommandCenterHeader } from './components/command-center/CommandCenterHeader';
import { RuntimeSummary } from './components/command-center/RuntimeSummary';
import { AgentInspector } from './components/agents/AgentInspector';
import { VisualOffice } from './components/visual-office/VisualOffice';
import { TopNavigation } from './components/navigation/TopNavigation';
import { BottomNavigation } from './components/navigation/BottomNavigation';
import { fetchAgents, fetchGateway } from './lib/openclaw';
import type { Agent, ConnectionState, GatewaySnapshot, NavPage } from './types';

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

      <CommandCenterHeader connectionState={connectionState} />
      <TopNavigation activePage={activePage} onNavigate={setActivePage} />

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="app-banner" role="alert">
          {error}
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {activePage === 'center' && gateway && (
          <motion.div key="center" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="page-container">
            <RuntimeSummary agents={agents} gateway={gateway} />
            <main className="app-main">
              <VisualOffice agents={agents} selectedId={selectedId} onSelect={handleSelectAgent} />
            </main>
          </motion.div>
        )}

        {['studio', 'board', 'chat', 'settings'].includes(activePage) && (
          <motion.div key={activePage} variants={pageVariants} initial="initial" animate="animate" exit="exit" className="placeholder-page">
            <div className="placeholder-card premium-card">
              <div className="premium-border-trail" aria-hidden="true" />
              <div className="placeholder-page__icon">
                {activePage === 'studio' && '⟨/⟩'}
                {activePage === 'board' && '📋'}
                {activePage === 'chat' && '💬'}
                {activePage === 'settings' && '⚙️'}
              </div>
              <div className="placeholder-page__title">{activePage.charAt(0).toUpperCase() + activePage.slice(1)}</div>
              <div className="placeholder-page__desc">Module coming in next phase</div>
              <div className="mock-notice">⚠ MOCK</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInspector && selectedAgent && (
          <AgentInspector agent={selectedAgent} onClose={() => setShowInspector(false)} />
        )}
      </AnimatePresence>

      <BottomNavigation activePage={activePage} onNavigate={setActivePage} />
    </div>
  );
}