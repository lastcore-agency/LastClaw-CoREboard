import type { GatewaySnapshot, NavPage } from '../../types';
import { motion } from 'framer-motion';
import { LayoutSwitcher } from './LayoutSwitcher';

type LayoutOrder = 'office-first' | 'status-first';

interface Props {
  gateway?: GatewaySnapshot | null;
  activePage: NavPage;
  layoutOrder: LayoutOrder;
  onLayoutChange: (order: LayoutOrder) => void;
}

export function CommandCenterHeader({ gateway, activePage, layoutOrder, onLayoutChange }: Props) {
  let connectionState = 'offline';
  let connectionLabel = 'OFFLINE';
  
  if (gateway) {
    if (gateway.source === 'LIVE' && gateway.status === 'online') {
      connectionState = 'connected';
      connectionLabel = 'CONNECTED';
    } else if (gateway.source === 'CACHED') {
      connectionState = 'cached';
      connectionLabel = 'CACHED';
    } else if (gateway.source === 'FALLBACK') {
      connectionState = 'degraded';
      connectionLabel = 'DEGRADED';
    }
  }

  return (
    <header className="app-header" role="banner">
      <div className="app-header__left">
        <motion.img
          src="/logo/logo.png"
          alt="LastClaw-CoREboard logo"
          className="app-header__logo"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        <div className="app-header__title-group">
          <motion.span 
            className={`connection-badge connection-badge--${connectionState}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <span className="connection-dot" aria-hidden="true" />
            {connectionLabel}
          </motion.span>
        </div>
      </div>
      <div className="app-header__actions">
        {activePage === 'center' && (
          <LayoutSwitcher order={layoutOrder} onChange={onLayoutChange} />
        )}
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="icon-btn" aria-label="Notifications" type="button">
          🔔<span className="notification-dot" aria-hidden="true" />
        </motion.button>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="icon-btn" aria-label="User profile" type="button">
          👤
        </motion.button>
      </div>
    </header>
  );
}