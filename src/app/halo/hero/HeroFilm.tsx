'use client';
import DesignLink from '../components/DesignLink';
import HiddenChartForm from './HiddenChartForm';
import { useHeroFilm } from './useHeroFilm';
import './hero.css';

// The homepage hero: a film of a natal chart being drawn and its pendant
// forming in gold, made live by the real chart engine (see hero-director.ts),
// with the headline over it.
export default function HeroFilm() {
  const { chart, stage, sky, ready } = useHeroFilm();

  return (
    <section className="hero-film">
      <div className={`hero-film-picture${ready ? ' is-ready' : ''}`}>
        <canvas ref={stage} className="hero-film-stage" aria-label="A natal chart being drawn and its pendant forming in gold" />
        <div className="hero-film-fore" aria-hidden="true" />
      </div>
      <div className="hero-film-copy">
        <h1 className="halo-h1 reveal">Your sky,<br />cast in gold</h1>
        <p className="halo-lede reveal" style={{ ['--d' as string]: '100ms' }}>
          Your planets at the minute you arrived, drawn as lines and cast in solid gold.
        </p>
        <DesignLink className="btn reveal" style={{ ['--d' as string]: '200ms' }}>Design yours</DesignLink>
      </div>
      {ready && <p className="hero-film-sky" key={sky.label}>{sky.label}</p>}
      <HiddenChartForm canvasRef={chart} />
    </section>
  );
}
