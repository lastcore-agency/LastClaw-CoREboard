import { useEffect, useMemo, useState } from 'react';
import { AgentPanel, type PanelTab } from './components/AgentPanel';
import { BottomNav } from './components/BottomNav';
import { PixelOffice } from './components/PixelOffice';
import { StatusCards } from './components/StatusCards';
import { fetchAgents, fetchGateway, pauseAgent, restartAgent, updateAgentConfig } from './lib/openclaw';
import type { Agent, GatewaySnapshot } from './types';

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [gateway, setGateway] = useState<GatewaySnapshot | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<PanelTab>('configure');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        const [agentData, gatewayData] = await Promise.all([fetchAgents(), fetchGateway()]);
        if (!alive) return;
        setAgents(agentData);
        setGateway(gatewayData);
        setSelectedId(agentData[0]?.id ?? '');
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
    () => agents.find((agent) => agent.id === selectedId) ?? agents[0],
    [agents, selectedId],
  );

  async function handleModelChange(model: string) {
    if (!selectedAgent) return;
    setSaving(true);
    setAgents((current) => current.map((agent) => (agent.id === selectedAgent.id ? { ...agent, model } : agent)));
    try {
      const updated = await updateAgentConfig(selectedAgent.id, { model });
      setAgents((current) => current.map((agent) => (agent.id === updated.id ? { ...agent, ...updated } : agent)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update model');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleSkill(skillName: string) {
    if (!selectedAgent) return;
    const nextAgents = agents.map((agent) => {
      if (agent.id !== selectedAgent.id) return agent;
      return {
        ...agent,
        skills: agent.skills.map((skill) =>
          skill.name === skillName ? { ...skill, enabled: !skill.enabled } : skill,
        ),
      };
    });
    setAgents(nextAgents);
    try {
      const current = nextAgents.find((item) => item.id === selectedAgent.id);
      if (current) {
        const updated = await updateAgentConfig(selectedAgent.id, { skills: current.skills });
        setAgents((currentList) => currentList.map((agent) => (agent.id === updated.id ? { ...agent, ...updated } : agent)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle skill');
    }
  }

  async function handlePause() {
    if (!selectedAgent) return;
    try {
      await pauseAgent(selectedAgent.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause agent');
    }
  }

  async function handleRestart() {
    if (!selectedAgent) return;
    try {
      await restartAgent(selectedAgent.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restart agent');
    }
  }

  if (loading || !gateway || !selectedAgent) {
    return <div className="app-loading">Loading OpenClaw Pixel Office...</div>;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <div className="app-title">OpenClaw Pixel Office</div>
          <div className="app-subtitle">
            <span className="app-dot" /> Connected
          </div>
        </div>
        <button className="ghost-button">Live</button>
      </header>

      <StatusCards agents={agents} gateway={gateway} />

      {(error || saving) && (
        <div className="app-banner">
          {error ? error : 'Saving configuration...'}
        </div>
      )}

      <main className="app-main">
        <PixelOffice agents={agents} selectedId={selectedAgent.id} onSelect={setSelectedId} />
        <AgentPanel
          agent={selectedAgent}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onModelChange={handleModelChange}
          onToggleSkill={handleToggleSkill}
          onPause={handlePause}
          onRestart={handleRestart}
        />
      </main>

      <BottomNav />
    </div>
  );
}
