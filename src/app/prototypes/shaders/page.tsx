import type { Metadata } from 'next';
import ShaderLab from './ShaderLab';

export const metadata: Metadata = { title: 'Shader lab · CONSTELIER prototype', robots: { index: false, follow: false } };
export default function Page() { return <ShaderLab />; }
