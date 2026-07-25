import type { NavPage } from '../../types';

interface Props {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
}

const pages: { id: NavPage; label: string; icon: string }[] = [
  { id: 'center',   label: 'Center',   icon: '🏠' },
  { id: 'studio',   label: 'Studio',   icon: '⟨/⟩' },
  { id: 'board',    label: 'Board',    icon: '📋' },
  { id: 'chat',     label: 'Chat',     icon: '💬' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export function TopNavigation({ activePage, onNavigate }: Props) {
  return (
    <nav className="top-nav" aria-label="Main navigation">
      {pages.map((page) => (
        <button
          key={page.id}
          className={`top-nav__item ${activePage === page.id ? 'top-nav__item--active' : ''}`}
          onClick={() => onNavigate(page.id)}
          aria-current={activePage === page.id ? 'page' : undefined}
          type="button"
        >
          <span className="top-nav__icon" aria-hidden="true">{page.icon}</span>
          {page.label}
        </button>
      ))}
    </nav>
  );
}
