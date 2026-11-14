'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LEGAL_PAGES } from '@/components/LegalLinks';

export default function LegalNav() {
  const pathname = usePathname();
  return (
    <nav className="legal-nav" aria-label="Policies">
      {LEGAL_PAGES.map((p) => (
        <Link key={p.href} href={p.href} aria-current={pathname === p.href ? 'page' : undefined}>
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
