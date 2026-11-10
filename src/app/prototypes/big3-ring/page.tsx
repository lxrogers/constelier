import type { Metadata } from 'next';
import Big3Ring from './Big3Ring';

export const metadata: Metadata = {
  title: 'Big Three Ring (prototype) | Constelier',
  robots: { index: false },
};

export default function Big3RingPage() {
  return <Big3Ring />;
}
