import type { Agent, GatewaySnapshot } from '../../types';
import { NeonCard } from '../ui/NeonCard';
import { SourceBadge } from '../ui/SourceBadge';

interface Props {
  agents: Agent[];
  gateway: GatewaySnapshot;
}

export function RuntimeSummary({ agents, gateway }: Props) {
  const online = agents.filter((a) => a.status === 'online' || a.status === 'working').length;
  const busy = agents.filter((a) => a.status === 'busy').length;
  const offline = agents.filter((a) => a.status === 'offline' || a.status === 'error').length;

  return (
    <section className="runtime-grid" aria-label="Runtime summary">
      <NeonCard variant={gateway.status === 'online' ? 'green' : 'red'}>
        <div className="status-card__label">
          Gateway <SourceBadge source={gateway.source} />
        </div>
        <div className="status-card__value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className={`gateway-pulse gateway-pulse--${gateway.status}`}
            aria-hidden="true"
          />
          {gateway.status === 'online' ? 'Online' : 'Offline'}
        </div>
        <div className="status-card__sub">{gateway.latency}</div>
      </NeonCard>

      <NeonCard variant="cyan">
        <div className="status-card__label">Online</div>
        <div className="status-card__value" style={{ color: 'var(--green)' }}>
          {online}
        </div>
      </NeonCard>

      <NeonCard variant="amber">
        <div className="status-card__label">Busy</div>
        <div className="status-card__value" style={{ color: 'var(--amber)' }}>
          {busy}
        </div>
      </NeonCard>

      <NeonCard variant="red">
        <div className="status-card__label">Offline</div>
        <div className="status-card__value" style={{ color: 'var(--red)' }}>
          {offline}
        </div>
      </NeonCard>

      <NeonCard variant="blue">
        <div className="status-card__label">System Health</div>
        <div className="status-card__metrics">
          <span className="metric-chip">CPU {gateway.cpu}</span>
          <span className="metric-chip">RAM {gateway.ram}</span>
          <span className="metric-chip">Queue {gateway.queue}</span>
          <span className="metric-chip">Sessions {gateway.sessions}</span>
        </div>
      </NeonCard>
    </section>
  );
}
