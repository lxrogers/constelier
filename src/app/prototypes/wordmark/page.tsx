import type { Metadata } from 'next';
import { Jost, Syne } from 'next/font/google';
import { LogoMark } from '@/components/Logo';
import './wordmark.css';

export const metadata: Metadata = { title: 'Sans wordmark · CONSTELIER prototype', robots: { index: false, follow: false } };

// Three sans takes on the CONSTELIER wordmark, each set in the real header
// (star, links, button) on paper and on night. Graphik is already the site's
// body face; Jost and Syne load only on this page.
const jost = Jost({ subsets: ['latin'], weight: ['400', '500'], display: 'swap', variable: '--f-jost' });
const syne = Syne({ subsets: ['latin'], weight: ['500', '600', '700'], display: 'swap', variable: '--f-syne' });

type Option = { id: string; n: string; face: string; spec: string; note: string; pick?: boolean };

const OPTIONS: Option[] = [
  { id: 'graphik', n: 'A', face: 'Graphik', spec: 'Medium, 0.34em tracking', note: 'The site’s own body face, widely spaced. Crisp and calm like Linear or Stripe, and it ties the mark to the UI, but it has the least character of the three.' },
  { id: 'jost', n: 'B', face: 'Jost', spec: 'Regular, 0.36em tracking', pick: true, note: 'A Futura-style geometric with perfectly round Os and a light, even stroke. Reads like a quiet fashion house: mysterious and expensive without the stuffy serif.' },
  { id: 'syne', n: 'C', face: 'Syne', spec: 'SemiBold, 0.16em tracking', note: 'Wide, slightly odd letterforms from an art-school foundry. The most edge and the most Gen Z, but it pulls attention from the pendant.' },
];

function Header({ id, theme }: { id: string; theme: 'paper' | 'night' }) {
  return (
    <div className={`wm-header wm-${theme}`}>
      <span className={`wm-mark wm-${id}`}>
        <LogoMark className="wm-star" />
        <span className="wm-text">CONSTELIER</span>
      </span>
      <span className="wm-links"><span>Skies</span><span>Process</span><span>Reading</span></span>
      <span className="wm-cta">Design yours</span>
    </div>
  );
}

export default function Page() {
  return (
    <main className={`theme-root theme-paper wm ${jost.variable} ${syne.variable}`}>
      <header className="wm-head">
        <p className="eyebrow">Prototype · Wordmark</p>
        <h1 className="wm-h1">Three sans wordmarks</h1>
        <p className="wm-lede">CONSTELIER set in three sans faces, in the real header with the star, on paper and on night. The serif version on the site now is at the bottom for comparison.</p>
      </header>

      <ol className="wm-list">
        {OPTIONS.map((o) => (
          <li key={o.id} className={`wm-card${o.pick ? ' is-pick' : ''}`}>
            <div className="wm-card-head">
              <span className="wm-n">{o.n}</span>
              <h2 className="wm-face">{o.face}</h2>
              <span className="wm-spec">{o.spec}</span>
              {o.pick && <span className="wm-pick">My pick</span>}
            </div>
            <Header id={o.id} theme="paper" />
            <Header id={o.id} theme="night" />
            <div className="wm-specimen">
              <span className={`wm-big wm-${o.id}`}>CONSTELIER</span>
              <span className={`wm-mark wm-${o.id} wm-foot`}><LogoMark className="wm-star" /><span className="wm-text">CONSTELIER</span></span>
            </div>
            <p className="wm-note">{o.note}</p>
          </li>
        ))}
        <li className="wm-card is-ref">
          <div className="wm-card-head">
            <span className="wm-n">Now</span>
            <h2 className="wm-face">Moulin (serif)</h2>
            <span className="wm-spec">Regular, 0.26em tracking</span>
          </div>
          <Header id="moulin" theme="paper" />
          <Header id="moulin" theme="night" />
        </li>
      </ol>
    </main>
  );
}
