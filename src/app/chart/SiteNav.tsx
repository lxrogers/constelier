import Link from 'next/link';
import BagLink from '@/components/BagLink';
import { BRAND, LogoMark } from '@/components/Logo';
import './site-nav.css';

// The chart page's own header: logo home and the bag. (The site has no
// global header; each page brings its own.)
// `onHome`: the homepage shows this header over its own design layout, where
// going home is a change of layout rather than a page load.
export default function SiteNav({ onHome }: { onHome?: () => void } = {}) {
  return (
    <nav className="site-nav">
      <Link href="/" className="logo" aria-label="Constelier home" onClick={onHome && ((e) => { e.preventDefault(); onHome(); })}>
        <LogoMark className="logo-icon" size={30} />
        <span className="logo-text">{BRAND}</span>
      </Link>
      <BagLink />
    </nav>
  );
}
