import type { ConnectionState } from '../../types';
import { motion } from 'framer-motion';

interface Props { connectionState: ConnectionState; }
const connectionLabels: Record<ConnectionState, string> = { connected: 'Connected', degraded: 'Degraded', offline: 'Offline', reconnecting: 'Reconnecting' };

export function CommandCenterHeader({ connectionState }: Props) {
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
            {connectionLabels[connectionState]}
          </motion.span>
        </div>
      </div>
      <div className="app-header__actions">
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