import Link from 'next/link';
import { Wordmark } from '@/components/Logo';
import BagLink from '@/components/BagLink';
import { DESIGN_PATH } from '../content';

// Three stacked bars: a slim utility row, the brand row, and a section bar
// that stays pinned while the page scrolls.
export default function StudioHeader() {
  return (
    <>
      <div className="stu-util">
        <Link href="/legal/shipping">Shipping</Link>
        <Link href="/legal/returns">Returns</Link>
        <Link href="/legal">Help</Link>
      </div>
      <header className="stu-nav">
        <a href="#top" className="stu-home" aria-label="Constelier home"><Wordmark /></a>
        <nav className="stu-nav-links" aria-label="Sections">
          <a href="#skies">Skies</a>
          <a href="#how">How it works</a>
          <a href="#reading">The reading</a>
        </nav>
        <div className="stu-nav-end"><BagLink /></div>
      </header>
      <p className="stu-promo">Currently in the studio · Join the waitlist inside</p>
      <div className="stu-subnav">
        <span className="stu-subnav-title">Made from your sky</span>
        <Link href={DESIGN_PATH} className="btn stu-subnav-cta">Design yours</Link>
      </div>
    </>
  );
}
