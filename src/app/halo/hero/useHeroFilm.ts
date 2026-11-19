'use client';
import { useEffect, useRef, useState } from 'react';
import { PENDANT_DEFAULTS } from '@/config/pendant-params';
import type { ChartEngine } from '@/app/chart/chart-engine';
import { HERO_SKIES, type HeroDirector, type Sky } from './hero-director';

// Phones and tablets: a smaller chart drawing and fewer pixels to shade (see
// HeroDirector), since the film keeps the canvas moving the whole time.
const LIGHT = '(max-width: 860px), (pointer: coarse)';
const LIGHT_CHART_PX = 1000;   // the 2D chart's size on those, down from 1400; it is sent to the GPU every frame

// Runs the chart engine on a hidden 2D canvas and a visible 3D one, and hands
// both to the director that films them. Returns the refs to mount them on,
// the sky now showing, and whether the first frame has been drawn.
export function useHeroFilm() {
  const chart = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLCanvasElement>(null);
  const [sky, setSky] = useState<Sky>(HERO_SKIES[0]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let gone = false, engine: ChartEngine | null = null, director: HeroDirector | null = null;
    (async () => {
      const query = new URLSearchParams(window.location.search), dev = process.env.NODE_ENV !== 'production';
      // Dev only. /?bake=1: instead of playing, save the 2D chart's animation as frames for the Blender film.
      if (dev && query.has('bake')) {
        const { installBakeClock, bakeChart } = await import('./bake-chart');
        const clock = installBakeClock();
        const { initChartEngine } = await import('@/app/chart/chart-engine');
        if (gone) return;
        engine = initChartEngine(chart.current, stage.current, { params: PENDANT_DEFAULTS, urlOverrides: false, syncUrl: false, canvasPx: 2800, growSteps: 48 });
        const status = { frames: 0, done: false };
        (window as any).__bake = status;
        bakeChart(engine, chart.current, clock, () => engine.setBirth(HERO_SKIES[0]), status);
        return;
      }
      // Dev only. /?grid=1: instead of playing, photograph the eleven other pendants of the last shot's grid.
      if (dev && query.has('grid')) {
        const [{ initChartEngine }, { bakeGrid }] = await Promise.all([import('@/app/chart/chart-engine'), import('./hero-grid')]);
        if (gone) return;
        engine = initChartEngine(chart.current, stage.current, { params: PENDANT_DEFAULTS, urlOverrides: false, syncUrl: false });
        const viewer = await engine.viewer();
        const status = { done: 0, finished: false };
        (window as any).__gridBake = status;
        setReady(true);
        bakeGrid(engine, viewer, chart.current, stage.current, status);
        return;
      }
      const light = window.matchMedia(LIGHT).matches;
      const [{ initChartEngine }, { HeroDirector }] = await Promise.all([import('@/app/chart/chart-engine'), import('./hero-director')]);
      if (gone) return;
      engine = initChartEngine(chart.current, stage.current, { params: PENDANT_DEFAULTS, urlOverrides: false, syncUrl: false, canvasPx: light ? LIGHT_CHART_PX : undefined });
      engine.setBirth(HERO_SKIES[0]);
      const viewer = await engine.viewer();
      if (gone) return;
      director = new HeroDirector(engine, viewer, chart.current, stage.current, light);
      director.onSky = setSky;
      director.onReady = () => setReady(true);
    })();
    return () => { gone = true; director?.dispose(); engine?.destroy(); };
  }, []);

  return { chart, stage, sky, ready };
}
