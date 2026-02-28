import { useEffect, useRef, useState } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-typescript';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  lang: string;
  title?: string;
}

export function CodeBlock({ code, lang, title }: CodeBlockProps) {
  const ref = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (ref.current) Prism.highlightElement(ref.current);
  }, [code, lang]);

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const langClass = `language-${lang}`;

  return (
    <div
      className="my-4 overflow-hidden"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        background: 'var(--code-bg)',
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}
      >
        <span
          className="text-xs"
          style={{ color: 'var(--code-text)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}
        >
          {title ?? lang}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-xs px-2 py-1 transition-opacity hover:opacity-80"
          style={{
            background: 'rgba(255,255,255,0.1)',
            color: 'var(--code-text)',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
          aria-label="Copy code"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Code */}
      <div className="overflow-x-auto">
        <pre
          className={`${langClass} m-0 p-4`}
          style={{
            background: 'transparent',
            color: 'var(--code-text)',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            fontFamily: 'var(--font-mono)',
          }}
        >
          <code ref={ref} className={langClass}>
            {code}
          </code>
        </pre>
      </div>
    </div>
  );
}
