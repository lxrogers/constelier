'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import SettingsPanel from './components/SettingsPanel';
import OutlineControls from './components/OutlineControls';
import Reading from './components/Reading';
import AddToBagPanel from './components/AddToBagPanel';
import BagLink from '@/components/BagLink';
import { Wordmark } from '@/components/Logo';
import type { AspectLike } from '@/lib/reading';
import { trackFunnel } from '@/lib/analytics';
import { PENDANT_DEFAULTS, type PendantParams } from '@/config/pendant-params';
import type { ChartEngine } from './chart-engine';
const WheelDatePicker = dynamic(() => import('./components/WheelDatePicker'), { ssr: false });
const WheelTimePicker = dynamic(() => import('./components/WheelTimePicker'), { ssr: false });
import './chart.css';

interface AspectData extends AspectLike {
  enabled: boolean;
}

type Step = 'birth' | 'reading' | 'shape' | 'reserve';
export type ChartTheme = 'night' | 'paper' | 'mono';

// Off until launch: the last step stays the waitlist unless this is 'true'.
const SHOP_ENABLED = process.env.NEXT_PUBLIC_SHOP_ENABLED === 'true';

const STEPS: { id: Step; label: string }[] = [
  { id: 'birth', label: 'Birth' },
  { id: 'reading', label: 'Reading' },
  { id: 'shape', label: 'Shape' },
  { id: 'reserve', label: 'Reserve' },
];

// How much of the zodiac ring stays visible in each step (0..100, the
// engine's chart opacity). The shape step fades the chart so the metal leads.
const CHART_OPACITY: Record<Step, number> = { birth: 60, reading: 60, shape: 22, reserve: 30 };

export default function NatalChart({ theme = 'night', initialStep = 'birth', homeHref = '/' }: {
  theme?: ChartTheme;
  initialStep?: Step;
  homeHref?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvas3dRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ChartEngine | null>(null);
  // Pendant settings: the saved lab defaults, changed by the outline
  // controls and the developer settings panel (?dev).
  const [params, setParams] = useState<PendantParams>(PENDANT_DEFAULTS);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [step, setStep] = useState<Step>(initialStep);
  const [visited, setVisited] = useState<Set<Step>>(() => new Set(STEPS.slice(0, STEPS.findIndex((s) => s.id === initialStep) + 1).map((s) => s.id)));
  const [birthStep, setBirthStep] = useState<'date' | 'time' | 'location'>('date');
  const [aspects, setAspects] = useState<AspectData[]>([]);
  const [focus, setFocus] = useState<{ x: number; y: number } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showDev, setShowDev] = useState(false);
  const chartTracked = useRef(false);

  useEffect(() => {
    if (step === 'reading') trackFunnel('birth_details_entered');
  }, [step]);

  useEffect(() => {
    if (step !== 'reading' || aspects.length === 0 || chartTracked.current) return;
    chartTracked.current = true;
    trackFunnel('chart_shown', { aspects: aspects.length });
  }, [step, aspects.length]);

  useEffect(() => {
    setShowDev(new URLSearchParams(window.location.search).has('dev'));
  }, []);

  function goTo(next: Step) {
    setStep(next);
    setVisited((v) => new Set(v).add(next));
  }

  // Step changes: scroll the panel to the top, set how loud the chart is,
  // and clear any highlight outside the reading.
  useEffect(() => {
    panelRef.current?.scrollTo(0, 0);
    const op = document.getElementById('chart-opacity') as HTMLInputElement | null;
    if (op) {
      op.value = String(CHART_OPACITY[step]);
      op.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (step !== 'reading') dispatchAspectHover(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

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
      setFocus(d && typeof d.x1 === 'number' ? { x: (d.x1 + d.x2) / 2, y: (d.y1 + d.y2) / 2 } : null);
    };
    canvas.addEventListener('hover-changed', handleHoverChanged);

    (async () => {
      const { initChartEngine } = await import('./chart-engine');
      if (destroyed) return;
      engineRef.current = initChartEngine(canvasRef.current!, canvas3dRef.current!, { params, urlOverrides: true });
      // Apply the starting step's chart opacity once the engine listens.
      const op = document.getElementById('chart-opacity') as HTMLInputElement | null;
      op?.dispatchEvent(new Event('input', { bubbles: true }));
    })();

    return () => {
      destroyed = true;
      canvas.removeEventListener('aspects-updated', handleAspects);
      canvas.removeEventListener('hover-changed', handleHoverChanged);
      if (focusTimer.current) clearTimeout(focusTimer.current);
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only the changed settings go to the engine, so values it took from the
  // URL (a shared link, a reopened bag design) stay unless changed here.
  function changeParams(next: Partial<PendantParams>, draft: boolean) {
    setParams((p) => ({ ...p, ...next }));
    engineRef.current?.setParams(next, { draft });
  }

  function dispatchAspectHover(aspect: AspectLike | null) {
    canvasRef.current?.dispatchEvent(new CustomEvent('aspect-hover', {
      detail: aspect ? {
        point1Key: aspect.point1Key,
        point2Key: aspect.point2Key,
        aspectKey: aspect.aspectKey,
      } : null,
    }));
  }

  // The engine ignores a highlight while the lines are still drawing in, so
  // send it again a moment later.
  const onReadingFocus = useCallback((a: AspectLike | null) => {
    dispatchAspectHover(a);
    if (focusTimer.current) clearTimeout(focusTimer.current);
    if (a) focusTimer.current = setTimeout(() => dispatchAspectHover(a), 900);
  }, []);

  const enabled = aspects.filter((a) => a.enabled);

  // "Camera": lean the view toward the line being read; pull in close on
  // the metal while shaping.
  let stageTransform = 'none';
  if (step === 'reading' && focus) {
    const k = 0.22;
    stageTransform = `translate(${((0.5 - focus.x) * k * 100).toFixed(2)}%, ${((0.5 - focus.y) * k * 100).toFixed(2)}%) scale(1.1)`;
  } else if (step === 'shape' || step === 'reserve') {
    stageTransform = 'scale(1.08)';
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className={`theme-root theme-${theme} cfg`} data-step={step}>
      <header className="cfg-nav">
        <Link href={homeHref} className="cfg-home" aria-label="Constelier home"><Wordmark /></Link>
        <div className="cfg-nav-end">
          <span className="cfg-nav-step eyebrow">{String(stepIndex + 1).padStart(2, '0')} / 04</span>
          <BagLink />
        </div>
      </header>

      <div id="main" className="cfg-stage">
        <div className="cfg-stage-glow" aria-hidden="true" />
        <div className="chart-frame" style={{ transform: stageTransform }}>
          <div className="chart-wrapper">
            <canvas ref={canvasRef} id="chart" width="700" height="700"></canvas>
            <canvas ref={canvas3dRef} id="chart-3d" width="700" height="700"></canvas>
          </div>
        </div>
        <SettingsPanel showGear={showDev} params={params} onChange={changeParams} />
        {/* Engine bindings: chart opacity is driven by the step. */}
        <input type="hidden" id="chart-opacity" defaultValue={CHART_OPACITY[initialStep]} />
        <span id="chart-opacity-val" hidden />
      </div>

      <aside id="controls" className="cfg-panel" ref={panelRef}>
        <nav className="cfg-steps" aria-label="Steps">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`cfg-step${s.id === step ? ' current' : ''}${i < stepIndex ? ' done' : ''}`}
              disabled={!visited.has(s.id) || s.id === step}
              onClick={() => goTo(s.id)}
            >
              <span className="cfg-step-n">{String(i + 1).padStart(2, '0')}</span>
              <span className="cfg-step-l">{s.label}</span>
            </button>
          ))}
        </nav>

        {/* ── 01 Birth ── */}
        <section className="cfg-section" hidden={step !== 'birth'}>
          <div className="cfg-head">
            <h2 className="cfg-title reveal">The sky, the moment you arrived.</h2>
            <p className="cfg-sub reveal" style={{ ['--d' as string]: '80ms' }}>
              Date, time and place. The closer the time, the truer the chart.
            </p>
          </div>

          <p className="cfg-birth-progress mobile-only" aria-live="polite">
            {birthStep === 'date' ? 'Date' : birthStep === 'time' ? 'Time' : 'Place'} <span>· {birthStep === 'date' ? 1 : birthStep === 'time' ? 2 : 3} of 3</span>
          </p>
          <div className="cfg-fields">
            <div className={`birth-field birth-field-date${birthStep === 'date' ? ' active' : ''}`}>
              <div className="form-group">
                <label htmlFor="birth-month">Date</label>
                <div className="date-row hide-mobile">
                  <select id="birth-month" aria-label="Month"></select>
                  <select id="birth-day" aria-label="Day"></select>
                  <select id="birth-year" aria-label="Year"></select>
                </div>
                <div className="mobile-only">
                  <WheelDatePicker />
                </div>
              </div>
            </div>
            <div className={`birth-field birth-field-time${birthStep === 'time' ? ' active' : ''}`}>
              <div className="form-group">
                <label htmlFor="birth-hour">Time</label>
                <div className="time-row hide-mobile">
                  <select id="birth-hour" aria-label="Hour"></select>
                  <select id="birth-minute" aria-label="Minute"></select>
                </div>
                <div className="mobile-only">
                  <WheelTimePicker />
                </div>
              </div>
            </div>
            <div className={`birth-field birth-field-location${birthStep === 'location' ? ' active' : ''}`}>
              <div className="form-group">
                <label htmlFor="location">Place</label>
                <div className="location-input-wrap">
                  <input type="text" id="location" defaultValue="Lexington, Fayette County" autoComplete="off" />
                  <div id="location-dropdown" className="dropdown"></div>
                </div>
                <div id="location-info" className="location-display">38.0464°, -84.4970°</div>
              </div>
            </div>
            <div id="error"></div>
          </div>

          <div className="cfg-actions">
            {/* Phones: one field at a time. */}
            <div className="btn-row mobile-only">
              {birthStep !== 'date' && (
                <button className="btn btn-ghost cfg-back" onClick={() => setBirthStep(birthStep === 'location' ? 'time' : 'date')} aria-label="Back">
                  <span aria-hidden="true">&larr;</span>
                </button>
              )}
              {birthStep !== 'location' ? (
                <button className="btn cfg-cta" onClick={() => setBirthStep(birthStep === 'date' ? 'time' : 'location')}>
                  Next <span className="btn-arrow" aria-hidden="true">&rarr;</span>
                </button>
              ) : (
                <button className="btn cfg-cta" onClick={() => goTo('reading')}>
                  Read my chart <span className="btn-arrow" aria-hidden="true">&rarr;</span>
                </button>
              )}
            </div>
            <button className="btn cfg-cta hide-mobile" onClick={() => goTo('reading')}>
              Read my chart <span className="btn-arrow" aria-hidden="true">&rarr;</span>
            </button>
          </div>
        </section>

        {/* ── 02 Reading ── */}
        <section className="cfg-section" hidden={step !== 'reading'}>
          {/* Keep aspect-filters in DOM for chart-engine bindings */}
          <div hidden><div className="aspect-filters" id="aspect-filters"></div></div>
          {enabled.length > 0 ? (
            <Reading
              aspects={enabled}
              active={step === 'reading'}
              onFocus={onReadingFocus}
              onDone={() => goTo('shape')}
            />
          ) : (
            <p className="cfg-sub">Drawing your chart…</p>
          )}
        </section>

        {/* ── 03 Shape ── */}
        <section className="cfg-section" hidden={step !== 'shape'}>
          <div className="cfg-head">
            <p className="eyebrow reveal">The metal</p>
            <h2 className="cfg-title reveal" style={{ ['--d' as string]: '60ms' }}>How should the gold move?</h2>
          </div>
          <OutlineControls variant="panel" params={params} onChange={changeParams} />
          <div className="cfg-actions">
            <div className="btn-row">
              <button className="btn btn-ghost cfg-back" onClick={() => goTo('reading')} aria-label="Back to the reading">
                <span aria-hidden="true">&larr;</span>
              </button>
              <button className="btn cfg-cta" onClick={() => goTo('reserve')}>
                {SHOP_ENABLED ? 'Make it yours' : 'Reserve this pendant'} <span className="btn-arrow" aria-hidden="true">&rarr;</span>
              </button>
            </div>
          </div>
        </section>

        {/* ── 04 Reserve ── */}
        <section className="cfg-section" hidden={step !== 'reserve'}>
          {SHOP_ENABLED ? (
            <div className="cfg-shop">
              <div className="cfg-head">
                <p className="eyebrow reveal">Almost yours</p>
                <h2 className="cfg-title reveal" style={{ ['--d' as string]: '60ms' }}>Your pendant.</h2>
              </div>
              <AddToBagPanel canvasRef={canvasRef} active={step === 'reserve'} />
              <button className="btn btn-ghost cfg-back cfg-shop-back" onClick={() => goTo('shape')} aria-label="Back to the shape">
                <span aria-hidden="true">&larr;</span>
              </button>
            </div>
          ) : submitted ? (
            <div className="cfg-head waitlist-thanks">
              <p className="eyebrow reveal">Reserved</p>
              <h2 className="cfg-title reveal" style={{ ['--d' as string]: '60ms' }}>It is written.</h2>
              <p className="cfg-sub reveal" style={{ ['--d' as string]: '120ms' }}>
                We will email your design when casting opens.
              </p>
            </div>
          ) : (
            <WaitlistForm active={step === 'reserve'} onSubmitted={() => { setSubmitted(true); trackFunnel('waitlist_joined'); }} onBack={() => goTo('shape')} />
          )}
        </section>
      </aside>
    </div>
  );
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Replace with your Formspree form ID from https://formspree.io
const FORMSPREE_ID = 'xjgeozgv';

function getBirthMeta() {
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null)?.value || '';
  const year = val('birth-year');
  const month = val('birth-month');
  const day = val('birth-day');
  const hour = val('birth-hour');
  const minute = val('birth-minute');
  const location = val('location');
  const monthName = MONTHS[parseInt(month) - 1] || '';
  const h = parseInt(hour);
  const mm = parseInt(minute);
  const time = Number.isFinite(h) && Number.isFinite(mm)
    ? `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
    : '';
  return {
    // Empty strings when the form isn't filled yet, so nothing shows half-done.
    birthdate: monthName && day && year ? `${monthName} ${day}, ${year}` : '',
    birthtime: hour && minute ? `${hour}:${minute}` : '',
    time,
    location,
  };
}

function WaitlistForm({ active, onSubmitted, onBack }: { active: boolean; onSubmitted: () => void; onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [meta, setMeta] = useState<ReturnType<typeof getBirthMeta> | null>(null);

  // Read the form when the step opens; the engine fills the selects after mount.
  useEffect(() => {
    if (!active) return;
    setMeta(getBirthMeta());
    const t1 = setTimeout(() => setMeta(getBirthMeta()), 400);
    const t2 = setTimeout(() => setMeta(getBirthMeta()), 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [active]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || sending) return;
    setSending(true);
    const m = getBirthMeta();
    try {
      await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          birthdate: m.birthdate,
          birthtime: m.birthtime,
          location: m.location,
        }),
      });
      onSubmitted();
    } catch {
      setSending(false);
    }
  }

  return (
    <div className="waitlist-form">
      <div className="cfg-head">
        <p className="eyebrow reveal">Almost yours</p>
        <h2 className="cfg-title reveal" style={{ ['--d' as string]: '60ms' }}>Reserve your pendant.</h2>
        <p className="cfg-sub reveal" style={{ ['--d' as string]: '120ms' }}>
          Constelier is still in the studio. Leave your email and we will send your design when casting opens.
        </p>
      </div>
      {meta && (meta.birthdate || meta.location) && (
        <dl className="cfg-summary reveal" style={{ ['--d' as string]: '180ms' }}>
          {meta.birthdate && <div><dt>Born</dt><dd>{meta.birthdate}{meta.time && <span className="cfg-summary-time">{meta.time}</span>}</dd></div>}
          {meta.location && <div><dt>Place</dt><dd>{meta.location.split(',')[0]}</dd></div>}
        </dl>
      )}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="waitlist-email">Email</label>
          <input
            id="waitlist-email"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-ghost cfg-back" onClick={onBack} aria-label="Back to the shape">
            <span aria-hidden="true">&larr;</span>
          </button>
          <button type="submit" className="btn cfg-cta" disabled={sending}>
            {sending ? 'Sending…' : 'Join the waitlist'}
          </button>
        </div>
      </form>
      <p className="waitlist-disclosure">
        Your birth date, time, and location will be shared with Constelier
        so we can generate your pendant. We won&apos;t share your data with
        anyone else.
      </p>
    </div>
  );
}
