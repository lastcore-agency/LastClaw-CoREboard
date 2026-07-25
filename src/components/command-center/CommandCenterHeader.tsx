import type { ConnectionState } from '../../types';

interface Props {
  connectionState: ConnectionState;
}

const connectionLabels: Record<ConnectionState, string> = {
  connected: 'Connected',
  degraded: 'Degraded',
  offline: 'Offline',
  reconnecting: 'Reconnecting',
};

export function CommandCenterHeader({ connectionState }: Props) {
  return (
    <header className="app-header" role="banner">
      <div className="app-header__left">
        <img
          src="/logo/logo.png"
          alt="LastClaw-CoREboard logo"
          className="app-header__logo"
          width={36}
          height={36}
        />
        <div className="app-header__title-group">
          <h1 className="app-title">
            <span className="app-title__main">LastClaw-CoREboard</span>{' '}
            <span className="app-title__sub">Command Center</span>
          </h1>
          <span className={`connection-badge connection-badge--${connectionState}`}>
            <span className="connection-dot" aria-hidden="true" />
            {connectionLabels[connectionState]}
          </span>
        </div>
      </div>
      <div className="app-header__actions">
        <button
          className="icon-btn"
          aria-label="Notifications"
          title="Notifications"
          type="button"
        >
          🔔
          <span className="notification-dot" aria-hidden="true" />
        </button>
        <button
          className="icon-btn"
          aria-label="User profile"
          title="Profile"
          type="button"
        >
          👤
        </button>
      </div>
    </header>
  );
}
