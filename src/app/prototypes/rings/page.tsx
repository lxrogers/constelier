import type { Metadata } from 'next';
import RingPlayground from './RingPlayground';

export const metadata: Metadata = {
  title: 'Ring studio — Constelier',
  description: 'A study in continuous waves. Shape a ring in real time.',
  robots: { index: false, follow: false },
};
export default function RingsPage() { return <RingPlayground />; }
