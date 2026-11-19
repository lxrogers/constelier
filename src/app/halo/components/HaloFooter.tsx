import Link from 'next/link';
import { Wordmark } from '@/components/Logo';
import { DESIGN_PATH } from '../content';
import DesignLink from './DesignLink';

const COLUMNS = [
  { title: 'Design', links: [{ href: DESIGN_PATH, label: 'Design yours' }, { href: '#how', label: 'How it works' }, { href: '#reading', label: 'The reading' }] },
  { title: 'Support', links: [{ href: '/legal/shipping', label: 'Shipping' }, { href: '/legal/returns', label: 'Returns and final sale' }, { href: '/legal/warranty', label: 'Warranty and repairs' }] },
  { title: 'Company', links: [{ href: '/legal/terms', label: 'Terms of sale' }, { href: '/legal/privacy', label: 'Privacy' }, { href: '/legal/accessibility', label: 'Accessibility' }] },
];

export default function HaloFooter() {
  return (
    <footer className="halo-foot">
      <div className="halo-foot-top">
        <div className="halo-foot-lead">
          <Wordmark />
          <p className="halo-foot-line">Wear the sky you were born under.</p>
          <DesignLink className="btn halo-btn-light">Design yours</DesignLink>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h3>{c.title}</h3>
            {c.links.map((l) => l.href === DESIGN_PATH
              ? <DesignLink key={l.label}>{l.label}</DesignLink>
              : <Link key={l.label} href={l.href}>{l.label}</Link>)}
          </nav>
        ))}
      </div>
      <p className="halo-foot-legal">© {new Date().getFullYear()} Constelier</p>
    </footer>
  );
}
