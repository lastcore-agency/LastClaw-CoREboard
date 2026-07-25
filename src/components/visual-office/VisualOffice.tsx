import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Agent } from '../../types';
import { scenes } from '../../data/mockAgents';

interface Props {
  agents: Agent[];
  selectedId: string;
  onSelect: (agentId: string) => void;
}

/** Create particles positions deterministically */
const particles = Array.from({ length: 20 }, (_, i) => ({
  left: `${(i * 37 + 13) % 100}%`,
  bottom: `${(i * 23 + 7) % 80}%`,
  delay: `${(i * 1.3) % 8}s`,
  duration: `${6 + (i % 4) * 2}s`,
}));

/**
 * Mock handoff event for light-path demo.
 * Shows a line from Sirius → Draco every 12 seconds.
 */
function useHandoffDemo(agents: Agent[]) {
  const [handoff, setHandoff] = useState<{ from: Agent; to: Agent } | null>(null);

  useEffect(() => {
    const sirius = agents.find((a) => a.id === 'main');
    const draco = agents.find((a) => a.id === 'draco');
    if (!sirius || !draco) return;

    const timer = setInterval(() => {
      setHandoff({ from: sirius, to: draco });
      setTimeout(() => setHandoff(null), 3000);
    }, 12000);

    // Show initial handoff after 3s
    const initial = setTimeout(() => {
      setHandoff({ from: sirius, to: draco });
      setTimeout(() => setHandoff(null), 3000);
    }, 3000);

    return () => {
      clearInterval(timer);
      clearTimeout(initial);
    };
  }, [agents]);

  return handoff;
}

export function VisualOffice({ agents, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isMobile, setIsMobile] = useState(false);
  const scene = scenes[0]; // Use first scene (agency-automation)
  const handoff = useHandoffDemo(agents);

  const visibleAgents = useMemo(
    () => agents.filter((a) => a.x > 0 && a.y > 0),
    [agents],
  );

  // Detect mobile for breakpoint-based positioning
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  // Pointer parallax for desktop
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  }, [isMobile]);

  // Parallax transform
  const parallaxStyle = isMobile
    ? {}
    : {
        transform: `translate(${(mousePos.x - 0.5) * -6}px, ${(mousePos.y - 0.5) * -6}px)`,
      };

  const bgParallaxStyle = isMobile
    ? {}
    : {
        transform: `translate(${(mousePos.x - 0.5) * -3}px, ${(mousePos.y - 0.5) * -3}px) scale(1.02)`,
      };

  function getAgentPos(agent: Agent) {
    if (isMobile) return agent.position.mobile;
    return agent.position.desktop;
  }

  return (
    <section aria-label="Visual Office">
      <div className="office-toolbar">
        <span className="office-toolbar__title">🏢 Agents Office</span>
        <div className="office-toolbar__actions">
          <span className="toolbar-btn">{scene.name}</span>
          <button className="toolbar-btn" type="button" aria-label="Zoom out">−</button>
          <span className="toolbar-btn">100%</span>
          <button className="toolbar-btn" type="button" aria-label="Zoom in">+</button>
          <button className="toolbar-btn" type="button" aria-label="Fullscreen">⛶</button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="office-container"
        onMouseMove={handleMouseMove}
      >
        <div className="office-map" role="img" aria-label="Office scene with agent positions">
          {/* Scene background image */}
          <picture className="scene-bg" style={bgParallaxStyle}>
            <source media="(max-width: 767px)" srcSet={scene.mobile} />
            <img
              src={scene.desktop}
              alt="Agency automation office"
              className="scene-bg__img"
              loading="eager"
              draggable={false}
            />
          </picture>

          {/* Dark gradient overlay for depth */}
          <div className="scene-overlay scene-overlay--gradient" aria-hidden="true" />

          {/* Vignette */}
          <div className="scene-overlay scene-overlay--vignette" aria-hidden="true" />

          {/* Animated light overlay */}
          <div className="scene-overlay scene-overlay--light" aria-hidden="true" />

          {/* Ambient grid */}
          <div className="office-grid" aria-hidden="true" style={parallaxStyle} />

          {/* Light beam sweep */}
          <div className="office-light-beam" aria-hidden="true" />

          {/* Particles */}
          <div className="office-particles" aria-hidden="true">
            {particles.map((p, i) => (
              <span
                key={i}
                className="particle"
                style={{
                  left: p.left,
                  bottom: p.bottom,
                  animationDelay: p.delay,
                  animationDuration: p.duration,
                }}
              />
            ))}
          </div>

          {/* Handoff light path (MOCK demo) */}
          {handoff && (
            <svg
              className="handoff-svg"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="handoff-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="var(--blue)" stopOpacity="1" />
                  <stop offset="100%" stopColor="var(--purple)" stopOpacity="0.8" />
                </linearGradient>
                <filter id="handoff-glow">
                  <feGaussianBlur stdDeviation="0.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <line
                x1={getAgentPos(handoff.from).x}
                y1={getAgentPos(handoff.from).y}
                x2={getAgentPos(handoff.to).x}
                y2={getAgentPos(handoff.to).y}
                stroke="url(#handoff-grad)"
                strokeWidth="0.3"
                filter="url(#handoff-glow)"
                className="handoff-line"
              />
              <circle
                r="0.6"
                fill="var(--cyan)"
                filter="url(#handoff-glow)"
                className="handoff-pulse"
              >
                <animateMotion
                  dur="1.5s"
                  repeatCount="indefinite"
                  path={`M ${getAgentPos(handoff.from).x},${getAgentPos(handoff.from).y} L ${getAgentPos(handoff.to).x},${getAgentPos(handoff.to).y}`}
                />
              </circle>
              <text
                x={(getAgentPos(handoff.from).x + getAgentPos(handoff.to).x) / 2}
                y={(getAgentPos(handoff.from).y + getAgentPos(handoff.to).y) / 2 - 2}
                className="handoff-label"
                textAnchor="middle"
                fill="var(--cyan)"
                fontSize="2.5"
              >
                MOCK handoff
              </text>
            </svg>
          )}

          {/* Agent sprites */}
          {visibleAgents.map((agent) => {
            const isSelected = selectedId === agent.id;
            const pos = getAgentPos(agent);
            const showBubble = isSelected && agent.bubble;

            return (
              <button
                key={agent.id}
                className={[
                  'agent-sprite',
                  isSelected ? 'agent-sprite--selected' : '',
                  agent.status === 'offline' ? 'agent-sprite--offline' : '',
                  agent.status === 'working' ? 'agent-sprite--working' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onSelect(agent.id)}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: `translate(-50%, -50%) scale(${pos.scale})`,
                }}
                aria-label={`${agent.displayName} — ${agent.status}${agent.currentTask ? `: ${agent.currentTask}` : ''}`}
                aria-pressed={isSelected}
                type="button"
              >
                {/* Selection glow ring */}
                {isSelected && <span className="agent-selection-glow" aria-hidden="true" />}

                {/* Status ring */}
                <span className={`agent-status-ring agent-status-ring--${agent.status}`} aria-hidden="true" />

                {/* Animated character */}
                <picture className="agent-sprite__character">
                  <img
                    src={agent.character.animated}
                    alt={agent.displayName}
                    className="agent-sprite__avatar"
                    loading="lazy"
                    width={80}
                    height={80}
                  />
                </picture>

                {/* Name plate */}
                <span className="agent-sprite__name">
                  <span className={`agent-sprite__status-dot agent-sprite__status-dot--${agent.status}`} />
                  {agent.displayName}
                </span>

                {/* Speech bubble — only shown for selected or active event */}
                {showBubble && (
                  <span className="speech-bubble">
                    {agent.bubble}
                  </span>
                )}
              </button>
            );
          })}

          {/* Foreground glow overlay */}
          <div className="scene-overlay scene-overlay--foreground" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
