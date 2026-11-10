import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Wordmark } from '@/components/Logo';
import SkyWheel from '@/components/SkyWheel';
import InView from '@/components/InView';
import CursorGlow from '@/components/CursorGlow';
import BirthTeaser from './BirthTeaser';
import { ASPECT_TYPES, READING_ORDER } from '@/lib/reading';
import './eclipse.css';

export const metadata: Metadata = { title: 'Constelier · The stars had opinions about you' };

const CTA = '/chart?theme=mono&from=eclipse';

const ONE_LINERS: Record<string, string> = {
  opposition: 'A tug of war you were born holding both ends of.',
  square: 'The itch you keep scratching. Also, the reason you got good.',
  trine: 'Gifts you never worked for, which is why you forget you have them.',
  sextile: 'A door left slightly open. Walk through it.',
};

export default function Eclipse() {
  return (
    <div className="theme-root theme-mono ecl">
      <CursorGlow />
      <header className="ecl-nav">
        <Link href="/eclipse" className="ecl-home" aria-label="Constelier home"><Wordmark /></Link>
        <Link href={CTA} className="ecl-nav-link">Begin &rarr;</Link>
      </header>

      <section className="ecl-hero">
        <div className="ecl-hero-art" aria-hidden="true">
          <SkyWheel className="ecl-wheel" />
          <div className="ecl-hero-pendant">
            <Image src="/renders/pendant-front-1.webp" alt="" width={575} height={575} priority sizes="(max-width: 768px) 70vw, 34vw" />
          </div>
        </div>
        <div className="ecl-hero-copy">
          <p className="eyebrow reveal">Natal jewelry · Solid gold</p>
          <h1 className="ecl-h1">
            <span className="reveal" style={{ ['--d' as string]: '100ms' }}>The stars had</span>{' '}
            <span className="reveal" style={{ ['--d' as string]: '200ms' }}>opinions about you.</span>
          </h1>
          <p className="ecl-sub reveal" style={{ ['--d' as string]: '320ms' }}>Wear them.</p>
          <div className="reveal" style={{ ['--d' as string]: '440ms' }}>
            <BirthTeaser />
          </div>
        </div>
      </section>

      <InView as="section" className="ecl-is">
        <div className="ecl-is-col rise">
          <p className="eyebrow">What it is</p>
          <p className="ecl-big">A gold pendant drawn from your natal chart. Every line is an aspect between two of your planets, at the minute you were born.</p>
        </div>
        <div className="ecl-is-col rise" style={{ ['--i' as string]: 1 }}>
          <p className="eyebrow">What it isn&apos;t</p>
          <p className="ecl-big ecl-dim">A zodiac necklace. Everyone born in late July gets the same lion. Nobody else gets your lines.</p>
        </div>
      </InView>

      <InView as="section" className="ecl-types">
        <p className="eyebrow rise">Four kinds of line</p>
        <ul>
          {READING_ORDER.map((k, i) => {
            const t = ASPECT_TYPES[k];
            return (
              <li key={k} className="rise" style={{ ['--i' as string]: i + 1 }}>
                <span className="ecl-type-g" aria-hidden="true">{t.glyph}</span>
                <span className="ecl-type-n">{t.plural}</span>
                <span className="ecl-type-d">{ONE_LINERS[k]}</span>
              </li>
            );
          })}
        </ul>
        <p className="ecl-types-foot rise" style={{ ['--i' as string]: 6 }}>Your reading walks through every one of yours before anything is cast.</p>
      </InView>

      <InView as="section" className="ecl-object">
        <div className="ecl-object-media rise">
          <Image src="/renders/pendant-angle-1.webp" alt="The pendant at an angle, showing its rounded, poured edges" width={575} height={575} sizes="(max-width: 768px) 100vw, 60vw" />
        </div>
        <ul className="ecl-facts">
          <li className="rise" style={{ ['--i' as string]: 1 }}><span>01</span>Drawn from your exact minute</li>
          <li className="rise" style={{ ['--i' as string]: 2 }}><span>02</span>Liquid, Pebble or Crisp</li>
          <li className="rise" style={{ ['--i' as string]: 3 }}><span>03</span>Cast to order, finished by hand</li>
        </ul>
      </InView>

      <InView as="section" className="ecl-close">
        <h2 className="ecl-close-h rise">Mercury retrograde not included.</h2>
        <Link href={CTA} className="btn rise" style={{ ['--i' as string]: 1 }}>Read my sky <span className="btn-arrow" aria-hidden="true">&rarr;</span></Link>
      </InView>

      <footer className="ecl-foot">
        <Wordmark />
        <span>In the studio. Waitlist open.</span>
      </footer>
    </div>
  );
}
