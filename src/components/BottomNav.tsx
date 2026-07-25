export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {['Center', 'Studio', 'Board', 'Chat', 'Settings'].map((item, index) => (
        <button key={item} className={index === 0 ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'}>
          {item}
        </button>
      ))}
    </nav>
  );
}
