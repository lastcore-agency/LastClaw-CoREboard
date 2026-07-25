import { useCallback, useEffect, useRef, useState } from 'react';
import type { Agent, InspectorTab } from '../../types';
import { SourceBadge } from '../ui/SourceBadge';

interface Props {
  agent: Agent;
  onClose: () => void;
}

const tabs: { id: InspectorTab; label: string }[] = [
  { id: 'status',    label: 'Status' },
  { id: 'configure', label: 'Configure' },
  { id: 'skills',    label: 'Skills' },
  { id: 'chat',      label: 'Chat' },
];

const models = ['GPT-4o', 'GPT-4.1', 'Claude 3.5', 'Claude 3.5 Sonnet', 'Gemini 2.5 Pro', 'GPT-4o-mini'];

export function AgentInspector({ agent, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('status');
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Save the trigger element for focus return
  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement;
  }, []);

  // Escape key handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Focus trap and auto-focus
  useEffect(() => {
    panelRef.current?.focus();
    return () => {
      // Return focus to the Agent button that was pressed
      triggerRef.current?.focus();
    };
  }, []);

  // Prevent body scroll when open on mobile
  useEffect(() => {
    const original = document.body.style.overflow;
    if (window.innerWidth < 960) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="inspector-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        ref={panelRef}
        className="inspector"
        role="dialog"
        aria-label={`Inspector for ${agent.displayName}`}
        aria-modal="true"
        tabIndex={-1}
      >
        {/* Mobile drag handle */}
        <div className="inspector__drag-handle" aria-hidden="true" />

        {/* Close button */}
        <button
          className="inspector__close"
          onClick={onClose}
          aria-label="Close inspector"
          type="button"
        >
          ✕
        </button>

        {/* Agent header */}
        <div className="inspector__header">
          <div className="inspector__avatar">
            <img
              src={agent.character.animated}
              alt={agent.displayName}
            />
          </div>
          <div className="inspector__meta">
            <div className="inspector__name-row">
              <span className="inspector__name">{agent.displayName}</span>
              <span className={`status-badge status-badge--${agent.status}`}>
                {agent.status.toUpperCase()}
              </span>
              <SourceBadge source={agent.source} />
            </div>
            <div className="inspector__agent-id">{agent.id}</div>
            <div className="inspector__role">{agent.role}</div>
            <div className="mini-grid">
              <div className="mini-card">
                <div className="mini-card__label">Room</div>
                <div className="mini-card__value">{agent.room}</div>
              </div>
              <div className="mini-card">
                <div className="mini-card__label">Model</div>
                <div className="mini-card__value">{agent.model}</div>
              </div>
              <div className="mini-card">
                <div className="mini-card__label">Uptime</div>
                <div className="mini-card__value">{agent.uptime}</div>
              </div>
              <div className="mini-card">
                <div className="mini-card__label">Queue</div>
                <div className="mini-card__value">{agent.queue}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="inspector__tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="tab-content" role="tabpanel">
          {activeTab === 'status' && <StatusContent agent={agent} />}
          {activeTab === 'configure' && <ConfigureContent agent={agent} />}
          {activeTab === 'skills' && <SkillsContent agent={agent} />}
          {activeTab === 'chat' && <ChatContent agent={agent} />}
        </div>
      </aside>
    </>
  );
}

/* ── Status Tab ── */
function StatusContent({ agent }: { agent: Agent }) {
  return (
    <>
      <div className="panel-card">
        <div className="panel-card__title">Current Task</div>
        <div className="task-title">{agent.currentTask || 'No active task'}</div>
        {agent.progress > 0 && (
          <>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${agent.progress}%` }} />
            </div>
            <div className="metric-line">{agent.progress}% complete</div>
          </>
        )}
      </div>

      <div className="panel-card">
        <div className="panel-card__title">Session Info</div>
        <div className="log-list">
          <div className="log-item">Session: {agent.sessionId}</div>
          <div className="log-item">Last Active: {agent.lastActive}</div>
          <div className="log-item">Uptime: {agent.uptime}</div>
          <div className="log-item">
            Runtime Health:{' '}
            <span style={{ color: agent.runtimeHealth === 'healthy' ? 'var(--green)' : agent.runtimeHealth === 'degraded' ? 'var(--amber)' : 'var(--red)' }}>
              {agent.runtimeHealth}
            </span>
          </div>
          <div className="log-item">Workspace: {agent.workspace}</div>
          <div className="log-item">Model: {agent.model}</div>
          <div className="log-item">Latency: {agent.latency} • Memory: {agent.memory}</div>
          <div className="log-item">Queue: {agent.queue}</div>
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-card__title">Recent Activity</div>
        <div className="log-list">
          {agent.recentActivity.map((item, i) => (
            <div key={i} className="log-item">{item}</div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ── Configure Tab ── */
function ConfigureContent({ agent }: { agent: Agent }) {
  return (
    <>
      <div className="panel-card">
        <div className="panel-card__title">Model Configuration</div>
        <label htmlFor="model-select" style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
          Model
        </label>
        <select id="model-select" className="field" defaultValue={agent.model}>
          {models.map((m) => (
            <option key={m} value={m}>{m}</option>
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

        <div className="range-row">
          <span>Thinking Level</span>
          <span>Medium</span>
        </div>
        <div className="range-track">
          <span className="range-track__fill" style={{ width: '50%' }} />
        </div>
      </div>

      <div className="action-grid">
        <button className="btn-secondary" type="button">⏸ Pause Agent</button>
        <button className="btn-secondary" type="button">▶ Resume</button>
        <button className="btn-primary" type="button" style={{ gridColumn: '1 / -1' }}>🔄 Restart Agent</button>
      </div>

      <div className="mock-notice">
        ⚠ MOCK — Controls are not connected to OpenClaw Runtime
      </div>
    </>
  );
}

/* ── Skills Tab ── */
function SkillsContent({ agent }: { agent: Agent }) {
  return (
    <div className="panel-card">
      <div className="panel-card__title">Skills · Plugins · Tools</div>
      <div className="skill-list">
        {agent.skills.map((skill) => (
          <div key={skill.name} className="skill-item">
            <div className="skill-item__info">
              <div className="skill-item__name">{skill.name}</div>
              <div className="skill-item__desc">{skill.description}</div>
              <div className="skill-item__meta">
                <span>{skill.source}</span>
                <span>{skill.permission}</span>
                <span>{skill.dependencyStatus === 'ok' ? '✓ deps ok' : `⚠ ${skill.dependencyStatus}`}</span>
              </div>
            </div>
            <button
              className={`toggle ${skill.enabled ? 'toggle--on' : ''}`}
              aria-label={`${skill.name}: ${skill.enabled ? 'enabled' : 'disabled'}`}
              type="button"
            >
              <span />
            </button>
          </div>
        ))}
      </div>
      <div className="mock-notice" style={{ marginTop: 12 }}>
        ⚠ MOCK — Skill toggles are not connected
      </div>
    </div>
  );
}

/* ── Chat Tab ── */
function ChatContent({ agent }: { agent: Agent }) {
  return (
    <div className="panel-card">
      <div className="panel-card__title">Agent Chat</div>
      <div className="chat-messages">
        <div className="chat-msg chat-msg--user">
          /status
        </div>
        <div className="chat-msg chat-msg--agent">
          {agent.displayName}: System healthy. Queue stable. Current task: {agent.currentTask || 'idle'}
        </div>
        <div className="chat-placeholder">
          Streaming and tool activity will appear here when connected to OpenClaw Runtime
        </div>
      </div>
      <div className="chat-input-row">
        <input
          className="field"
          placeholder={`Message ${agent.displayName}...`}
          aria-label={`Send message to ${agent.displayName}`}
          disabled
        />
        <button className="btn-primary" type="button" disabled>Send</button>
      </div>
      <div className="mock-notice">
        ⚠ MOCK — Chat is not connected to OpenClaw
      </div>
    </div>
  );
}
