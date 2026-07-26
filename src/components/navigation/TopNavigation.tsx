import { motion } from 'framer-motion';
import type { NavPage } from '../../types';

interface Props { activePage: NavPage; onNavigate: (page: NavPage) => void; }
const navItems: { id: NavPage; label: string; icon: string }[] = [
  { id: 'center', label: 'Center', icon: '🏠' },
  { id: 'studio', label: 'Studio', icon: '⟨/⟩' },
  { id: 'board', label: 'Board', icon: '📋' },
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export function TopNavigation({ activePage, onNavigate }: Props) {
  return (
    <nav className="top-nav premium-nav" aria-label="Main navigation">
      {navItems.map((item) => {
        const isActive = activePage === item.id;
        return (
          <button key={item.id} className={`premium-nav__item ${isActive ? 'is-active' : ''}`} onClick={() => onNavigate(item.id)} aria-current={isActive ? 'page' : undefined}>
            {isActive && <motion.div layoutId="topNavPill" className="premium-nav__pill" transition={{ type: 'spring', stiffness: 500, damping: 30 }} />}
            <span className="premium-nav__content">
              <span className="premium-nav__icon">{item.icon}</span>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}