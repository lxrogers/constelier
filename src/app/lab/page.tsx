import type { Metadata } from 'next';
import LabPage from './LabPage';

export const metadata: Metadata = { title: 'CONSTELIER Lab', robots: { index: false, follow: false } };

export default function Lab() {
  return <LabPage />;
}
