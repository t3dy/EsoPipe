import { Palette } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export function ThemeSwitcher() {
  const { theme, setTheme, options } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <Palette size={14} style={{ color: 'var(--text-muted)' }} />
      <select
        value={theme}
        onChange={e => setTheme(e.target.value as typeof theme)}
        className="text-xs py-1 px-2 cursor-pointer focus:outline-none"
        style={{
          background: 'var(--bg-surface)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          fontFamily: 'var(--font-body)',
        }}
        aria-label="Choose theme"
      >
        {options.map(opt => (
          <option key={opt.key} value={opt.key}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
