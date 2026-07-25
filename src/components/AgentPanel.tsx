import type { Agent } from '../types';

export type PanelTab = 'status' | 'configure' | 'skills' | 'chat';

type Props = {
  agent: Agent;
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  onModelChange: (model: string) => void;
  onToggleSkill: (skillName: string) => void;
  onPause: () => void;
  onRestart: () => void;
};

const models = ['GPT-4o', 'GPT-4.1', 'Claude 3.5', 'Gemini 2.5 Pro', 'GPT-4o-mini'];

export function AgentPanel({
  agent,
  activeTab,
  onTabChange,
  onModelChange,
  onToggleSkill,
  onPause,
  onRestart,
}: Props) {
  return (
    <section className="panel-wrap">
      <div className="panel-agent-head">
        <div className="panel-agent-avatar" style={{ background: agent.color }}>
          <span>🧑</span>
        </div>
        <div className="panel-agent-meta">
          <div className="panel-agent-meta__top">
            <h2>{agent.name}</h2>
            <span className={`badge badge--${agent.status.toLowerCase()}`}>{agent.status}</span>
          </div>
          <p>{agent.role}</p>
          <div className="mini-grid">
            <div className="mini-card">
              <span>Room</span>
              <strong>{agent.room}</strong>
            </div>
            <div className="mini-card">
              <span>Model</span>
              <strong>{agent.model}</strong>
            </div>
            <div className="mini-card">
              <span>Uptime</span>
              <strong>{agent.uptime}</strong>
            </div>
            <div className="mini-card">
              <span>Queue</span>
              <strong>{agent.queue}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="tabs-row">
        {(['status', 'configure', 'skills', 'chat'] as PanelTab[]).map((tab) => (
          <button
            key={tab}
            className={tab === activeTab ? 'tab-button tab-button--active' : 'tab-button'}
            onClick={() => onTabChange(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'status' && (
        <div className="panel-stack">
          <div className="panel-card">
            <div className="panel-card__title">Current Task</div>
            <div className="task-title">{agent.currentTaskLabel}</div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${agent.progress}%` }} />
            </div>
            <div className="metric-line">Latency {agent.latency} • Memory {agent.memory}</div>
          </div>

          <div className="panel-card">
            <div className="panel-card__title">Recent Logs</div>
            <div className="log-list">
              {agent.logs.map((log) => (
                <div key={log} className="log-item">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'configure' && (
        <div className="panel-stack">
          <div className="panel-card">
            <div className="panel-card__title">Model</div>
            <select className="field" value={agent.model} onChange={(event) => onModelChange(event.target.value)}>
              {models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
            <div className="range-row">
              <span>Temperature</span>
              <span>0.7</span>
            </div>
            <div className="range-track">
              <span className="range-track__fill" style={{ width: '55%' }} />
            </div>
            <div className="range-row">
              <span>Max Tokens</span>
              <span>4096</span>
            </div>
            <div className="range-track">
              <span className="range-track__fill" style={{ width: '63%' }} />
            </div>
          </div>

          <div className="action-grid">
            <button className="secondary-button" onClick={onPause}>
              Pause Agent
            </button>
            <button className="primary-button" onClick={onRestart}>
              Restart Agent
            </button>
          </div>
        </div>
      )}

      {activeTab === 'skills' && (
        <div className="panel-stack">
          <div className="panel-card">
            <div className="panel-card__title">Skills • Plugins • Tools</div>
            <div className="skill-list">
              {agent.skills.map((skill) => (
                <div key={skill.name} className="skill-item">
                  <div>
                    <div className="skill-item__name">{skill.name}</div>
                    <div className="skill-item__meta">
                      {skill.installed ? 'Installed' : 'Not installed'} • {skill.healthy ? 'Healthy' : 'Unhealthy'}
                    </div>
                  </div>
                  <button
                    className={skill.enabled ? 'toggle toggle--on' : 'toggle'}
                    onClick={() => onToggleSkill(skill.name)}
                  >
                    <span />
                  </button>
                </div>
              ))}
            </div>
            <button className="install-button">Install from ClawHub</button>
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="panel-stack">
          <div className="panel-card">
            <div className="panel-card__title">Telegram Bridge</div>
            <div className="chat-room-card">
              {agent.telegramGroup} • {agent.telegramTopic}
            </div>
            <div className="chat-list">
              <div className="chat-bubble">Jordan Dev: /status</div>
              <div className="chat-bubble chat-bubble--agent">{agent.name}: System healthy. Queue stable.</div>
              <div className="chat-bubble">Sam Kim: /run report sales_q2 --format md</div>
            </div>
            <div className="chat-input-row">
              <input className="field" placeholder="Message OpenClaw Ops..." />
              <button className="primary-button primary-button--compact">Send</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
