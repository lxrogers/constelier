'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/report-client-error';

// Last resort when the root layout itself fails, so it carries its own styles.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportClientError(error); }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#f5f0e6', color: '#3a3630', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>Constelier hit a snag</h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: '#5a5548', marginBottom: 16 }}>It's been reported. Please try again.</p>
          <button onClick={reset} style={{ padding: '10px 16px', background: '#2c2c2c', color: 'white', border: 0, borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
