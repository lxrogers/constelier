import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import InView from '@/components/InView';
import CardRail from '@/components/CardRail';
import { ASPECT_TYPES, READING_ORDER } from '@/lib/reading';
import HaloHeader from './components/HaloHeader';
import HaloFooter from './components/HaloFooter';
import StepPanel from './components/StepPanel';
import { CLOSING_IMAGE, DESIGN_PATH, HERO_IMAGE, SKIES, STEPS } from './content';
import './halo.css';

export const metadata: Metadata = { title: 'CONSTELIER · Wear the sky you were born under' };

// Direction E · Halo: warm and soft. Cream page, light serif headlines, a
// floating nav, rounded picture cards, and a dark footer.
export default function Halo() {
  return (
    <div className="halo" id="top">
      <HaloHeader />

      <main>
        <section className="halo-hero">
          <div className="halo-hero-img">
            <Image src={HERO_IMAGE.src} alt={HERO_IMAGE.alt} fill priority sizes="(max-width: 860px) 100vw, 60vw" />
          </div>
          <div className="halo-hero-copy">
            <h1 className="halo-h1 reveal">Wear the sky<br />you were born under</h1>
            <p className="halo-lede reveal" style={{ ['--d' as string]: '100ms' }}>
              Your planets at the minute you arrived, drawn as lines and cast in solid gold.
            </p>
            <Link href={DESIGN_PATH} className="btn reveal" style={{ ['--d' as string]: '200ms' }}>Design yours</Link>
          </div>
        </section>

        <InView as="section" className="halo-sec halo-how">
          <div id="how" className="halo-anchor" />
          <div className="halo-intro">
            <h2 className="halo-h2 rise">Handcrafted in Brooklyn, New York</h2>
            <p className="halo-lede rise" style={{ ['--i' as string]: 1 }}>
              We map your planets, draw every aspect between them as a line, and make the result by hand.
            </p>
          </div>
          <ol className="halo-steps">
            {STEPS.map((s, i) => <StepPanel key={s.label} step={s} index={i} />)}
          </ol>
        </InView>

        <InView as="section" className="halo-sec">
          <div id="skies" className="halo-anchor" />
          <CardRail prefix="halo" title="No two are alike" lede="Because no two skies are. Each of these is a real minute, somewhere.">
            {SKIES.map((s, i) => (
              <li key={s.src} className="halo-card rise" style={{ ['--i' as string]: Math.min(i, 4) }}>
                <div className={`halo-card-img${s.cutout ? ' is-cutout' : ''}`}>
                  <Image src={s.src} alt={`Pendant for a sky on ${s.sky}`} fill sizes="(max-width: 860px) 70vw, 24vw" />
                </div>
                <p className="halo-card-title">{s.sky}</p>
                <p className="halo-card-sub">{s.detail}</p>
              </li>
            ))}
          </CardRail>
        </InView>

        <InView as="section" className="halo-sec">
          <div id="reading" className="halo-anchor" />
          <div className="halo-intro">
            <h2 className="halo-h2 rise">Every line says something</h2>
            <p className="halo-lede rise" style={{ ['--i' as string]: 1 }}>Four kinds of aspect, four kinds of line. Yours are read to you one by one.</p>
          </div>
          <ul className="halo-types">
            {READING_ORDER.map((k, i) => {
              const t = ASPECT_TYPES[k];
              return (
                <li key={k} className="rise" style={{ ['--i' as string]: i + 1 }}>
                  <span className="halo-eyebrow">{t.epithet}</span>
                  <p className="halo-type-quote">{t.intro.split('. ')[0]}.</p>
                  <p className="halo-type-name"><span aria-hidden="true">{t.glyph}</span>{t.name}</p>
                </li>
              );
            })}
          </ul>
        </InView>

        <InView as="section" className="halo-sec">
          <div className="halo-closing rise">
            <Image src={CLOSING_IMAGE.src} alt={CLOSING_IMAGE.alt} fill sizes="100vw" />
            <div className="halo-closing-copy">
              <span className="halo-chip">{CLOSING_IMAGE.caption}</span>
              <h2 className="halo-h2">Your sky is waiting</h2>
              <Link href={DESIGN_PATH} className="btn halo-btn-light">Design yours</Link>
            </div>
          </div>
        </InView>
      </main>

      <HaloFooter />
    </div>
  );
}
