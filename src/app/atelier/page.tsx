import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Wordmark } from '@/components/Logo';
import SkyWheel from '@/components/SkyWheel';
import InView from '@/components/InView';
import { ASPECT_TYPES, READING_ORDER } from '@/lib/reading';
import './atelier.css';

export const metadata: Metadata = { title: 'Constelier · Wear the sky you were born under' };

const CTA = '/chart?theme=paper';

const GALLERY = [
  { src: '/renders/pendant-front-1.webp', sky: 'June 21, 1994', time: '2:30 PM', place: 'New York' },
  { src: '/renders/pendant-front-2.webp', sky: 'January 1, 2000', time: '12:00 PM', place: 'Lexington' },
  { src: '/renders/pendant-front-3.webp', sky: 'October 3, 1989', time: '6:10 AM', place: 'Los Angeles' },
];

export default function Atelier() {
  return (
    <div className="theme-root theme-paper atl">
      <header className="atl-nav">
        <Link href="/" className="atl-home" aria-label="Constelier home"><Wordmark /></Link>
        <nav className="atl-links" aria-label="Sections">
          <a href="#skies">Skies</a>
          <a href="#process">Process</a>
          <a href="#reading">Reading</a>
        </nav>
        <Link href={CTA} className="btn atl-nav-cta">Design yours</Link>
      </header>

      <section className="atl-hero">
        <div className="atl-hero-copy">
          <p className="eyebrow reveal">N° 01 · The natal pendant</p>
          <h1 className="atl-h1">
            <span className="reveal" style={{ ['--d' as string]: '80ms' }}>Wear the sky</span>{' '}
            <span className="reveal" style={{ ['--d' as string]: '160ms' }}>you were</span>{' '}
            <span className="reveal" style={{ ['--d' as string]: '240ms' }}><em>born under.</em></span>
          </h1>
          <p className="atl-lede reveal" style={{ ['--d' as string]: '340ms' }}>
            We map your planets at the minute you arrived, draw every aspect between them as a line, and cast the result in solid gold.
          </p>
          <div className="atl-hero-cta reveal" style={{ ['--d' as string]: '440ms' }}>
            <Link href={CTA} className="btn">Design yours <span className="btn-arrow" aria-hidden="true">&rarr;</span></Link>
          </div>
        </div>

        <figure className="atl-hero-art">
          <SkyWheel className="atl-hero-wheel" />
          <div className="atl-hero-pendant reveal" style={{ ['--d' as string]: '200ms' }}>
            <Image src="/renders/pendant-front-1.webp" alt="A gold Constelier pendant drawn from a natal chart" width={575} height={575} priority sizes="(max-width: 768px) 80vw, 40vw" />
          </div>
          <figcaption className="atl-note reveal" style={{ ['--d' as string]: '900ms' }}>
            <svg width="70" height="40" viewBox="0 0 70 40" aria-hidden="true"><path d="M2 36 C 20 30, 40 22, 66 4" fill="none" stroke="currentColor" strokeWidth="1" /><path d="M58 4 L66 4 L63 11" fill="none" stroke="currentColor" strokeWidth="1" /></svg>
            <span>every line,<br />an aspect</span>
          </figcaption>
          <p className="atl-coords reveal" style={{ ['--d' as string]: '700ms' }}>
            40.7128° N · 74.0060° W · 06.21.1994 · 14:30
          </p>
        </figure>
      </section>

      <InView as="section" className="atl-gallery">
        <div id="skies" className="atl-anchor" />
        <div className="atl-sec-head">
          <p className="eyebrow rise">Three skies</p>
          <h2 className="atl-h2 rise" style={{ ['--i' as string]: 1 }}>No two are alike, because no two skies are.</h2>
        </div>
        <ul className="atl-gallery-grid">
          {GALLERY.map((g, i) => (
            <li key={g.src} className="rise" style={{ ['--i' as string]: i + 2 }}>
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
          <p className="eyebrow rise">Process</p>
          <h2 className="atl-h2 rise" style={{ ['--i' as string]: 1 }}>From a minute in time to a piece you keep.</h2>
        </div>
        <ol className="atl-steps">
          <li className="rise" style={{ ['--i' as string]: 2 }}><span>01</span><h3>Map</h3><p>Your date, time and place of birth give the position of every planet.</p></li>
          <li className="rise" style={{ ['--i' as string]: 3 }}><span>02</span><h3>Read</h3><p>Each angle between two planets is an aspect. We read every one with you before anything is drawn in metal.</p></li>
          <li className="rise" style={{ ['--i' as string]: 4 }}><span>03</span><h3>Shape</h3><p>Choose how the gold moves: Liquid, Pebble or Crisp. The lines thicken, meet and close into one form.</p></li>
          <li className="rise" style={{ ['--i' as string]: 5 }}><span>04</span><h3>Cast</h3><p>Cast to order and finished by hand.</p></li>
        </ol>
      </InView>

      <InView as="section" className="atl-reading">
        <div id="reading" className="atl-anchor" />
        <div className="atl-sec-head">
          <p className="eyebrow rise">The reading</p>
          <h2 className="atl-h2 rise" style={{ ['--i' as string]: 1 }}>Every line says something.</h2>
        </div>
        <ul className="atl-types">
          {READING_ORDER.map((k, i) => {
            const t = ASPECT_TYPES[k];
            return (
              <li key={k} className="rise" style={{ ['--i' as string]: i + 2 }}>
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
        <Link href={CTA} className="btn rise" style={{ ['--i' as string]: 1 }}>Design yours <span className="btn-arrow" aria-hidden="true">&rarr;</span></Link>
      </InView>

      <footer className="atl-foot">
        <Wordmark />
        <span>Currently in the studio · Join the waitlist inside</span>
      </footer>
    </div>
  );
}
