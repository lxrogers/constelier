'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { reportClientError } from '@/lib/report-client-error';
import './status-page.css';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportClientError(error); }, [error]);
  return (
    <main className="status-page">
      <div className="status-card">
        <p className="status-code">Something broke</p>
        <h1 className="status-title">We hit a snag drawing this page</h1>
        <p className="status-lead">It's been reported. Try again, and if it keeps happening, start over from the chart.</p>
        <div className="status-actions">
          <button className="status-btn" onClick={reset}>Try again</button>
          <Link href="/chart" className="status-btn status-btn-quiet">Back to the chart</Link>
        </div>
      </div>
    </main>
  );
}
