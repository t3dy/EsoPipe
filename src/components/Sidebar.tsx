import { NavLink } from 'react-router-dom';
import {
  Home, BookOpen, Table2, CalendarDays, Network, Database, Info,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const NAV = [
  { to: '/',          label: 'Home',      icon: Home },
  { to: '/lessons',   label: 'Lessons',   icon: BookOpen },
  { to: '/tables',    label: 'Tables',    icon: Table2 },
  { to: '/timelines', label: 'Timelines', icon: CalendarDays },
  { to: '/graph',     label: 'Graph',     icon: Network },
  { to: '/schema',    label: 'Schema',    icon: Database },
  { to: '/about',     label: 'About',     icon: Info },
];

export function Sidebar() {
  const { theme } = useTheme();
  const isMac = theme === 'mac80s';

  return (
    <aside
      className="flex flex-col h-full shrink-0"
      style={{
        width: '200px',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Logo / title */}
      <div
        className="px-4 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {isMac && (
          <div className="mac-titlebar mb-2">
            <span>EsoPipe</span>
          </div>
        )}
        <div
          className="font-bold text-sm leading-tight"
          style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}
        >
          EsoPipe
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          CS for Magical Scholarship
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors no-underline ${
                isActive ? 'active-nav' : ''
              }`
            }
            style={({ isActive }) => ({
              color: isActive ? 'var(--primary-text)' : 'var(--text)',
              background: isActive ? 'var(--primary)' : 'transparent',
              fontFamily: 'var(--font-body)',
              textDecoration: 'none',
            })}
            onMouseEnter={e => {
              const el = e.currentTarget;
              if (!el.classList.contains('active-nav')) {
                el.style.background = 'var(--bg-hover)';
              }
            }}
            onMouseLeave={e => {
              const el = e.currentTarget;
              if (!el.classList.contains('active-nav')) {
                el.style.background = 'transparent';
              }
            }}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div
        className="px-4 py-3 text-xs"
        style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}
      >
        v0.1.0-alpha
      </div>
    </aside>
  );
}
