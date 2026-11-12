import type { Metadata } from 'next';
import Link from 'next/link';
import './status-page.css';

export const metadata: Metadata = { title: 'Not found · Constelier' };

export default function NotFound() {
  return (
    <main className="status-page">
      <div className="status-card">
        <p className="status-code">404</p>
        <h1 className="status-title">This page isn't in the stars</h1>
        <p className="status-lead">The link may be old or mistyped. Your chart is still where you left it.</p>
        <Link href="/chart" className="status-btn">Design a pendant</Link>
      </div>
    </main>
  );
}
