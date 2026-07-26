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

export function BottomNavigation({ activePage, onNavigate }: Props) {
  return (
    <nav className="bottom-nav premium-bottom-nav" aria-label="Mobile navigation">
      {navItems.map((item) => {
        const isActive = activePage === item.id;
        return (
          <button key={item.id} className={`premium-bottom-nav__item ${isActive ? 'is-active' : ''}`} onClick={() => onNavigate(item.id)} aria-current={isActive ? 'page' : undefined}>
            {isActive && <motion.div layoutId="bottomNavPill" className="premium-bottom-nav__indicator" transition={{ type: 'spring', stiffness: 500, damping: 30 }} />}
            <motion.span whileTap={{ scale: 0.9 }} className="premium-bottom-nav__icon">{item.icon}</motion.span>
            <span className="premium-bottom-nav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}