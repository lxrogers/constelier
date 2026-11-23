import type { Metadata } from 'next';
import './admin.css';

// The maker's own panel: quote requests, offers and messages. Never indexed.
export const metadata: Metadata = {
  title: 'CONSTELIER Admin',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin">{children}</div>;
}
