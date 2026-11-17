import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import InView from '@/components/InView';
import { ASPECT_TYPES, READING_ORDER } from '@/lib/reading';
import StudioHeader from './components/StudioHeader';
import StudioFooter from './components/StudioFooter';
import CardRail from '@/components/CardRail';
import Ticker from './components/Ticker';
import { DESIGN_PATH, FEATURES, HERO_IMAGES, SKIES, TICKER } from './content';
import './studio.css';

export const metadata: Metadata = { title: 'CONSTELIER · Wear the sky you were born under' };

// Direction D · Studio: a customise-it storefront. White page, bold sans
// headlines, pill buttons, photography edge to edge, cards in rails.
export default function Studio() {
  return (
    <div className="stu" id="top">
      <StudioHeader />

      <main>
        <section className="stu-hero">
          <div className="stu-hero-media">
            {HERO_IMAGES.map((img, i) => (
              <div key={img.src} className="stu-hero-img">
                <Image src={img.src} alt={img.alt} fill priority sizes="(max-width: 860px) 100vw, 50vw" style={{ objectPosition: img.position }} />
                {i === 0 && <span className="stu-tag">Shown: June 21, 2010 · Sydney</span>}
              </div>
            ))}
          </div>
          <div className="stu-hero-copy">
            <h1 className="stu-h1 reveal">Wear the sky you were born under</h1>
            <p className="stu-body reveal" style={{ ['--d' as string]: '80ms' }}>
              We map your planets at the minute you arrived, draw every aspect between them as a line, and cast the result in solid gold.
            </p>
            <div className="stu-actions reveal" style={{ ['--d' as string]: '160ms' }}>
              <Link href={DESIGN_PATH} className="btn">Design yours</Link>
              <a href="#how" className="btn btn-ghost">How it works</a>
            </div>
          </div>
        </section>

        <InView as="section" className="stu-sec">
          <div id="skies" className="stu-anchor" />
          <CardRail title="No two are alike" lede="Because no two skies are. Each of these is a real minute, somewhere.">
            {SKIES.map((s, i) => (
              <li key={s.src} className="stu-card rise" style={{ ['--i' as string]: Math.min(i, 4) }}>
                <div className={`stu-card-img${s.cutout ? ' is-cutout' : ''}`}>
                  <Image src={s.src} alt={`Pendant for a sky on ${s.sky}`} fill sizes="(max-width: 860px) 78vw, 31vw" />
                </div>
                <p className="stu-card-title">{s.sky}</p>
                <p className="stu-card-sub">{s.detail}</p>
              </li>
            ))}
          </CardRail>
        </InView>

        <InView as="section" className="stu-sec">
          <div id="how" className="stu-anchor" />
          <ul className="stu-features">
            {FEATURES.map((f, i) => (
              <li key={f.title} className="rise" style={{ ['--i' as string]: i }}>
                <div className={`stu-feature-img${f.cutout ? ' is-cutout' : ''}`}>
                  <Image src={f.src} alt={f.alt} fill sizes="(max-width: 860px) 100vw, 50vw" />
                </div>
                <h2 className="stu-h2">{f.title}</h2>
                <p className="stu-body">{f.body}</p>
                <Link href={DESIGN_PATH} className="btn">{f.cta}</Link>
              </li>
            ))}
          </ul>
        </InView>

        <Ticker items={TICKER} />

        <InView as="section" className="stu-sec">
          <div id="reading" className="stu-anchor" />
          <div className="stu-sec-head">
            <h2 className="stu-h2 rise">Every line says something</h2>
            <p className="stu-body rise" style={{ ['--i' as string]: 1 }}>Four kinds of aspect, four kinds of line. Yours are read to you one by one.</p>
          </div>
          <ul className="stu-types">
            {READING_ORDER.map((k, i) => {
              const t = ASPECT_TYPES[k];
              return (
                <li key={k} className="rise" style={{ ['--i' as string]: i + 1 }}>
                  <span className="stu-type-glyph" aria-hidden="true">{t.glyph}</span>
                  <span className="stu-card-sub">{t.epithet}</span>
                  <h3>{t.name}</h3>
                  <p>{t.intro.split('. ')[0]}.</p>
                </li>
              );
            })}
          </ul>
        </InView>

        <InView as="section" className="stu-close">
          <h2 className="stu-h1 rise">Your sky is waiting</h2>
          <Link href={DESIGN_PATH} className="btn rise" style={{ ['--i' as string]: 1 }}>Design yours</Link>
        </InView>
      </main>

      <StudioFooter />
    </div>
  );
}
