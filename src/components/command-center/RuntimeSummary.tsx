import { motion } from 'framer-motion';
import type { Agent, GatewaySnapshot } from '../../types';
import { NeonCard } from '../ui/NeonCard';
import { SourceBadge } from '../ui/SourceBadge';

interface Props { agents: Agent[]; gateway: GatewaySnapshot; }

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};
const item = {
  hidden: { opacity: 0, y: 15, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export function RuntimeSummary({ agents, gateway }: Props) {
  const online = agents.filter((a) => a.status === 'online' || a.status === 'working').length;
  const busy = agents.filter((a) => a.status === 'busy').length;
  const offline = agents.filter((a) => a.status === 'offline' || a.status === 'error').length;

  return (
    <motion.section variants={container} initial="hidden" animate="show" className="runtime-grid" aria-label="Runtime summary">
      <motion.div variants={item} style={{ display: 'contents' }}>
        <NeonCard variant={gateway.status === 'online' ? 'green' : 'red'}>
          <div className="status-card__label">Gateway <SourceBadge source={gateway.source} /></div>
          <div className="status-card__value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`gateway-pulse gateway-pulse--${gateway.status}`} aria-hidden="true" />
            {gateway.status === 'online' ? 'Online' : 'Offline'}
          </div>
          <div className="status-card__sub">{gateway.latency}</div>
        </NeonCard>
      </motion.div>

      <motion.div variants={item} style={{ display: 'contents' }}>
        <NeonCard variant="cyan">
          <div className="status-card__label">Online</div>
          <div className="status-card__value" style={{ color: 'var(--green)' }}>{online}</div>
        </NeonCard>
      </motion.div>

      <motion.div variants={item} style={{ display: 'contents' }}>
        <NeonCard variant="amber" active={busy > 0}>
          <div className="status-card__label">Busy</div>
          <div className="status-card__value" style={{ color: 'var(--amber)' }}>{busy}</div>
        </NeonCard>
      </motion.div>

      <motion.div variants={item} style={{ display: 'contents' }}>
        <NeonCard variant="red" active={offline > 0}>
          <div className="status-card__label">Offline</div>
          <div className="status-card__value" style={{ color: 'var(--red)' }}>{offline}</div>
        </NeonCard>
      </motion.div>

      <motion.div variants={item} style={{ display: 'contents' }}>
        <NeonCard variant="blue">
          <div className="status-card__label">System Health</div>
          <div className="status-card__metrics">
            <span className="metric-chip">CPU {gateway.cpu}</span>
            <span className="metric-chip">RAM {gateway.ram}</span>
            <span className="metric-chip">Queue {gateway.queue}</span>
            <span className="metric-chip">Sessions {gateway.sessions}</span>
          </div>
        </NeonCard>
      </motion.div>
    </motion.section>
  );
}