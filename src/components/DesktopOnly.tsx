/**
 * DesktopOnly — wraps features that require the local FastAPI backend.
 *
 * In static / GitHub Pages mode, renders `fallback` (defaults to a badge).
 * In desktop mode, renders children normally.
 *
 * Usage:
 *   <DesktopOnly>
 *     <GenerateQuestionsButton />
 *   </DesktopOnly>
 *
 *   <DesktopOnly fallback={<span>n/a</span>}>
 *     <ReRunButton />
 *   </DesktopOnly>
 */

import type { ReactNode } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

export function DesktopOnly({ children, fallback }: Props) {
  const { isDesktop } = useApp();
  if (isDesktop) return <>{children}</>;
  return <>{fallback ?? <DesktopOnlyBadge />}</>;
}

export function DesktopOnlyBadge({ label = 'Desktop app required' }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border"
      style={{
        color: 'var(--text-muted)',
        borderColor: 'var(--border)',
        background: 'var(--bg-card)',
        fontFamily: 'var(--font-mono)',
      }}
      title="This feature is only available in the EsoPipe desktop application"
    >
      <MonitorSmartphone size={10} />
      {label}
    </span>
  );
}
