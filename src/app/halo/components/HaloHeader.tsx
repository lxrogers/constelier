import { Wordmark } from '@/components/Logo';
import BagLink from '@/components/BagLink';
import DesignLink from './DesignLink';

// A plain full-width bar that stays pinned to the top of the page.
export default function HaloHeader() {
  return (
    <header className="halo-nav">
      <a href="#top" className="halo-home" aria-label="Constelier home"><Wordmark /></a>
      <nav className="halo-nav-links" aria-label="Sections">
        <a href="#how">How it works</a>
        <a href="#skies">Skies</a>
        <a href="#reading">The reading</a>
      </nav>
      <div className="halo-nav-end">
        <BagLink />
        <DesignLink className="btn halo-nav-cta">Design yours</DesignLink>
      </div>
    </header>
  );
}
