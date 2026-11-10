import Link from 'next/link';
import { Wordmark } from '@/components/Logo';
import BagLink from '@/components/BagLink';

// Header for the shop pages (/bag, /order). The homepages and the
// configurator carry their own navs.
export default function ShopNav() {
  return (
    <header className="shop-nav">
      <Link href="/" className="shop-nav-home" aria-label="Constelier home"><Wordmark /></Link>
      <BagLink />
    </header>
  );
}
