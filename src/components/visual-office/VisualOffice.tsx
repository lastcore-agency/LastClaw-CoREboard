import { useMemo } from 'react';
import type { Agent } from '../../types';

interface Props {
  agents: Agent[];
  selectedId: string;
  onSelect: (agentId: string) => void;
}

const rooms = [
  { name: 'HQ',           left: '2%',  top: '2%',  width: '32%', height: '30%', className: 'room room--hq' },
  { name: 'Development',  left: '36%', top: '2%',  width: '62%', height: '30%', className: 'room room--development' },
  { name: 'Testing & QA', left: '2%',  top: '34%', width: '32%', height: '30%', className: 'room room--qa' },
  { name: 'Hub',          left: '36%', top: '34%', width: '32%', height: '30%', className: 'room room--hub' },
  { name: 'DevOps',       left: '70%', top: '34%', width: '28%', height: '30%', className: 'room room--devops' },
];

const furniture = [
  { left: '9%',  top: '14%', width: '16%', height: '10%' },
  { left: '47%', top: '14%', width: '16%', height: '10%' },
  { left: '70%', top: '14%', width: '16%', height: '10%' },
  { left: '9%',  top: '48%', width: '16%', height: '10%' },
  { left: '70%', top: '52%', width: '16%', height: '10%' },
];

// Create particles positions deterministically
const particles = Array.from({ length: 15 }, (_, i) => ({
  left: `${(i * 37 + 13) % 100}%`,
  bottom: `${(i * 23 + 7) % 60}%`,
  delay: `${(i * 1.3) % 8}s`,
  duration: `${6 + (i % 4) * 2}s`,
}));

export function VisualOffice({ agents, selectedId, onSelect }: Props) {
  const visibleAgents = useMemo(
    () => agents.filter((a) => a.x > 0 && a.y > 0),
    [agents],
  );

  return (
    <section aria-label="Visual Office">
      <div className="office-toolbar">
        <span className="office-toolbar__title">🏢 Agents Office</span>
        <div className="office-toolbar__actions">
          <span className="toolbar-btn">Office Pack</span>
          <button className="toolbar-btn" type="button" aria-label="Zoom out">−</button>
          <span className="toolbar-btn">100%</span>
          <button className="toolbar-btn" type="button" aria-label="Zoom in">+</button>
          <button className="toolbar-btn" type="button" aria-label="Fullscreen">⛶</button>
        </div>
      </div>

      <div className="office-container">
        <div className="office-map" role="img" aria-label="Office floor plan with agent positions">
          {/* Ambient grid */}
          <div className="office-grid" aria-hidden="true" />

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

          {/* Rooms */}
          {rooms.map((room) => (
            <div
              key={room.name}
              className={room.className}
              style={{ left: room.left, top: room.top, width: room.width, height: room.height }}
            >
              <span className="room__label">{room.name}</span>
            </div>
          ))}

          {/* Furniture */}
          {furniture.map((item, index) => (
            <div
              key={index}
              className="desk"
              style={{ left: item.left, top: item.top, width: item.width, height: item.height }}
            >
              <span className="desk__monitor" />
              <span className="desk__mug" />
            </div>
          ))}

          <div className="table--hub" />
          <div className="server-rack" />
          <div className="plant plant--left" />
          <div className="plant plant--right" />

          {/* Agent sprites */}
          {visibleAgents.map((agent) => {
            const isSelected = selectedId === agent.id;
            return (
              <button
                key={agent.id}
                className={[
                  'agent-sprite',
                  isSelected ? 'agent-sprite--selected' : '',
                  agent.status === 'offline' ? 'agent-sprite--offline' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onSelect(agent.id)}
                style={{ left: `${agent.x}%`, top: `${agent.y}%` }}
                aria-label={`${agent.displayName} — ${agent.status}${agent.currentTask ? `: ${agent.currentTask}` : ''}`}
                aria-pressed={isSelected}
                type="button"
              >
                <span className="agent-sprite__name">
                  <span className={`agent-sprite__status-dot agent-sprite__status-dot--${agent.status}`} />
                  {agent.displayName}
                </span>
                <img
                  src={agent.avatar}
                  alt={agent.displayName}
                  className="agent-sprite__avatar"
                  loading="lazy"
                  width={64}
                  height={64}
                />
                {isSelected && agent.bubble && (
                  <span className="speech-bubble">{agent.bubble}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
