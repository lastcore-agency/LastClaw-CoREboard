import type { Agent } from '../types';

type Props = {
  agents: Agent[];
  selectedId: string;
  onSelect: (agentId: string) => void;
};

const rooms = [
  { name: 'Planning', left: '2%', top: '2%', width: '32%', height: '30%', className: 'room room--planning' },
  { name: 'Development', left: '36%', top: '2%', width: '62%', height: '30%', className: 'room room--development' },
  { name: 'Testing & QA', left: '2%', top: '34%', width: '32%', height: '30%', className: 'room room--qa' },
  { name: 'Hub', left: '36%', top: '34%', width: '32%', height: '30%', className: 'room room--hub' },
  { name: 'DevOps', left: '70%', top: '34%', width: '28%', height: '30%', className: 'room room--devops' },
];

const furniture = [
  { left: '9%', top: '14%', width: '16%', height: '10%' },
  { left: '47%', top: '14%', width: '16%', height: '10%' },
  { left: '70%', top: '14%', width: '16%', height: '10%' },
  { left: '9%', top: '48%', width: '16%', height: '10%' },
  { left: '70%', top: '52%', width: '16%', height: '10%' },
];

export function PixelOffice({ agents, selectedId, onSelect }: Props) {
  return (
    <section className="office-wrap">
      <div className="section-head">
        <div>
          <h2>Agents Office</h2>
          <p>Tap a character to open live controls</p>
        </div>
        <button className="ghost-button">Edit Layout</button>
      </div>

      <div className="office-map">
        <div className="office-grid" />

        {rooms.map((room) => (
          <div
            key={room.name}
            className={room.className}
            style={{ left: room.left, top: room.top, width: room.width, height: room.height }}
          >
            <span className="room__label">{room.name}</span>
          </div>
        ))}

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

        <div className="table table--hub" />
        <div className="fridge" />
        <div className="server-rack" />
        <div className="plant plant--left" />
        <div className="plant plant--right" />

        {agents.map((agent) => {
          const isActive = selectedId === agent.id;
          return (
            <button
              key={agent.id}
              className="agent-sprite"
              onClick={() => onSelect(agent.id)}
              style={{ left: `${agent.x}%`, top: `${agent.y}%` }}
            >
              <span className="agent-sprite__name">{agent.name}</span>
              <span
                className={isActive ? 'agent-sprite__body agent-sprite__body--active' : 'agent-sprite__body'}
                style={{ background: agent.color }}
              >
                <span className="agent-sprite__head" />
                <span className="agent-sprite__screen" />
                <span className="agent-sprite__dot" />
              </span>
              {isActive && <span className="agent-sprite__bubble">{agent.bubble}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
