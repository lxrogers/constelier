import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Wordmark } from '@/components/Logo';
import SkyWheel from '@/components/SkyWheel';
import InView from '@/components/InView';
import CursorGlow from '@/components/CursorGlow';
import { ASPECT_TYPES, READING_ORDER } from '@/lib/reading';
import './nocturne.css';

export const metadata: Metadata = { title: 'Constelier · Your birth chart, cast in gold' };

const CTA = '/chart?theme=night&from=nocturne';

export default function Nocturne() {
  return (
    <div className="theme-root theme-night noc">
      <div className="noc-stars" aria-hidden="true" />
      <CursorGlow />

      <header className="noc-nav">
        <Link href="/nocturne" className="noc-home" aria-label="Constelier home"><Wordmark /></Link>
        <nav className="noc-links" aria-label="Sections">
          <a href="#how">How it works</a>
          <a href="#reading">The reading</a>
          <a href="#object">The pendant</a>
        </nav>
        <Link href={CTA} className="btn noc-nav-cta">Begin</Link>
      </header>

      <section className="noc-hero">
        <div className="noc-hero-copy">
          <p className="eyebrow reveal">Fine jewelry from your natal chart</p>
          <h1 className="noc-h1">
            <span className="reveal" style={{ ['--d' as string]: '80ms' }}>Your birth chart,</span>{' '}
            <span className="reveal noc-h1-em" style={{ ['--d' as string]: '180ms' }}>cast in gold.</span>
          </h1>
          <p className="noc-lede reveal" style={{ ['--d' as string]: '300ms' }}>
            Every line is an aspect between two of your planets, drawn from the sky on the day you were born. No two are alike, because no two skies are.
          </p>
          <div className="noc-hero-cta reveal" style={{ ['--d' as string]: '420ms' }}>
            <Link href={CTA} className="btn">Cast my chart <span className="btn-arrow" aria-hidden="true">&rarr;</span></Link>
            <a href="#how" className="btn btn-ghost">How it works</a>
          </div>
        </div>
        <div className="noc-hero-art">
          <SkyWheel className="noc-hero-wheel" labels glyphs={false} />
          <div className="noc-hero-pendant">
            <Image src="/renders/pendant-front-1.webp" alt="A gold Constelier pendant: a disc of solid gold with flowing openings drawn from a natal chart" width={575} height={575} priority sizes="(max-width: 768px) 82vw, 44vw" />
          </div>
        </div>
        <a href="#how" className="noc-scroll eyebrow" aria-label="Scroll to how it works">Scroll</a>
      </section>

      <InView as="section" className="noc-how" >
        <div id="how" className="noc-anchor" />
        <p className="eyebrow rise">From sky to metal</p>
        <h2 className="noc-h2 rise" style={{ ['--i' as string]: 1 }}>From the sky you were born under to the metal you wear.</h2>
        <ol className="noc-steps">
          <li className="rise" style={{ ['--i' as string]: 2 }}>
            <div className="noc-step-art"><SkyWheel draw={false} labels={false} glyphs size={300} /></div>
            <span className="noc-step-n">01</span>
            <h3>Your sky</h3>
            <p>Tell us when and where you were born. We map every planet at that exact minute.</p>
          </li>
          <li className="rise" style={{ ['--i' as string]: 3 }}>
            <div className="noc-step-art noc-step-lines"><SkyWheel draw={false} labels={false} glyphs={false} size={300} highlight={3} /></div>
            <span className="noc-step-n">02</span>
            <h3>Your reading</h3>
            <p>Each angle between two planets becomes a line. We walk you through what every one of them says.</p>
          </li>
          <li className="rise" style={{ ['--i' as string]: 4 }}>
            <div className="noc-step-art noc-step-gold">
              <Image src="/renders/pendant-front-2.webp" alt="" width={600} height={600} sizes="(max-width: 768px) 60vw, 22vw" />
            </div>
            <span className="noc-step-n">03</span>
            <h3>Your pendant</h3>
            <p>The lines are thickened, joined and poured into gold. Cast to order, finished by hand.</p>
          </li>
        </ol>
      </InView>

      <InView as="section" className="noc-reading">
        <div id="reading" className="noc-anchor" />
        <div className="noc-reading-head">
          <p className="eyebrow rise">The reading</p>
          <h2 className="noc-h2 rise" style={{ ['--i' as string]: 1 }}>Four kinds of conversation.</h2>
          <p className="noc-body rise" style={{ ['--i' as string]: 2 }}>
            Before you choose a finish, we read your chart with you, one line at a time. These are the four voices you will hear.
          </p>
        </div>
        <ul className="noc-types">
          {READING_ORDER.map((k, i) => {
            const t = ASPECT_TYPES[k];
            return (
              <li key={k} className="rise" style={{ ['--i' as string]: i + 2 }}>
                <span className="noc-type-glyph" aria-hidden="true">{t.glyph}</span>
                <span className="eyebrow">{t.epithet} · {t.degrees}°</span>
                <h3>{t.name}</h3>
                <p>{t.intro.split('. ').slice(0, 2).join('. ')}.</p>
              </li>
            );
          })}
        </ul>
      </InView>

      <InView as="section" className="noc-object">
        <div id="object" className="noc-anchor" />
        <div className="noc-object-media rise">
          <Image src="/renders/pendant-angle-1.webp" alt="The pendant at an angle, showing its rounded, poured edges" width={575} height={575} sizes="(max-width: 768px) 100vw, 55vw" />
        </div>
        <div className="noc-object-copy">
          <p className="eyebrow rise">The pendant</p>
          <h2 className="noc-h2 rise" style={{ ['--i' as string]: 1 }}>Solid gold. Exactly yours.</h2>
          <dl className="noc-specs">
            <div className="rise" style={{ ['--i' as string]: 2 }}><dt>Drawn</dt><dd>From your date, time and place of birth</dd></div>
            <div className="rise" style={{ ['--i' as string]: 3 }}><dt>Shaped</dt><dd>Liquid, Pebble or Crisp. You decide how the gold moves.</dd></div>
            <div className="rise" style={{ ['--i' as string]: 4 }}><dt>Made</dt><dd>Cast to order, finished by hand</dd></div>
          </dl>
          <Link href={CTA} className="btn rise" style={{ ['--i' as string]: 5 }}>Design yours <span className="btn-arrow" aria-hidden="true">&rarr;</span></Link>
        </div>
      </InView>

      <InView as="section" className="noc-close">
        <h2 className="noc-close-h rise">Start with the moment you arrived.</h2>
        <Link href={CTA} className="btn rise" style={{ ['--i' as string]: 1 }}>Cast my chart <span className="btn-arrow" aria-hidden="true">&rarr;</span></Link>
      </InView>

      <footer className="noc-foot">
        <Wordmark />
        <span>Currently in the studio. Join the waitlist inside.</span>
      </footer>
    </div>
  );
}
