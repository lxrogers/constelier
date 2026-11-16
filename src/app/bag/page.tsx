import type { Metadata } from 'next';
import BagView from './components/BagView';

export const metadata: Metadata = { title: 'Your bag · CONSTELIER' };

export default function BagPage() {
  return <BagView />;
}
