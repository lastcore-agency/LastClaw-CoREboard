import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Agent, GatewaySnapshot } from '../../types';
import { scenes } from '../../data/mockAgents';
import { useSettings } from '../../contexts/SettingsContext';
import { SourceBadge } from '../ui/SourceBadge';

interface Props {
  agents: Agent[];
  gateway?: GatewaySnapshot | null;
  selectedId: string;
  onSelect: (id: string) => void;
}

const particles = Array.from({ length: 20 }, (_, i) => ({ left: `${(i * 37 + 13) % 100}%`, bottom: `${(i * 23 + 7) % 80}%`, delay: `${(i * 1.3) % 8}s`, duration: `${6 + (i % 4) * 2}s` }));

function useHandoffDemo(agents: Agent[]) {
  const [handoff, setHandoff] = useState<{ from: Agent; to: Agent } | null>(null);
  useEffect(() => {
    const sirius = agents.find((a) => a.id === 'sirius');
    const draco = agents.find((a) => a.id === 'draco');
    if (!sirius || !draco) return;
    const timer = setInterval(() => { setHandoff({ from: sirius, to: draco }); setTimeout(() => setHandoff(null), 3500); }, 12000);
    const initial = setTimeout(() => { setHandoff({ from: sirius, to: draco }); setTimeout(() => setHandoff(null), 3500); }, 3000);
    return () => { clearInterval(timer); clearTimeout(initial); };
  }, [agents]);
  return handoff;
}

export function VisualOffice({ agents, gateway, selectedId, onSelect }: Props) {
  const { businessName } = useSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isMobile, setIsMobile] = useState(false);
  const scene = scenes[0];
  const handoff = String(import.meta.env.VITE_USE_MOCK || "false") === "true" ? useHandoffDemo(agents) : null;
  const visibleAgents = useMemo(() => agents.filter((a) => a.x > 0 && a.y > 0), [agents]);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMousePos({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
  }, [isMobile]);

  const parallaxStyle = isMobile ? {} : { transform: `translate(${(mousePos.x - 0.5) * -8}px, ${(mousePos.y - 0.5) * -8}px)` };
  const bgParallaxStyle = isMobile ? {} : { transform: `translate(${(mousePos.x - 0.5) * -4}px, ${(mousePos.y - 0.5) * -4}px) scale(1.03)` };

  function getAgentPos(agent: Agent) { return isMobile ? agent.position.mobile : agent.position.desktop; }

  return (
    <motion.section initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: 'easeOut' }} aria-label="Visual Office">
      <div className="office-toolbar">
        <div className="office-toolbar__title" title={businessName}>
          <span aria-hidden="true">🏢</span>
          <span className="business-name-text">{businessName}</span>
        </div>
        <div className="office-toolbar__actions">
          <span className="toolbar-btn">SiX-SQUAD Automation <span style={{ marginLeft: 4 }}><SourceBadge source={gateway?.source || 'EMPTY'} /></span></span>
          <button className="toolbar-btn" type="button" aria-label="Zoom out">−</button>
          <span className="toolbar-btn">100%</span>
          <button className="toolbar-btn" type="button" aria-label="Zoom in">+</button>
          <button className="toolbar-btn" type="button" aria-label="Fullscreen">⛶</button>
        </div>
      </div>

      <div className="premium-card office-container" ref={containerRef} onMouseMove={handleMouseMove}>
        <div className="premium-border-trail" aria-hidden="true" />
        <div className="office-map" role="img" aria-label="Office scene with agent positions">
          <picture className="scene-bg" style={bgParallaxStyle}>
            <source media="(max-width: 767px)" srcSet={scene.mobile} />
            <img src={scene.desktop} alt="Agency automation office" className="scene-bg__img" loading="eager" draggable={false} />
          </picture>

          <div className="scene-overlay scene-overlay--gradient" aria-hidden="true" />
          <div className="scene-overlay scene-overlay--vignette" aria-hidden="true" />
          
          {/* Ambient pointer glow on desktop */}
          {!isMobile && (
            <div className="ambient-pointer-glow" style={{ left: `${mousePos.x * 100}%`, top: `${mousePos.y * 100}%` }} aria-hidden="true" />
          )}

          <div className="office-grid" aria-hidden="true" style={parallaxStyle} />
          
          {/* Enhanced MOCK handoff animation */}
          <AnimatePresence>
            {handoff && (
              <motion.svg
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="handoff-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"
              >
                <defs>
                  <linearGradient id="handoff-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0" />
                    <stop offset="50%" stopColor="var(--blue)" stopOpacity="1" />
                    <stop offset="100%" stopColor="var(--blue)" stopOpacity="0" />
                  </linearGradient>
                  <filter id="handoff-glow"><feGaussianBlur stdDeviation="1" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <motion.line
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease: "easeOut" }}
                  x1={getAgentPos(handoff.from).x} y1={getAgentPos(handoff.from).y}
                  x2={getAgentPos(handoff.to).x} y2={getAgentPos(handoff.to).y}
                  stroke="var(--blue-dim)" strokeWidth="0.5" className="handoff-track"
                />
                <motion.line
                  x1={getAgentPos(handoff.from).x} y1={getAgentPos(handoff.from).y}
                  x2={getAgentPos(handoff.to).x} y2={getAgentPos(handoff.to).y}
                  stroke="url(#handoff-grad)" strokeWidth="0.8" filter="url(#handoff-glow)" className="handoff-energy"
                />
                <circle r="1" fill="var(--cyan)" filter="url(#handoff-glow)">
                  <animateMotion dur="1.2s" repeatCount="indefinite" path={`M ${getAgentPos(handoff.from).x},${getAgentPos(handoff.from).y} L ${getAgentPos(handoff.to).x},${getAgentPos(handoff.to).y}`} />
                </circle>
                <circle cx={getAgentPos(handoff.from).x} cy={getAgentPos(handoff.from).y} r="2" fill="var(--cyan)" className="handoff-source-pulse" />
                <circle cx={getAgentPos(handoff.to).x} cy={getAgentPos(handoff.to).y} r="2" fill="var(--blue)" className="handoff-dest-pulse" />
                <text x={(getAgentPos(handoff.from).x + getAgentPos(handoff.to).x) / 2} y={Math.min(getAgentPos(handoff.from).y, getAgentPos(handoff.to).y) - 6} className="handoff-label" textAnchor="middle" fill="var(--cyan)" fontSize="1.8" opacity="0.9">
                  HANDOFF
                </text>
              </motion.svg>
            )}
          </AnimatePresence>

          {visibleAgents.map((agent) => {
            const isSelected = selectedId === agent.id;
            const pos = getAgentPos(agent);
            const showBubble = isSelected && agent.bubble;

            return (
              <motion.button
                key={agent.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={['agent-sprite', isSelected ? 'agent-sprite--selected' : '', agent.status === 'offline' ? 'agent-sprite--offline' : '', agent.status === 'working' ? 'agent-sprite--working' : ''].filter(Boolean).join(' ')}
                onClick={() => onSelect(agent.id)}
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: `translate(-50%, -50%) scale(${pos.scale})` }}
                aria-label={`${agent.displayName} — ${agent.status}${agent.currentTask ? `: ${agent.currentTask}` : ''}`}
                aria-pressed={isSelected}
                type="button"
              >
                <AnimatePresence>
                  {isSelected && (
                    <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="agent-selection-bloom" aria-hidden="true" />
                  )}
                </AnimatePresence>
                {isSelected && <span className="agent-selection-glow" aria-hidden="true" />}
                <span className={`agent-status-ring agent-status-ring--${agent.status}`} aria-hidden="true" />
                
                <picture className="agent-sprite__character">
                  <img src={agent.character.animated} alt={agent.displayName} className="agent-sprite__avatar" loading="lazy" width={80} height={80} />
                </picture>

                <span className="agent-sprite__name">
                  <span className={`agent-sprite__status-dot agent-sprite__status-dot--${agent.status}`} />
                  {agent.displayName}
                </span>

                <AnimatePresence>
                  {showBubble && (
                    <motion.span initial={{ opacity: 0, y: 10, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="speech-bubble">
                      {agent.bubble}
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