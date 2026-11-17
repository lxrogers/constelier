import type { Metadata } from 'next';
import ShopNav from '@/components/ShopNav';

// A pendant page is private to the person it was made for.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PendantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-root theme-paper shop-shell pdp-shell">
      <ShopNav />
      {children}
    </div>
  );
}
