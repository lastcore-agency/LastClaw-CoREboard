import type { Agent, GatewaySnapshot } from '../types';

type Props = {
  agents: Agent[];
  gateway: GatewaySnapshot;
};

export function StatusCards({ agents, gateway }: Props) {
  const online = agents.filter((a) => a.status === 'ONLINE' || a.status === 'WORKING').length;
  const busy = agents.filter((a) => a.status === 'BUSY').length;
  const offline = agents.filter((a) => a.status === 'OFFLINE').length;

  return (
    <div className="status-grid">
      <div className="status-card status-card--gateway">
        <div className="status-card__label">Gateway</div>
        <div className="status-card__value">{gateway.status}</div>
        <div className="status-card__sub">{gateway.latency}</div>
      </div>
      <div className="status-card">
        <div className="status-card__label">Online</div>
        <div className="status-card__value">{online}</div>
      </div>
      <div className="status-card">
        <div className="status-card__label">Busy</div>
        <div className="status-card__value status-card__value--busy">{busy}</div>
      </div>
      <div className="status-card">
        <div className="status-card__label">Offline</div>
        <div className="status-card__value status-card__value--offline">{offline}</div>
      </div>
      <div className="status-card status-card--health">
        <div className="status-card__label">System Health</div>
        <div className="status-card__metrics">CPU {gateway.cpu} • RAM {gateway.ram} • Queue {gateway.queue}</div>
      </div>
    </div>
  );
}
