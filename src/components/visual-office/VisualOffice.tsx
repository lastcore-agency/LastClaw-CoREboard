import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Agent, GatewaySnapshot, SceneConfig, CharacterDirection } from '../../types';
import { scenes } from '../../data/mockAgents';
import { useSettings } from '../../contexts/SettingsContext';
import { useRuntime } from '../../contexts/RuntimeContext';
import { SourceBadge } from '../ui/SourceBadge';
import {
  type LayoutState, type LayoutSlot,
  SCENE_SLOTS, loadLayout, saveLayout, resetLayout,
  getAgentSlot, getSlotPosition, moveAgentToSlot, getSlotAgent,
} from '../../lib/layout';
import { deriveMotionState, getDirectionFromDelta, getAnimatedIdleAsset, getStaticAsset } from '../../lib/motion';
import type { AgentBubble } from '../../lib/useAgentEvents';
import type { RuntimeAgentState } from '../../lib/useAgentActivity';

interface Props {
  agents: Agent[];
  gateway?: GatewaySnapshot | null;
  selectedId: string;
  onSelect: (id: string) => void;
  eventBubbles?: Map<string, AgentBubble>;
}

const SCENE_STORAGE_KEY = 'coreboard:selected-scene';
const SCENE_SCHEMA_VERSION = 1;

function loadSelectedSceneId(): string {
  try {
    const raw = localStorage.getItem(SCENE_STORAGE_KEY);
    if (!raw) return scenes[0].id;
    const parsed = JSON.parse(raw);
    if (parsed?.schemaVersion === SCENE_SCHEMA_VERSION && typeof parsed.sceneId === 'string') {
      return scenes.some((s) => s.id === parsed.sceneId) ? parsed.sceneId : scenes[0].id;
    }
    return scenes[0].id;
  } catch { return scenes[0].id; }
}

function saveSelectedSceneId(id: string) {
  localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify({ schemaVersion: SCENE_SCHEMA_VERSION, sceneId: id }));
}

/**
 * Runtime handoff visualization — driven by real runtime events.
 * In MOCK mode only: shows animated handoff between first two available agents.
 * In LIVE mode: handoff comes from real event (handled via activity store).
 */
function useHandoffDemo(agents: Agent[], enabled: boolean) {
  const [handoff, setHandoff] = useState<{ from: Agent; to: Agent } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    // Use first 2 online agents available — not hardcoded IDs
    const online = agents.filter((a) => a.status !== 'offline' && a.status !== 'unknown');
    const agentA = online[0];
    const agentB = online[1];
    if (!agentA || !agentB) return;
    const timer = setInterval(() => { setHandoff({ from: agentA, to: agentB }); setTimeout(() => setHandoff(null), 3500); }, 12000);
    const initial = setTimeout(() => { setHandoff({ from: agentA, to: agentB }); setTimeout(() => setHandoff(null), 3500); }, 3000);
    return () => { clearInterval(timer); clearTimeout(initial); };
  }, [agents, enabled]);
  return handoff;
}

function ScenePicture({ scene, variant, isMobile }: { scene: SceneConfig; variant: 'desktop' | 'mobile'; isMobile: boolean }) {
  const basePath = variant === 'desktop' ? scene.desktop : scene.mobile;
  const avifPath = basePath.replace('.png', '.avif');
  const webpPath = basePath.replace('.png', '.webp');
  const shouldLoad = isMobile ? variant === 'mobile' : variant === 'desktop';

  if (!shouldLoad) return null;

  return (
    <picture className="scene-bg">
      <source type="image/avif" srcSet={avifPath} media={variant === 'mobile' ? '(max-width: 767px)' : '(min-width: 768px)'} />
      <source type="image/webp" srcSet={webpPath} media={variant === 'mobile' ? '(max-width: 767px)' : '(min-width: 768px)'} />
      <img src={basePath} alt={`${scene.name} scene`} className="scene-bg__img" loading="eager" draggable={false} width={variant === 'desktop' ? 1600 : 800} height={variant === 'desktop' ? 900 : 1200} />
    </picture>
  );
}

export function VisualOffice({ agents, gateway, selectedId, onSelect, eventBubbles }: Props) {
  const { businessName } = useSettings();
  const { activity, getAgentRuntimeState } = useRuntime();
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isMobile, setIsMobile] = useState(false);
  const [selectedSceneId, setSelectedSceneId] = useState(loadSelectedSceneId);
  const isMock = String(import.meta.env.VITE_USE_MOCK || "false") === "true";
  const handoff = useHandoffDemo(agents, isMock);
  const visibleAgents = useMemo(() => agents.filter((a) => a.x > 0 && a.y > 0), [agents]);

  // Layout state
  const [layout, setLayout] = useState<LayoutState>(loadLayout);
  const [editMode, setEditMode] = useState(false);
  const [dragging, setDragging] = useState<{ agentId: string; offsetX: number; offsetY: number } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const scene = useMemo(() => scenes.find((s) => s.id === selectedSceneId) || scenes[0], [selectedSceneId]);
  const slots = useMemo(() => SCENE_SLOTS[selectedSceneId] || SCENE_SLOTS['office-1'], [selectedSceneId]);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  // Keep layout scene in sync
  useEffect(() => {
    setLayout((prev) => ({ ...prev, selectedSceneId }));
  }, [selectedSceneId]);

  const handleSceneChange = useCallback((id: string) => {
    setSelectedSceneId(id);
    saveSelectedSceneId(id);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMousePos({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
  }, [isMobile]);

  const parallaxStyle = isMobile ? {} : { transform: `translate(${(mousePos.x - 0.5) * -8}px, ${(mousePos.y - 0.5) * -8}px)` };
  const bgParallaxStyle = { position: 'absolute' as const, inset: 0, width: '100%', height: '100%', ...(isMobile ? {} : { transform: `translate(${(mousePos.x - 0.5) * -4}px, ${(mousePos.y - 0.5) * -4}px) scale(1.03)` }) };

  function getAgentPos(agent: Agent) {
    if (!editMode) return isMobile ? agent.position.mobile : agent.position.desktop;
    // In edit mode, use slot positions
    const slot = getAgentSlot(layout, selectedSceneId, agent.id);
    if (slot) return getSlotPosition(slot, isMobile);
    return isMobile ? agent.position.mobile : agent.position.desktop;
  }

  // ── Drag & Drop (pointer events with threshold) ──
  const dragStartRef = useRef<{ x: number; y: number; agentId: string } | null>(null);
  const DRAG_THRESHOLD = 5; // pixels before drag activates

  const handleAgentPointerDown = useCallback((e: React.PointerEvent, agentId: string) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;
    const pos = getAgentPos(agent);
    const agentPx = { x: (pos.x / 100) * rect.width, y: (pos.y / 100) * rect.height };
    // Store drag start position — actual drag activates only after threshold
    dragStartRef.current = { x: e.clientX, y: e.clientY, agentId };
    setDragging({ agentId, offsetX: e.clientX - rect.left - agentPx.x, offsetY: e.clientY - rect.top - agentPx.y });
    setDragPos({ x: e.clientX, y: e.clientY });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [editMode, agents, selectedSceneId, layout, isMobile]);

  const handleAgentPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    e.preventDefault();

    // Check drag threshold before activating visual drag
    if (dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      dragStartRef.current = null; // threshold passed, now dragging
    }

    const rect = containerRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left - dragging.offsetX) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top - dragging.offsetY) / rect.height) * 100;
    setDragPos({ x: Math.max(5, Math.min(95, xPct)), y: Math.max(5, Math.min(95, yPct)) });
  }, [dragging]);

  const handleAgentPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    e.preventDefault();
    dragStartRef.current = null;
    const rect = containerRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left - dragging.offsetX) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top - dragging.offsetY) / rect.height) * 100;

    // Find nearest slot
    let bestSlot: LayoutSlot | null = null;
    let bestDist = Infinity;
    for (const slot of slots) {
      const pos = getSlotPosition(slot, isMobile);
      const dist = Math.hypot(pos.x - xPct, pos.y - yPct);
      if (dist < bestDist) { bestDist = dist; bestSlot = slot; }
    }

    if (bestSlot && bestDist < 25) {
      const newLayout = moveAgentToSlot(layout, selectedSceneId, dragging.agentId, bestSlot.id);
      setLayout(newLayout);
      setHasChanges(true);
    }

    setDragging(null);
    setDragPos(null);
  }, [dragging, slots, isMobile, layout, selectedSceneId]);

  // Escape key handler
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (dragging) { setDragging(null); setDragPos(null); }
        else if (editMode) { handleCancelEdit(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [dragging, editMode]);

  function handleSaveEdit() {
    saveLayout(layout);
    setHasChanges(false);
    setEditMode(false);
  }

  function handleCancelEdit() {
    setLayout(loadLayout());
    setHasChanges(false);
    setEditMode(false);
    setDragging(null);
    setDragPos(null);
  }

  function handleResetLayout() {
    const fresh = resetLayout();
    setLayout(fresh);
    setHasChanges(true);
  }

  function handleAgentClick(agentId: string) {
    if (editMode) return; // In edit mode, use drag instead
    onSelect(agentId);
  }

  return (
    <motion.section initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: 'easeOut' }} aria-label="Visual Office">
      <div className="office-toolbar">
        <div className="office-toolbar__title" title={businessName}>
          <span aria-hidden="true">&#x1f3e2;</span>
          <span className="business-name-text">{businessName}</span>
        </div>
        <div className="office-toolbar__actions">
          <select className="toolbar-btn" value={selectedSceneId} onChange={(e) => handleSceneChange(e.target.value)} aria-label="Select office scene" style={{ appearance: 'auto', paddingRight: 16 }}>
            {scenes.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
          <span className="toolbar-btn">
              {businessName || 'Runtime Office'}
              <SourceBadge source={gateway?.source || 'EMPTY'} />
            </span>

          {editMode ? (
            <>
              <button className="toolbar-btn" onClick={handleSaveEdit} style={{ color: 'var(--green)', fontWeight: 700 }} type="button">Save</button>
              <button className="toolbar-btn" onClick={handleCancelEdit} type="button">Cancel</button>
              <button className="toolbar-btn" onClick={handleResetLayout} type="button">Reset</button>
            </>
          ) : (
            <button className="toolbar-btn" onClick={() => setEditMode(true)} type="button" aria-label="Edit agent layout">Edit Layout</button>
          )}
        </div>
      </div>

      <div
        className={`premium-card office-container${editMode ? ' office-container--editing' : ''}`}
        ref={containerRef}
        onMouseMove={handleMouseMove}
        style={{ aspectRatio: isMobile ? scene.aspectRatio.mobile : scene.aspectRatio.desktop, ...(editMode ? { cursor: dragging ? 'grabbing' : 'default' } : {}) }}
      >
        <div className="premium-border-trail" aria-hidden="true" />
        <div className="office-map" role="img" aria-label={`Office scene: ${scene.name}${editMode ? ' (edit mode)' : ''}`}>
          <div style={bgParallaxStyle}>
            <ScenePicture scene={scene} variant="desktop" isMobile={isMobile} />
            <ScenePicture scene={scene} variant="mobile" isMobile={isMobile} />
          </div>

          <div className="scene-overlay scene-overlay--gradient" aria-hidden="true" />
          <div className="scene-overlay scene-overlay--vignette" aria-hidden="true" />

          {!isMobile && (
            <div className="ambient-pointer-glow" style={{ left: `${mousePos.x * 100}%`, top: `${mousePos.y * 100}%` }} aria-hidden="true" />
          )}

          {/* Slot indicators (edit mode only) */}
          {editMode && slots.map((slot) => {
            const pos = getSlotPosition(slot, isMobile);
            const occupant = getSlotAgent(layout, selectedSceneId, slot.id);
            return (
              <div
                key={slot.id}
                className={`layout-slot ${occupant ? 'layout-slot--occupied' : 'layout-slot--empty'}`}
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
                aria-label={`Slot: ${slot.label}${occupant ? ` (occupied by ${occupant})` : ' (empty)'}`}
              >
                <span className="layout-slot__ring" aria-hidden="true" />
                {!occupant && <span className="layout-slot__label">{slot.label}</span>}
              </div>
            );
          })}

          {/* Handoff SVG */}
          <AnimatePresence>
            {handoff && !editMode && (
              <motion.svg initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="handoff-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="handoff-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--violet)" stopOpacity="0" />
                    <stop offset="50%" stopColor="var(--blue-violet)" stopOpacity="1" />
                    <stop offset="100%" stopColor="var(--blue-violet)" stopOpacity="0" />
                  </linearGradient>
                  <filter id="handoff-glow"><feGaussianBlur stdDeviation="1" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <motion.line initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease: "easeOut" }} x1={getAgentPos(handoff.from).x} y1={getAgentPos(handoff.from).y} x2={getAgentPos(handoff.to).x} y2={getAgentPos(handoff.to).y} stroke="var(--blue-violet-dim)" strokeWidth="0.5" className="handoff-track" />
                <motion.line x1={getAgentPos(handoff.from).x} y1={getAgentPos(handoff.from).y} x2={getAgentPos(handoff.to).x} y2={getAgentPos(handoff.to).y} stroke="url(#handoff-grad)" strokeWidth="0.8" filter="url(#handoff-glow)" className="handoff-energy" />
                <circle r="1" fill="var(--violet)" filter="url(#handoff-glow)"><animateMotion dur="1.2s" repeatCount="indefinite" path={`M ${getAgentPos(handoff.from).x},${getAgentPos(handoff.from).y} L ${getAgentPos(handoff.to).x},${getAgentPos(handoff.to).y}`} /></circle>
                <circle cx={getAgentPos(handoff.from).x} cy={getAgentPos(handoff.from).y} r="2" fill="var(--violet)" className="handoff-source-pulse" />
                <circle cx={getAgentPos(handoff.to).x} cy={getAgentPos(handoff.to).y} r="2" fill="var(--blue-violet)" className="handoff-dest-pulse" />
                <text x={(getAgentPos(handoff.from).x + getAgentPos(handoff.to).x) / 2} y={Math.min(getAgentPos(handoff.from).y, getAgentPos(handoff.to).y) - 6} className="handoff-label" textAnchor="middle" fill="var(--violet)" fontSize="1.8" opacity="0.9">HANDOFF</text>
              </motion.svg>
            )}
          </AnimatePresence>

          {/* Agents */}
          {visibleAgents.map((agent) => {
            const isSelected = selectedId === agent.id;
            const isDraggingThis = dragging?.agentId === agent.id;
            const pos = isDraggingThis && dragPos
              ? { x: dragPos.x, y: dragPos.y, scale: isMobile ? 0.8 : 1 }
              : getAgentPos(agent);

            // ── Bubble logic ───────────────────────────────────────
            // Priority: 1. SSE activity bubble (from activity store)
            //           2. legacy eventBubbles prop (from useAgentEvents)
            //           3. mock bubble (agent.bubble, isMock only)
            const runtimeId = (agent as any).runtimeAgentId || agent.id;
            const activityBubble = activity.bubbles.get(runtimeId) || activity.bubbles.get(agent.id);
            const eventBubble = eventBubbles?.get(agent.id);
            const showActivityBubble = !editMode && !isDraggingThis && activityBubble && Date.now() < activityBubble.expiresAt;
            const showEventBubble = !showActivityBubble && !editMode && !isDraggingThis && eventBubble?.text;
            const showMockBubble = !showActivityBubble && !showEventBubble && !editMode && !isDraggingThis && isMock && isSelected && agent.bubble;
            const bubbleText = showActivityBubble
              ? activityBubble!.text
              : showEventBubble ? eventBubble!.text
              : showMockBubble ? agent.bubble : '';

            // ── Character state: SSE activity → motionState ────────
            // getAgentRuntimeState() applies timestamp precedence: SSE wins over poll
            const runtimeState: RuntimeAgentState = getAgentRuntimeState(runtimeId);
            // Map RuntimeAgentState → legacy AgentMotionState for deriveMotionState compat
            const agentForMotion: Agent = runtimeState !== 'UNKNOWN' ? {
              ...agent,
              status: runtimeState === 'IDLE' ? 'online'
                : runtimeState === 'OFFLINE' ? 'offline'
                : runtimeState === 'ERROR' ? 'error'
                : runtimeState === 'WORKING' || runtimeState === 'THINKING' || runtimeState === 'USING_TOOL' || runtimeState === 'RESPONDING' || runtimeState === 'LISTENING' || runtimeState === 'WAITING' ? 'working'
                : agent.status,
            } : agent;
            const motionState = deriveMotionState(agentForMotion, isMock);
            const agentFacing: CharacterDirection = agent.character.direction || 'front';
            const displayAsset = motionState === 'offline'
              ? getStaticAsset(agent, 'front')
              : getAnimatedIdleAsset(agent, agentFacing);

            return (
              <motion.button
                key={agent.id}
                whileHover={editMode ? undefined : { scale: 1.05 }}
                whileTap={editMode ? undefined : { scale: 0.95 }}
                className={[
                  'agent-sprite',
                  editMode ? 'agent-sprite--draggable' : '',
                  isDraggingThis ? 'agent-sprite--dragging' : '',
                  isSelected && !editMode ? 'agent-sprite--selected' : '',
                  agent.status === 'offline' ? 'agent-sprite--offline' : '',
                  agent.status === 'working' ? 'agent-sprite--working' : '',
                  agent.status === 'unknown' ? 'agent-sprite--unknown' : '',
                  motionState === 'idle' || motionState === 'atDesk' ? 'agent-sprite--idle' : '',
                  motionState === 'walking' ? 'agent-sprite--walking' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleAgentClick(agent.id)}
                onPointerDown={editMode ? (e) => handleAgentPointerDown(e, agent.id) : undefined}
                onPointerMove={isDraggingThis ? handleAgentPointerMove : undefined}
                onPointerUp={isDraggingThis ? handleAgentPointerUp : undefined}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: `translate(-50%, -50%) scale(${pos.scale})${isDraggingThis ? ' scale(1.15)' : ''}`,
                  zIndex: isDraggingThis ? 100 : 20,
                  transition: isDraggingThis ? 'none' : undefined,
                  touchAction: editMode ? 'none' : undefined,
                }}
                aria-label={`${agent.displayName} — ${agent.status}${editMode ? ' (drag to reposition)' : ''}`}
                aria-pressed={isSelected}
                type="button"
              >
                {!editMode && (
                  <AnimatePresence>
                    {isSelected && (
                      <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="agent-selection-bloom" aria-hidden="true" />
                    )}
                  </AnimatePresence>
                )}
                {isSelected && !editMode && <span className="agent-selection-glow" aria-hidden="true" />}
                <span className={`agent-status-ring agent-status-ring--${agent.status}`} aria-hidden="true" />

                <picture className="agent-sprite__character">
                  <img src={displayAsset} alt={agent.displayName} className="agent-sprite__avatar" loading="lazy" width={80} height={80} />
                </picture>

                <span className="agent-sprite__name">
                  <span className={`agent-sprite__status-dot agent-sprite__status-dot--${agent.status}`} />
                  {agent.displayName}
                </span>

                <AnimatePresence>
                  {bubbleText && (
                    <motion.span initial={{ opacity: 0, y: 10, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="speech-bubble" role="status" aria-live="polite">
                      {bubbleText}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
          <div className="scene-overlay scene-overlay--foreground" aria-hidden="true" />
        </div>
      </div>
    </motion.section>
  );
}
