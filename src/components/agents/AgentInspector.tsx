import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Agent, InspectorTab } from '../../types';
import { SourceBadge } from '../ui/SourceBadge';

interface Props { agent: Agent; onClose: () => void; }
const tabs: { id: InspectorTab; label: string }[] = [{ id: 'status', label: 'Status' }, { id: 'configure', label: 'Configure' }, { id: 'skills', label: 'Skills' }, { id: 'chat', label: 'Chat' }];

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

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="inspector-backdrop" onClick={onClose} aria-hidden="true" />

      <motion.aside
        ref={panelRef}
        variants={variants}
        initial="hidden" animate="visible" exit="exit"
        className="inspector premium-card"
        role="dialog" aria-label={`Inspector for ${agent.displayName}`} aria-modal="true" tabIndex={-1}
      >
        <div className="premium-border-trail" aria-hidden="true" />
        <div className="inspector__drag-handle" aria-hidden="true" />
        <button className="inspector__close" onClick={onClose} aria-label="Close inspector" type="button">✕</button>

        <div className="inspector__header">
          <div className="inspector__avatar inspector__avatar--lg">
            <img src={agent.character.animated} alt={agent.displayName} />
          </div>
          <div className="inspector__meta">
            <div className="inspector__name-row">
              <span className="inspector__name">{agent.displayName}</span>
              <span className={`status-badge status-badge--${agent.status}`}>{agent.status.toUpperCase()}</span>
              <SourceBadge source={agent.source} />
            </div>
            <div className="inspector__agent-id">{agent.id}</div>
            <div className="inspector__role">{agent.role}</div>
            <div className="mini-grid">
              <div className="mini-card"><div className="mini-card__label">Room</div><div className="mini-card__value">{agent.room}</div></div>
              <div className="mini-card"><div className="mini-card__label">Model</div><div className="mini-card__value">{agent.model}</div></div>
              <div className="mini-card"><div className="mini-card__label">Uptime</div><div className="mini-card__value">{agent.uptime}</div></div>
              <div className="mini-card"><div className="mini-card__label">Queue</div><div className="mini-card__value">{agent.queue}</div></div>
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
  return (
    <>
      <div className="panel-card premium-inner-card">
        <div className="panel-card__title">Current Task</div>
        <div className="task-title">{agent.currentTask || 'No active task'}</div>
        {agent.progress > 0 && (
          <>
            <div className="progress-track"><motion.div initial={{ width: 0 }} animate={{ width: `${agent.progress}%` }} transition={{ duration: 0.5 }} className="progress-fill" /></div>
            <div className="metric-line">{agent.progress}% complete</div>
          </>
        )}
      </div>
      <div className="panel-card premium-inner-card">
        <div className="panel-card__title">Session Info</div>
        <div className="log-list">
          <div className="log-item">Session: {agent.sessionId}</div>
          <div className="log-item">Last Active: {agent.lastActive}</div>
          <div className="log-item">Uptime: {agent.uptime}</div>
          <div className="log-item">Runtime Health: <span style={{ color: agent.runtimeHealth === 'healthy' ? 'var(--cyan)' : 'var(--amber)' }}>{agent.runtimeHealth}</span></div>
          <div className="log-item">Workspace: {agent.workspace}</div>
        </div>
      </div>
    </>
  );
}

function ConfigureContent({ agent }: { agent: Agent }) { return (<div className="panel-card premium-inner-card"><div className="panel-card__title">Configuration</div><div className="task-title">Model parameters and limits</div></div>); }
function SkillsContent({ agent }: { agent: Agent }) { return (<div className="panel-card premium-inner-card"><div className="panel-card__title">Agent Skills</div><div className="task-title">Enabled capabilities</div></div>); }
function ChatContent({ agent }: { agent: Agent }) { return (<div className="panel-card premium-inner-card"><div className="panel-card__title">Direct Comm</div><div className="task-title">Interact with {agent.displayName}</div></div>); }
