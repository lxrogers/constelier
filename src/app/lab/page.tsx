import type { Metadata } from 'next';
import LabPage from './LabPage';

export const metadata: Metadata = { title: 'Constelier Lab', robots: { index: false, follow: false } };

export default function Lab() {
  return <LabPage />;
}
