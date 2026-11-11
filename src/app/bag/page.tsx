import type { Metadata } from 'next';
import BagView from './components/BagView';

export const metadata: Metadata = { title: 'Your bag · Constelier' };

export default function BagPage() {
  return <BagView />;
}
