import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

type LayoutOrder = 'office-first' | 'status-first';

interface Props {
  order: LayoutOrder;
  onChange: (order: LayoutOrder) => void;
}

export function LayoutSwitcher({ order, onChange }: Props) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  if (isMobile) {
    return (
      <div className="layout-switcher-mobile">
        <span className="layout-switcher-label">
          {order === 'office-first' ? 'Office First' : 'Status First'}
        </span>
        <button
          className="layout-switcher-btn-mobile premium-card"
          onClick={() => onChange(order === 'office-first' ? 'status-first' : 'office-first')}
          aria-label="Change Center section order"
          aria-pressed={order === 'office-first'}
          type="button"
        >
          <div className="premium-border-trail" aria-hidden="true" />
          <span style={{ position: 'relative', zIndex: 1, fontSize: '18px' }}>⇅</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="layout-switcher-desktop premium-card"
      role="group"
      aria-label="Change Center section order"
    >
      <div className="premium-border-trail" aria-hidden="true" />
      <button
        className={`switcher-segment ${order === 'office-first' ? 'is-active' : ''}`}
        onClick={() => onChange('office-first')}
        aria-pressed={order === 'office-first'}
        type="button"
      >
        {order === 'office-first' && (
          <motion.div layoutId="switcherPill" className="switcher-pill" transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
        )}
        <span className="switcher-text">Office First</span>
      </button>
      <button
        className={`switcher-segment ${order === 'status-first' ? 'is-active' : ''}`}
        onClick={() => onChange('status-first')}
        aria-pressed={order === 'status-first'}
        type="button"
      >
        {order === 'status-first' && (
          <motion.div layoutId="switcherPill" className="switcher-pill" transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
        )}
        <span className="switcher-text">Status First</span>
      </button>
    </div>
  );
}
