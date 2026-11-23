import { Wordmark } from '@/components/Logo';
import BagLink from '@/components/BagLink';
import DesignLink from './DesignLink';

// A plain full-width bar that stays pinned to the top of the page.
export default function HaloHeader() {
  return (
    <header className="halo-nav">
      <a href="#top" className="halo-home" aria-label="Constelier home"><Wordmark /></a>
      <div className="halo-nav-end">
        <BagLink />
        <DesignLink className="btn halo-nav-cta">Design yours</DesignLink>
      </div>
    </header>
  );
}
