import Image from 'next/image';
import type { Metadata } from 'next';
import { Wordmark } from '@/components/Logo';
import InView from '@/components/InView';
import { ASPECT_TYPES, READING_ORDER } from '@/lib/reading';
import NatalChart from '../chart/NatalChart';
import DesignLink from './components/DesignLink';
import './atelier.css';

export const metadata: Metadata = { title: 'CONSTELIER · The Aspect Pendant' };

// Blender renders (tools/blender), grey studio scene. Fill in each
// pendant's birth date, time and place to show its caption on the photo.
const GALLERY: { src: string; sky?: string; time?: string; place?: string }[] = [
  { src: '/renders/studio-1.webp' },
  { src: '/renders/studio-2.webp' },
  { src: '/renders/studio-3.webp' },
  { src: '/renders/studio-4.webp' },
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
              <a href="#skies">Pendants</a>
              <a href="#process">Process</a>
              <a href="#reading">Reading</a>
            </nav>
            <DesignLink className="btn atl-nav-cta">Design yours</DesignLink>
          </header>
        ),
        hero: (
          <>
            <h1 className="atl-h1">
              <span className="reveal">The Aspect</span>{' '}
              <span className="reveal" style={{ ['--d' as string]: '80ms' }}>Pendant</span>
            </h1>
            <p className="atl-lede reveal" style={{ ['--d' as string]: '180ms' }}>
              A one-of-one pendant made from your natal chart. Enter your birth date, time and place, and the lines between your planets become the design. Cast to order in solid gold.
            </p>
            <div className="atl-hero-cta reveal" style={{ ['--d' as string]: '280ms' }}>
              <DesignLink className="btn">Design yours <span className="btn-arrow" aria-hidden="true">&rarr;</span></DesignLink>
            </div>
          </>
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
        <p className="eyebrow rise">Examples</p>
        <ul className="atl-gallery-grid">
          {GALLERY.map((g, i) => (
            <li key={g.src} className="rise" style={{ ['--i' as string]: i + 1 }}>
              <figure className="atl-gallery-img">
                <Image src={g.src} alt={g.sky ? `Gold pendant drawn from a sky on ${g.sky} in ${g.place}` : 'Gold pendant drawn from a natal chart'} width={1600} height={2000} sizes="(max-width: 768px) 70vw, (max-width: 1100px) 45vw, 23vw" />
                {g.sky && (
                  <figcaption className="atl-gallery-cap">
                    <span>{g.sky}</span>
                    <span>{g.time} · {g.place}</span>
                  </figcaption>
                )}
              </figure>
            </li>
          ))}
        </ul>
      </InView>

      <InView as="section" className="atl-process">
        <div id="process" className="atl-anchor" />
        <div className="atl-sec-head">
          <h2 className="atl-h2 rise">How it&rsquo;s made</h2>
        </div>
        <ol className="atl-steps">
          <li className="rise" style={{ ['--i' as string]: 1 }}><span>01</span><h3>Map</h3><p>Your date, time and place of birth give the position of every planet.</p></li>
          <li className="rise" style={{ ['--i' as string]: 2 }}><span>02</span><h3>Read</h3><p>Each angle between two planets is an aspect. You read each one before the pendant is drawn.</p></li>
          <li className="rise" style={{ ['--i' as string]: 3 }}><span>03</span><h3>Shape</h3><p>Choose a style: Liquid, Pebble or Crisp. The lines thicken and join into one piece.</p></li>
          <li className="rise" style={{ ['--i' as string]: 4 }}><span>04</span><h3>Cast</h3><p>Cast to order and finished by hand.</p></li>
        </ol>
      </InView>

      <InView as="section" className="atl-reading">
        <div id="reading" className="atl-anchor" />
        <div className="atl-sec-head">
          <h2 className="atl-h2 rise">What the lines mean</h2>
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
        <h2 className="atl-close-h rise">See your own chart.</h2>
        <DesignLink className="btn rise" style={{ ['--i' as string]: 1 }}>Design yours <span className="btn-arrow" aria-hidden="true">&rarr;</span></DesignLink>
      </InView>

      <footer className="atl-foot">
        <Wordmark />
        <span>Currently in the studio · Join the waitlist inside</span>
      </footer>
    </>
  );
}
