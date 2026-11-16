import type { Metadata } from 'next';
import MarksBoard from './MarksBoard';
import './marks.css';

export const metadata: Metadata = { title: 'Marks · CONSTELIER prototype', robots: { index: false, follow: false } };

export default function Page() {
  return <MarksBoard />;
}
