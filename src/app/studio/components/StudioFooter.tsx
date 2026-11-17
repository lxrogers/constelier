import Link from 'next/link';
import { DESIGN_PATH } from '../content';

const COLUMNS = [
  { title: 'Design', links: [{ href: DESIGN_PATH, label: 'Design yours' }, { href: '#skies', label: 'Skies' }, { href: '#reading', label: 'The reading' }] },
  { title: 'Help', links: [{ href: '/legal/shipping', label: 'Shipping' }, { href: '/legal/returns', label: 'Returns and final sale' }, { href: '/legal/warranty', label: 'Warranty and repairs' }] },
  { title: 'Company', links: [{ href: '/legal/terms', label: 'Terms of sale' }, { href: '/legal/privacy', label: 'Privacy' }, { href: '/legal/accessibility', label: 'Accessibility' }] },
];

export default function StudioFooter() {
  return (
    <footer className="stu-foot">
      <div className="stu-foot-cols">
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h3>{c.title}</h3>
            {c.links.map((l) => <Link key={l.label} href={l.href}>{l.label}</Link>)}
          </nav>
        ))}
      </div>
      <p className="stu-foot-legal">© {new Date().getFullYear()} Constelier</p>
    </footer>
  );
}
