import { useEffect, useMemo, useState } from 'react';
import { CommandCenterHeader } from './components/command-center/CommandCenterHeader';
import { RuntimeSummary } from './components/command-center/RuntimeSummary';
import { AgentInspector } from './components/agents/AgentInspector';
import { VisualOffice } from './components/visual-office/VisualOffice';
import { TopNavigation } from './components/navigation/TopNavigation';
import { BottomNavigation } from './components/navigation/BottomNavigation';
import { fetchAgents, fetchGateway } from './lib/openclaw';
import type { Agent, ConnectionState, GatewaySnapshot, NavPage } from './types';

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
        if (agentData.length > 0) {
          setSelectedId(agentData[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedId),
    [agents, selectedId],
  );

  function handleSelectAgent(agentId: string) {
    setSelectedId(agentId);
    setShowInspector(true);
  }

  function handleCloseInspector() {
    setShowInspector(false);
  }

  if (loading) {
    return (
      <div className="app-loading" role="status" aria-label="Loading">
        <span>Loading LastClaw-CoREboard...</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <CommandCenterHeader connectionState={connectionState} />

      <TopNavigation activePage={activePage} onNavigate={setActivePage} />

      {error && (
        <div className="app-banner" role="alert">
          {error}
        </div>
      )}

      {activePage === 'center' && gateway && (
        <>
          <RuntimeSummary agents={agents} gateway={gateway} />

          <main className={`app-main ${!showInspector ? 'app-main--no-inspector' : ''}`}>
            <div>
              <VisualOffice
                agents={agents}
                selectedId={selectedId}
                onSelect={handleSelectAgent}
              />
            </div>

            {showInspector && selectedAgent && (
              <AgentInspector
                agent={selectedAgent}
                onClose={handleCloseInspector}
              />
            )}
          </main>
        </>
      )}

      {activePage === 'studio' && (
        <div className="placeholder-page">
          <div className="placeholder-page__icon">⟨/⟩</div>
          <div className="placeholder-page__title">Studio</div>
          <div className="placeholder-page__desc">
            Agent development workspace — coming in the next phase
          </div>
        </div>
      )}

      {activePage === 'board' && (
        <div className="placeholder-page">
          <div className="placeholder-page__icon">📋</div>
          <div className="placeholder-page__title">Board</div>
          <div className="placeholder-page__desc">
            Task board and project management — coming in the next phase
          </div>
        </div>
      )}

      {activePage === 'chat' && (
        <div className="placeholder-page">
          <div className="placeholder-page__icon">💬</div>
          <div className="placeholder-page__title">Chat</div>
          <div className="placeholder-page__desc">
            Team chat with AI agents — coming in the next phase
          </div>
        </div>
      )}

      {activePage === 'settings' && (
        <div className="placeholder-page">
          <div className="placeholder-page__icon">⚙️</div>
          <div className="placeholder-page__title">Settings</div>
          <div className="placeholder-page__desc">
            Configuration and preferences — coming in the next phase
          </div>
        </div>
      )}

      <BottomNavigation activePage={activePage} onNavigate={setActivePage} />
    </div>
  );
}
