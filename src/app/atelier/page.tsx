import Image from 'next/image';
import type { Metadata } from 'next';
import { Wordmark } from '@/components/Logo';
import InView from '@/components/InView';
import { ASPECT_TYPES, READING_ORDER } from '@/lib/reading';
import NatalChart from '../chart/NatalChart';
import DesignLink from './components/DesignLink';
import './atelier.css';

export const metadata: Metadata = { title: 'Constelier · Wear the sky you were born under' };

const GALLERY = [
  { src: '/renders/pendant-front-1.webp', sky: 'June 21, 1994', time: '2:30 PM', place: 'New York' },
  { src: '/renders/pendant-front-2.webp', sky: 'January 1, 2000', time: '12:00 PM', place: 'Lexington' },
  { src: '/renders/pendant-front-3.webp', sky: 'October 3, 1989', time: '6:10 AM', place: 'Los Angeles' },
];

// The hero is the live chart itself (NatalChart): the same pendant that the
// configurator shapes, so "Design yours" changes the layout around it
// instead of loading another page.
export default function Atelier() {
  return (
    <NatalChart
      home={{
        className: 'theme-root theme-paper atl',
        nav: (
          <header className="atl-nav">
            <a href="#top" className="atl-home" aria-label="Constelier home"><Wordmark /></a>
            <nav className="atl-links" aria-label="Sections">
              <a href="#skies">Skies</a>
              <a href="#process">Process</a>
              <a href="#reading">Reading</a>
            </nav>
            <DesignLink className="btn atl-nav-cta">Design yours</DesignLink>
          </header>
        ),
        hero: (
          <>
            <h1 className="atl-h1">
              <span className="reveal">Wear the sky</span>{' '}
              <span className="reveal" style={{ ['--d' as string]: '80ms' }}>you were</span>{' '}
              <span className="reveal" style={{ ['--d' as string]: '160ms' }}><em>born under.</em></span>
            </h1>
            <p className="atl-lede reveal" style={{ ['--d' as string]: '260ms' }}>
              We map your planets at the minute you arrived, draw every aspect between them as a line, and cast the result in solid gold.
            </p>
            <div className="atl-hero-cta reveal" style={{ ['--d' as string]: '360ms' }}>
              <DesignLink className="btn">Design yours <span className="btn-arrow" aria-hidden="true">&rarr;</span></DesignLink>
            </div>
          </>
        ),
        note: (
          <p className="atl-note reveal" style={{ ['--d' as string]: '1600ms' }}>
            <svg width="70" height="40" viewBox="0 0 70 40" aria-hidden="true"><path d="M2 36 C 20 30, 40 22, 66 4" fill="none" stroke="currentColor" strokeWidth="1" /><path d="M58 4 L66 4 L63 11" fill="none" stroke="currentColor" strokeWidth="1" /></svg>
            <span>every line,<br />an aspect</span>
          </p>
        ),
        below: <Sections />,
      }}
    />
  );
}

function Sections() {
  return (
    <>
      <InView as="section" className="atl-gallery">
        <div id="skies" className="atl-anchor" />
        <div className="atl-sec-head">
          <h2 className="atl-h2 rise">No two are alike, because no two skies are.</h2>
        </div>
        <ul className="atl-gallery-grid">
          {GALLERY.map((g, i) => (
            <li key={g.src} className="rise" style={{ ['--i' as string]: i + 1 }}>
              <div className="atl-gallery-img">
                <Image src={g.src} alt={`Pendant for a sky on ${g.sky}`} width={800} height={800} sizes="(max-width: 768px) 80vw, 30vw" />
              </div>
              <p className="atl-gallery-cap">
                <span>{g.sky}</span>
                <span>{g.time} · {g.place}</span>
              </p>
            </li>
          ))}
        </ul>
      </InView>

      <InView as="section" className="atl-process">
        <div id="process" className="atl-anchor" />
        <div className="atl-sec-head">
          <h2 className="atl-h2 rise">From a minute in time to a piece you keep.</h2>
        </div>
        <ol className="atl-steps">
          <li className="rise" style={{ ['--i' as string]: 1 }}><span>01</span><h3>Map</h3><p>Your date, time and place of birth give the position of every planet.</p></li>
          <li className="rise" style={{ ['--i' as string]: 2 }}><span>02</span><h3>Read</h3><p>Each angle between two planets is an aspect. We read every one with you before anything is drawn in metal.</p></li>
          <li className="rise" style={{ ['--i' as string]: 3 }}><span>03</span><h3>Shape</h3><p>Choose how the gold moves: Liquid, Pebble or Crisp. The lines thicken, meet and close into one form.</p></li>
          <li className="rise" style={{ ['--i' as string]: 4 }}><span>04</span><h3>Cast</h3><p>Cast to order and finished by hand.</p></li>
        </ol>
      </InView>

      <InView as="section" className="atl-reading">
        <div id="reading" className="atl-anchor" />
        <div className="atl-sec-head">
          <h2 className="atl-h2 rise">Every line says something.</h2>
        </div>
        <ul className="atl-types">
          {READING_ORDER.map((k, i) => {
            const t = ASPECT_TYPES[k];
            return (
              <li key={k} className="rise" style={{ ['--i' as string]: i + 1 }}>
                <span className="atl-type-glyph" aria-hidden="true">{t.glyph}</span>
                <h3>{t.name}</h3>
                <span className="atl-type-ep">{t.epithet}</span>
                <p>{t.intro.split('. ')[0]}.</p>
              </li>
            );
          })}
        </ul>
      </InView>

      <InView as="section" className="atl-close">
        <h2 className="atl-close-h rise">Your sky is waiting.</h2>
        <DesignLink className="btn rise" style={{ ['--i' as string]: 1 }}>Design yours <span className="btn-arrow" aria-hidden="true">&rarr;</span></DesignLink>
      </InView>

      <footer className="atl-foot">
        <Wordmark />
        <span>Currently in the studio · Join the waitlist inside</span>
      </footer>
    </>
  );
}
