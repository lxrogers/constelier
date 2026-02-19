'use client';

import { useRef, useEffect, useState } from 'react';
import SettingsPanel from './components/SettingsPanel';
import './chart.css';

interface AspectData {
  aspectKey: string;
  point1Key: string;
  point2Key: string;
  enabled: boolean;
}

const PLANET_NAMES: Record<string, string> = {
  sun: 'Sun', moon: 'Moon', mercury: 'Mercury', venus: 'Venus',
  mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus',
  neptune: 'Neptune', pluto: 'Pluto',
};

const ASPECT_ORDER = ['opposition', 'trine', 'square', 'sextile'];

const ASPECT_INFO: Record<string, { label: string; degrees: number; description: string }> = {
  conjunction: { label: 'Conjunctions', degrees: 0, description: 'Planets merge their energies, intensifying and blending their qualities.' },
  opposition: { label: 'Oppositions', degrees: 180, description: 'A tension between opposing forces that demands balance and integration.' },
  trine: { label: 'Trines', degrees: 120, description: 'A natural harmony where energies flow together with ease and grace.' },
  square: { label: 'Squares', degrees: 90, description: 'A dynamic friction that drives growth through challenge and effort.' },
  sextile: { label: 'Sextiles', degrees: 60, description: 'A gentle opportunity for cooperation that rewards initiative.' },
};

export default function NatalChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvas3dRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<(() => void) | null>(null);
  const [step, setStep] = useState<'birth' | 'aspects'>('birth');
  const [aspects, setAspects] = useState<AspectData[]>([]);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !canvas3dRef.current) return;

    let destroyed = false;

    const canvas = canvasRef.current!;
    const handleAspects = (e: Event) => {
      if (destroyed) return;
      setAspects((e as CustomEvent).detail);
    };
    canvas.addEventListener('aspects-updated', handleAspects);

    const handleHoverChanged = (e: Event) => {
      if (destroyed) return;
      const d = (e as CustomEvent).detail;
      setHoveredKey(d ? `${d.point1Key}-${d.point2Key}-${d.aspectKey}` : null);
    };
    canvas.addEventListener('hover-changed', handleHoverChanged);

    (async () => {
      const { initChartEngine } = await import('./chart-engine');
      if (destroyed) return;
      engineRef.current = initChartEngine(canvasRef.current!, canvas3dRef.current!);
    })();

    return () => {
      destroyed = true;
      canvas.removeEventListener('aspects-updated', handleAspects);
      canvas.removeEventListener('hover-changed', handleHoverChanged);
      if (engineRef.current) {
        engineRef.current();
        engineRef.current = null;
      }
    };
  }, []);

  function dispatchAspectHover(aspect: AspectData | null) {
    setHoveredKey(aspect ? `${aspect.point1Key}-${aspect.point2Key}-${aspect.aspectKey}` : null);
    canvasRef.current?.dispatchEvent(new CustomEvent('aspect-hover', {
      detail: aspect ? {
        point1Key: aspect.point1Key,
        point2Key: aspect.point2Key,
        aspectKey: aspect.aspectKey,
      } : null,
    }));
  }

  // Group aspects by type
  const grouped = ASPECT_ORDER.reduce<Record<string, AspectData[]>>((acc, key) => {
    const items = aspects.filter(a => a.aspectKey === key);
    if (items.length > 0) acc[key] = items;
    return acc;
  }, {});

  return (
    <div className="chart-page">
      <div id="controls">
        <h2>Aspect Pendant</h2>
        <h3 className="controls-subheading">
          {step === 'birth' ? 'Birth Details' : 'Your Aspects'}
        </h3>

        <div style={{ display: step === 'birth' ? undefined : 'none' }}>
          <div className="form-group">
            <label>Year</label>
            <div className="slider-row">
              <input type="range" id="birth-year" min="1925" max="2026" defaultValue="2000" />
              <span className="slider-value" id="birth-year-val">2000</span>
            </div>
          </div>
          <div className="form-group">
            <label>Month</label>
            <div className="slider-row">
              <input type="range" id="birth-month" min="1" max="12" defaultValue="1" />
              <span className="slider-value" id="birth-month-val">Jan</span>
            </div>
          </div>
          <div className="form-group">
            <label>Day</label>
            <div className="slider-row">
              <input type="range" id="birth-day" min="1" max="31" defaultValue="1" />
              <span className="slider-value" id="birth-day-val">1</span>
            </div>
          </div>
          <div className="form-group">
            <label>Time</label>
            <div className="time-row">
              <select id="birth-hour"></select>
              <select id="birth-minute"></select>
            </div>
          </div>
          <div className="form-group">
            <label>Location</label>
            <input type="text" id="location" defaultValue="Lexington, Fayette County" autoComplete="off" />
            <div id="location-dropdown" className="dropdown"></div>
            <div id="location-info" className="location-display">38.0464°, -84.4970°</div>
          </div>
          <div id="error"></div>
          <button className="controls-step-btn" onClick={() => setStep('aspects')}>
            View Aspects &rarr;
          </button>
        </div>

        <div style={{ display: step === 'aspects' ? undefined : 'none' }}>
          {/* Keep aspect-filters in DOM for chart-engine bindings */}
          <div style={{ display: 'none' }}>
            <div className="aspect-filters" id="aspect-filters"></div>
          </div>

          <div className="aspects-list">
            {Object.entries(grouped).map(([key, items]) => (
              <div key={key} className="aspect-category">
                <h4 className="aspect-category-title">
                  {ASPECT_INFO[key]?.label || key}
                  <span className="aspect-category-degrees">{ASPECT_INFO[key]?.degrees}°</span>
                </h4>
                <p className="aspect-category-desc">{ASPECT_INFO[key]?.description}</p>
                <ul className="aspect-items">
                  {items.map((a, i) => (
                    <li
                      key={i}
                      className={`aspect-item${a.enabled ? '' : ' disabled'}${hoveredKey === `${a.point1Key}-${a.point2Key}-${a.aspectKey}` ? ' highlighted' : ''}`}
                      onMouseEnter={() => dispatchAspectHover(a)}
                      onMouseLeave={() => dispatchAspectHover(null)}
                    >
                      <span className="aspect-item-planets">
                        {PLANET_NAMES[a.point1Key] || a.point1Key}
                        {' '}
                        <span className="aspect-item-sep">&amp;</span>
                        {' '}
                        {PLANET_NAMES[a.point2Key] || a.point2Key}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <button className="controls-back-btn" onClick={() => setStep('birth')}>
            &larr; Birth Details
          </button>
        </div>
      </div>
      <div id="main">
        <div className="chart-wrapper">
          <canvas ref={canvasRef} id="chart" width="700" height="700"></canvas>
          <canvas ref={canvas3dRef} id="chart-3d" width="700" height="700"></canvas>
        </div>
        <SettingsPanel />
      </div>
    </div>
  );
}
