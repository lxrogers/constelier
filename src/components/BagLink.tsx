'use client';

import Link from 'next/link';
import { useBag } from '@/hooks/useBag';

export default function BagLink() {
  const { count } = useBag();
  if (process.env.NEXT_PUBLIC_SHOP_ENABLED !== 'true') return null;
  return (
    <Link href="/bag" className="nav-bag" aria-label={`Bag, ${count} item${count === 1 ? '' : 's'}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M5 8h14l-1 12H6L5 8Z" strokeLinejoin="round" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
      <span>Bag</span>
      {count > 0 && <span className="nav-bag-count">{count}</span>}
    </Link>
  );
}
