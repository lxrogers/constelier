import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import {
  Belleza, Comfortaa, Josefin_Sans, Jost, Julius_Sans_One, Lexend_Giga, Manrope, Poiret_One, Quicksand, Raleway, Syne, Tenor_Sans,
} from 'next/font/google';
import { LogoMark } from '@/components/Logo';
import './wordmark.css';

export const metadata: Metadata = { title: 'Sans wordmark · CONSTELIER prototype', robots: { index: false, follow: false } };

// Sans takes on the CONSTELIER wordmark, each set in the real header (star,
// links, button) on paper and on night. Graphik is the site's body face; the
// rest load from Google Fonts on this page only.
const jost = Jost({ subsets: ['latin'], weight: ['400'], variable: '--f-jost' });
const syne = Syne({ subsets: ['latin'], weight: ['600'], variable: '--f-syne' });
const manrope = Manrope({ subsets: ['latin'], weight: ['300'], variable: '--f-manrope' });
const quicksand = Quicksand({ subsets: ['latin'], weight: ['500'], variable: '--f-quicksand' });
const comfortaa = Comfortaa({ subsets: ['latin'], weight: ['400'], variable: '--f-comfortaa' });
const belleza = Belleza({ subsets: ['latin'], weight: ['400'], variable: '--f-belleza' });
const tenor = Tenor_Sans({ subsets: ['latin'], weight: ['400'], variable: '--f-tenor' });
const josefin = Josefin_Sans({ subsets: ['latin'], weight: ['300'], variable: '--f-josefin' });
const raleway = Raleway({ subsets: ['latin'], weight: ['300'], variable: '--f-raleway' });
const lexend = Lexend_Giga({ subsets: ['latin'], weight: ['300'], variable: '--f-lexend' });
const julius = Julius_Sans_One({ subsets: ['latin'], weight: ['400'], variable: '--f-julius' });
const poiret = Poiret_One({ subsets: ['latin'], weight: ['400'], variable: '--f-poiret' });
const FONT_VARS = [jost, syne, manrope, quicksand, comfortaa, belleza, tenor, josefin, raleway, lexend, julius, poiret].map((f) => f.variable).join(' ');

type Option = {
  n: string;
  face: string;
  family: string;
  weight: number;
  size: number; // header px
  track: number; // em
  nudge?: number; // em, drops caps onto the star's center
  kind: string;
  note: string;
  pick?: boolean;
};

const ROUND_2: Option[] = [
  { n: 'D', face: 'Tenor Sans', family: 'var(--f-tenor)', weight: 400, size: 16, track: 0.3, kind: 'Humanist, faint flare', pick: true, note: 'Soft, slightly flared strokes and open curves, like a fashion label’s caps. Calm and expensive, never cold, and it still reads clearly small.' },
  { n: 'E', face: 'Belleza', family: 'var(--f-belleza)', weight: 400, size: 17, track: 0.28, kind: 'Flared, Optima-like', note: 'The closest to Optima: strokes swell toward the ends, so it sits halfway between a serif and a sans. The most classic of the set.' },
  { n: 'F', face: 'Josefin Sans', family: 'var(--f-josefin)', weight: 300, size: 17, track: 0.34, kind: 'Vintage geometric, light', note: 'Light 1920s geometry with low middles on E and S. Art deco mystique, a little nostalgic.' },
  { n: 'G', face: 'Julius Sans One', family: 'var(--f-julius)', weight: 400, size: 16, track: 0.22, kind: 'Wide, thin caps', note: 'Broad, thin capitals made for titles. Airy and celestial; the widest at this size.' },
  { n: 'H', face: 'Manrope', family: 'var(--f-manrope)', weight: 300, size: 15, track: 0.36, kind: 'Soft grotesque, light', note: 'A modern grotesque with softened corners, set light. Gentle and current, like a design studio.' },
  { n: 'I', face: 'Raleway', family: 'var(--f-raleway)', weight: 300, size: 16, track: 0.32, kind: 'Elegant thin sans', note: 'Thin and graceful with a little calligraphic warmth. Pretty, but common on beauty and wellness sites.' },
  { n: 'J', face: 'Lexend Giga', family: 'var(--f-lexend)', weight: 300, size: 13, track: 0.24, kind: 'Extra wide, soft', note: 'Very wide, soft letters. Spacious and calm, and the most unusual silhouette here.' },
  { n: 'K', face: 'Quicksand', family: 'var(--f-quicksand)', weight: 500, size: 16, track: 0.3, kind: 'Rounded terminals', note: 'Rounded stroke ends throughout. Warm and friendly; it starts to lose the edge.' },
  { n: 'L', face: 'Comfortaa', family: 'var(--f-comfortaa)', weight: 400, size: 15, track: 0.28, kind: 'Rounded geometric', note: 'The softest option: round, bubbly geometry. Included to show the far end of soft; reads more app than jewelry.' },
  { n: 'M', face: 'Poiret One', family: 'var(--f-poiret)', weight: 400, size: 18, track: 0.28, kind: 'Art deco hairline', note: 'Hairline deco shapes. Dramatic and theatrical, but too thin to hold up small on a phone.' },
];

const ROUND_1: Option[] = [
  { n: 'A', face: 'Graphik', family: 'var(--sans)', weight: 500, size: 14, track: 0.34, nudge: 0.04, kind: 'Site body face', note: 'Clean and tied to the UI, but plain.' },
  { n: 'B', face: 'Jost', family: 'var(--f-jost)', weight: 400, size: 16, track: 0.36, kind: 'Futura-style geometric', note: 'Round, even geometric caps.' },
  { n: 'C', face: 'Syne', family: 'var(--f-syne)', weight: 600, size: 16, track: 0.16, kind: 'Wide, art-school', note: 'The most edge, and the loudest.' },
];

const NOW: Option = { n: 'Now', face: 'Moulin (serif)', family: 'var(--serif)', weight: 400, size: 19, track: 0.26, nudge: 0.06, kind: 'On the site today', note: '' };

const vars = (o: Option) =>
  ({ '--wm-family': o.family, '--wm-weight': o.weight, '--wm-size': `${o.size}px`, '--wm-track': `${o.track}em`, '--wm-nudge': `${o.nudge ?? 0.02}em` }) as CSSProperties;

function Header({ o, theme }: { o: Option; theme: 'paper' | 'night' }) {
  return (
    <div className={`wm-header wm-${theme}`}>
      <span className="wm-mark" style={vars(o)}>
        <LogoMark className="wm-star" />
        <span className="wm-text">CONSTELIER</span>
      </span>
      <span className="wm-links"><span>Skies</span><span>Process</span><span>Reading</span></span>
      <span className="wm-cta">Design yours</span>
    </div>
  );
}

function Card({ o, compact }: { o: Option; compact?: boolean }) {
  return (
    <li className={`wm-card${o.pick ? ' is-pick' : ''}${compact ? ' is-compact' : ''}`}>
      <div className="wm-card-head">
        <span className="wm-n">{o.n}</span>
        <h2 className="wm-face">{o.face}</h2>
        <span className="wm-spec">{o.kind}</span>
        {o.pick && <span className="wm-pick">My pick</span>}
      </div>
      <Header o={o} theme="paper" />
      <Header o={o} theme="night" />
      {!compact && (
        <div className="wm-specimen" style={vars(o)}>
          <span className="wm-big">CONSTELIER</span>
          <span className="wm-mark wm-foot"><LogoMark className="wm-star" /><span className="wm-text">CONSTELIER</span></span>
        </div>
      )}
      {o.note && <p className="wm-note">{o.note}</p>}
    </li>
  );
}

export default function Page() {
  return (
    <main className={`theme-root theme-paper wm ${FONT_VARS}`}>
      <header className="wm-head">
        <p className="eyebrow">Prototype · Wordmark</p>
        <h1 className="wm-h1">Sans wordmarks</h1>
        <p className="wm-lede">CONSTELIER in thirteen sans faces, each in the real header with the star, on paper and on night. Round two (D to M) goes softer and wider: flared, humanist, rounded, light and extra-wide. Round one and the serif on the site today are below.</p>
      </header>

      <section className="wm-section">
        <p className="eyebrow">Round two · softer and broader</p>
        <ol className="wm-list">{ROUND_2.map((o) => <Card key={o.n} o={o} />)}</ol>
      </section>

      <section className="wm-section">
        <p className="eyebrow">Round one · too sharp</p>
        <ol className="wm-list">{ROUND_1.map((o) => <Card key={o.n} o={o} compact />)}</ol>
      </section>

      <section className="wm-section">
        <p className="eyebrow">On the site today</p>
        <ol className="wm-list"><Card o={NOW} compact /></ol>
      </section>
    </main>
  );
}
