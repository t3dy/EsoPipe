import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Drawer } from './Drawer';
import { SearchBox } from './SearchBox';
import { ThemeSwitcher } from './ThemeSwitcher';
import { ReadingTrail } from './ReadingTrail';
import { useApp } from '../contexts/AppContext';

function ValidationBanner() {
  const { errors } = useApp();
  if (errors.length === 0) return null;
  return (
    <div
      className="px-4 py-2 text-sm"
      style={
        {
          background: '#fef2f2',
          borderBottom: '1px solid #fecaca',
          color: '#991b1b',
          fontFamily: 'var(--font-mono)',
        }
      }
    >
      ⚠ {errors.length} validation error{errors.length > 1 ? 's' : ''} in data files.{' '}
      <a href="#/schema" style={{ color: '#991b1b', textDecoration: 'underline' }}>
        See Schema page for details.
      </a>
    </div>
  );
}

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden th-bg">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className="flex items-center gap-4 px-5 py-2.5 shrink-0"
          style={
            {
              background: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border)',
              minHeight: '52px',
            }
          }
        >
          <div className="flex-1">
            <SearchBox />
          </div>
          <ThemeSwitcher />
        </header>

        <ValidationBanner />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Reading trail — collapsible bottom strip */}
        <ReadingTrail />
      </div>

      <Drawer />
    </div>
  );
}
