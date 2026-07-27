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
  // Only count known SiX-SQUAD canonical agents for team totals
  const knownIds = ['sirius', 'draco', 'capella', 'antares', 'polaris', 'altair'];
  const teamAgents = agents.filter((a) => knownIds.includes(a.id));
  
  const activeCount = teamAgents.filter((a) => ['online', 'working', 'busy', 'waiting'].includes(a.status)).length;
  const busyCount = teamAgents.filter((a) => a.status === 'busy').length;
  const offlineCount = teamAgents.filter((a) => ['offline', 'error'].includes(a.status)).length;

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
          <div className="status-card__label">{teamAgents.length} Agents</div>
          <div className="status-card__value" style={{ color: 'var(--green)', display: 'flex', alignItems: 'baseline', gap: 6 }}>
            {activeCount}
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--cyan)' }}>Active</span>
          </div>
        </NeonCard>
      </motion.div>

      <motion.div variants={item} style={{ display: 'contents' }}>
        <NeonCard variant="amber" active={busyCount > 0}>
          <div className="status-card__label">Busy</div>
          <div className="status-card__value" style={{ color: 'var(--amber)' }}>{busyCount}</div>
        </NeonCard>
      </motion.div>

      <motion.div variants={item} style={{ display: 'contents' }}>
        <NeonCard variant="red" active={offlineCount > 0}>
          <div className="status-card__label">Offline</div>
          <div className="status-card__value" style={{ color: 'var(--red)' }}>{offlineCount}</div>
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