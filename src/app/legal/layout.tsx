import type { Metadata } from 'next';
import LegalLinks from '@/components/LegalLinks';
import ShopNav from '@/components/ShopNav';
import DraftBanner from './components/DraftBanner';
import LegalNav from './components/LegalNav';
import { LEGAL_DRAFT } from './policy';
import './legal.css';

export const metadata: Metadata = {
  title: { template: '%s · Constelier', default: 'Policies · Constelier' },
  // Drafts stay out of search results until LEGAL_DRAFT is false.
  robots: LEGAL_DRAFT ? { index: false, follow: true } : undefined,
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-root theme-paper shop-shell">
    <ShopNav />
    <main className="legal-page">
      <div className="legal-card">
        <DraftBanner />
        <LegalNav />
        {children}
      </div>
      <LegalLinks className="legal-links-page" />
    </main>
    </div>
  );
}
