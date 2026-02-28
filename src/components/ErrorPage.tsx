import type { ValidationError } from '../types';

interface Props {
  errors: ValidationError[];
}

export function ErrorPage({ errors }: Props) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-8"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <div style={{ maxWidth: '640px', width: '100%' }}>
        <h1
          className="text-2xl font-bold mb-2"
          style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}
        >
          Data Validation Errors
        </h1>
        <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          The following items in your <code>/public/data/</code> JSON files failed schema validation.
          Fix them before the app will load.
        </p>
        <div className="space-y-3">
          {errors.map((err, i) => (
            <div
              key={i}
              className="p-4 text-sm"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius)',
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="shrink-0 text-xs px-2 py-0.5 font-medium"
                  style={{ background: '#fef2f2', color: '#991b1b', borderRadius: '3px' }}
                >
                  {err.file}
                </span>
                <div>
                  {err.id && (
                    <span className="font-medium" style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-mono)' }}>
                      {err.id}{' '}
                    </span>
                  )}
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                    (index {err.index})
                  </span>
                  <p className="mt-1" style={{ color: 'var(--text)' }}>{err.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
