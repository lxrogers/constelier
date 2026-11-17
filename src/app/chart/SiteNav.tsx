import Link from 'next/link';
import BagLink from '@/components/BagLink';
import { BRAND, LogoMark } from '@/components/Logo';
import './site-nav.css';

// The chart page's own header: logo home and the bag. (The site has no
// global header; each page brings its own.)
export default function SiteNav() {
  return (
    <nav className="site-nav">
      <Link href="/" className="logo" aria-label="Constelier home">
        <LogoMark className="logo-icon" size={30} />
        <span className="logo-text">{BRAND}</span>
      </Link>
      <BagLink />
    </nav>
  );
}
