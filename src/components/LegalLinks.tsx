import Link from 'next/link';

export const LEGAL_PAGES = [
  { href: '/legal/terms', label: 'Terms of sale' },
  { href: '/legal/returns', label: 'Returns and final sale' },
  { href: '/legal/shipping', label: 'Shipping' },
  { href: '/legal/warranty', label: 'Warranty and repairs' },
  { href: '/legal/privacy', label: 'Privacy' },
  { href: '/legal/accessibility', label: 'Accessibility' },
];

// A quiet row of policy links for the foot of the bag, order and policy pages.
export default function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <footer className={`legal-links ${className}`}>
      {LEGAL_PAGES.map((p) => <Link key={p.href} href={p.href}>{p.label}</Link>)}
    </footer>
  );
}
