import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Agent, InspectorTab } from '../../types';
import { SourceBadge } from '../ui/SourceBadge';
import { useRuntime } from '../../contexts/RuntimeContext';

interface Props { agent: Agent; onClose: () => void; }
const tabs: { id: InspectorTab; label: string }[] = [{ id: 'status', label: 'Status' }, { id: 'configure', label: 'Configure' }, { id: 'skills', label: 'Skills' }, { id: 'chat', label: 'Chat' }];

/** Safely render any value as a string for display */
function safe(value: unknown, fallback = '—'): string {
  if (value == null) return fallback;
  if (typeof value === 'string') return value || fallback;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && 'primary' in (value as Record<string, unknown>)) {
    return String((value as { primary: unknown }).primary || fallback);
  }
  try { return JSON.stringify(value); } catch { return fallback; }
}

export function AgentInspector({ agent, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('status');
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const isMobile = window.innerWidth < 768;

  useEffect(() => { triggerRef.current = document.activeElement as HTMLElement; }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }, [onClose]);
  useEffect(() => { document.addEventListener('keydown', handleKeyDown); return () => document.removeEventListener('keydown', handleKeyDown); }, [handleKeyDown]);

  useEffect(() => {
    panelRef.current?.focus();
    return () => { triggerRef.current?.focus(); };
  }, []);

  useEffect(() => {
    const original = document.body.style.overflow;
    if (window.innerWidth < 960) { document.body.style.overflow = 'hidden'; }
    return () => { document.body.style.overflow = original; };
  }, []);

  const variants = isMobile 
    ? { hidden: { y: '100%' }, visible: { y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } }, exit: { y: '100%', transition: { type: 'tween', duration: 0.2 } } }
    : { hidden: { x: '100%', opacity: 0 }, visible: { x: 0, opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 200 } }, exit: { x: '100%', opacity: 0, transition: { type: 'tween', duration: 0.2 } } };

  const displayName = safe(agent.displayName, agent.id || 'Agent');
  const statusText = safe(agent.status, 'offline').toUpperCase();
  const statusClass = agent.status || 'offline';
  const avatarSrc = agent.character?.animated || agent.avatar || '';

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="inspector-backdrop" onClick={onClose} aria-hidden="true" />

      <motion.aside
        ref={panelRef}
        variants={variants}
        initial="hidden" animate="visible" exit="exit"
        className="inspector premium-card"
        role="dialog" aria-label={`Inspector for ${displayName}`} aria-modal="true" tabIndex={-1}
      >
        <div className="premium-border-trail" aria-hidden="true" />
        <div className="inspector__drag-handle" aria-hidden="true" />
        <button className="inspector__close" onClick={onClose} aria-label="Close inspector" type="button">✕</button>

        <div className="inspector__header">
          <div className="inspector__avatar inspector__avatar--lg">
            {avatarSrc ? (
              <img src={avatarSrc} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="inspector__avatar-placeholder" aria-label={displayName}>
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="inspector__meta">
            <div className="inspector__name-row">
              <span className="inspector__name">{displayName}</span>
              <span className={`status-badge status-badge--${statusClass}`}>{statusText}</span>
              <SourceBadge source={agent.source || 'EMPTY'} />
            </div>
            <div className="inspector__agent-id">{safe(agent.id, '—')}</div>
            <div className="inspector__role">{safe(agent.role, 'Agent')}</div>
            <div className="mini-grid">
              <div className="mini-card"><div className="mini-card__label">Room</div><div className="mini-card__value">{safe(agent.room, 'unknown')}</div></div>
              <div className="mini-card"><div className="mini-card__label">Model</div><div className="mini-card__value">{safe(agent.model, 'unknown')}</div></div>
              <div className="mini-card"><div className="mini-card__label">Uptime</div><div className="mini-card__value">{safe(agent.uptime, 'Unavailable')}</div></div>
              <div className="mini-card"><div className="mini-card__label">Queue</div><div className="mini-card__value">{safe(agent.queue, 'Unavailable')}</div></div>
            </div>
          </div>
        </div>

        <div className="inspector__tabs" role="tablist">
          {tabs.map((tab) => (
            <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'tab-btn--active' : ''}`} onClick={() => setActiveTab(tab.id)} role="tab" aria-selected={activeTab === tab.id} type="button">
              {activeTab === tab.id && <motion.div layoutId="inspectorTab" className="tab-indicator" />}
              <span style={{ position: 'relative', zIndex: 1 }}>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="inspector__scroll-area">
          <div className="tab-content" role="tabpanel">
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
                {activeTab === 'status' && <StatusContent agent={agent} />}
                {activeTab === 'configure' && <ConfigureContent agent={agent} />}
                {activeTab === 'skills' && <SkillsContent agent={agent} />}
                {activeTab === 'chat' && <ChatContent agent={agent} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

function StatusContent({ agent }: { agent: Agent }) {
  const { gateway, stale, getAgentRuntimeState } = useRuntime();

  // Gateway health from shared context
  const gwStatus = gateway.status === 'online'
    ? stale ? 'stale' : 'online'
    : gateway.status || 'unknown';
  const gwSource = gateway.source || 'unknown';

  // Activity state — SSE > POLL precedence via RuntimeContext
  const runtimeId = agent.runtimeAgentId || agent.id;
  const activityState = getAgentRuntimeState(runtimeId);

  // Connection state — derived from channel telemetry, not session recency
  let connectionState: string;
  if (agent.channelConnected == null) {
    connectionState = 'Unknown';
  } else if (agent.channelReconnectPending) {
    connectionState = 'Reconnecting';
  } else if (agent.channelConnected) {
    connectionState = 'Connected';
  } else if (agent.channelLastError) {
    connectionState = 'Error';
  } else {
    connectionState = 'Disconnected';
  }

  // Last active — prefer SSE-tracked timestamp, fall back to poll lastActiveAt
  const lastActiveDisplay = agent.lastActive && agent.lastActive !== 'Unavailable'
    ? agent.lastActive  // already formatted by openclaw.ts
    : 'Unavailable';

  // Session count
  const sessionDisplay = agent.sessionCount != null
    ? String(agent.sessionCount)
    : 'Unavailable';

  // Model — resolved > configured > model
  const modelDisplay = agent.resolvedModel || agent.configuredModel || agent.model || 'unknown';

  // Heartbeat — informational only
  const heartbeatDisplay = agent.heartbeatEnabled == null
    ? 'Unknown'
    : agent.heartbeatEnabled ? 'Enabled' : 'Disabled';

  // Last channel activity
  const lastChannelDisplay = agent.lastChannelActivityAt
    ? new Date(agent.lastChannelActivityAt).toLocaleTimeString()
    : 'Unavailable';

  // Connection indicator color
  const connColor = connectionState === 'Connected' ? '#4ade80'
    : connectionState === 'Reconnecting' ? '#fbbf24'
    : connectionState === 'Error' ? '#f87171'
    : connectionState === 'Disconnected' ? '#f87171'
    : '#666';

  return (
    <>
      {/* Connection + Activity */}
      <div className="panel-card premium-inner-card">
        <div className="panel-card__title">Runtime State</div>
        <div className="log-list">
          <div className="log-item">
            Connection:&nbsp;
            <span style={{ color: connColor, fontWeight: 600 }}>{connectionState}</span>
            {agent.channelReconnectAttempts != null && agent.channelReconnectAttempts > 0 && (
              <span style={{ color: '#fbbf24', marginLeft: 6, fontSize: 11 }}>
                ({agent.channelReconnectAttempts} attempts)
              </span>
            )}
          </div>
          <div className="log-item">
            Activity:&nbsp;
            <span style={{ color: activityState === 'WORKING' || activityState === 'RESPONDING' ? '#4ade80' : '#c8c8e0', fontWeight: 600 }}>
              {activityState}
            </span>
          </div>
          <div className="log-item">Sessions: {sessionDisplay}</div>
          <div className="log-item">Last Active: {lastActiveDisplay}</div>
          <div className="log-item">Last Channel Activity: {lastChannelDisplay}</div>
          <div className="log-item">
            Heartbeat: <span style={{ color: '#888' }}>{heartbeatDisplay}</span>
            <span style={{ color: '#555', fontSize: 10, marginLeft: 6 }}>(informational)</span>
          </div>
        </div>
      </div>

      {/* Identity + Model */}
      <div className="panel-card premium-inner-card">
        <div className="panel-card__title">Identity</div>
        <div className="log-list">
          <div className="log-item">Runtime ID: {safe(agent.runtimeAgentId || agent.id, '—')}</div>
          <div className="log-item">Model: {safe(modelDisplay, 'unknown')}</div>
          <div className="log-item">Workspace: {agent.workspace
            ? <span style={{ wordBreak: 'break-all', fontSize: 11 }}>{safe(agent.workspace)}</span>
            : <span style={{ color: 'var(--amber, #f59e0b)' }}>WORKSPACE_NOT_RESOLVED</span>
          }</div>
          <div className="log-item">
            Gateway: <span title={`source: ${gwSource}`}>{gwStatus}</span>
          </div>
          {agent.channelLastError && (
            <div className="log-item" style={{ color: '#f87171' }}>
              Channel Error: {agent.channelLastError}
            </div>
          )}
        </div>
      </div>
    </>
  );
}


function ConfigureContent({ agent }: { agent: Agent }) { return (<div className="panel-card premium-inner-card"><div className="panel-card__title">Configuration</div><div className="task-title">Model parameters and limits</div></div>); }
function SkillsContent({ agent }: { agent: Agent }) { return (<div className="panel-card premium-inner-card"><div className="panel-card__title">Agent Skills</div><div className="task-title">Enabled capabilities</div></div>); }
function ChatContent({ agent }: { agent: Agent }) { return (<div className="panel-card premium-inner-card"><div className="panel-card__title">Direct Comm</div><div className="task-title">Interact with {safe(agent.displayName, 'Agent')}</div></div>); }
