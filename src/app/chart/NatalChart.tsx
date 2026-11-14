'use client';

import { useRef, useEffect, useState } from 'react';
import { useGlide } from '@/hooks/useGlide';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import dynamic from 'next/dynamic';
import SettingsPanel from './components/SettingsPanel';
import AddToBagPanel from './components/AddToBagPanel';
import ReadingFlow from './components/ReadingFlow';
import ReadingList from './components/reading/ReadingList';
import ReadingScroll from './components/reading/ReadingScroll';
import ReadingPins from './components/reading/ReadingPins';
import ReadingVariantSwitch, { readingVariantFromURL, type ReadingVariant } from './components/reading/ReadingVariantSwitch';
import type { ChartAspect, ChartBodies } from '@/lib/reading/aspect-reading';
import { PENDANT_DEFAULTS, type PendantParams } from '@/config/pendant-params';
import type { AspectSegment, ChartEngine, FocusSpec } from './chart-engine';
const WheelDatePicker = dynamic(() => import('./components/WheelDatePicker'), { ssr: false });
const WheelTimePicker = dynamic(() => import('./components/WheelTimePicker'), { ssr: false });
import './chart.css';

// Off until launch: the last step stays the waitlist unless this is 'true'.
const SHOP_ENABLED = process.env.NEXT_PUBLIC_SHOP_ENABLED === 'true';

interface NatalChartProps {
  // Controlled pendant settings (the lab). Without them the page uses the
  // saved defaults plus whatever the prod settings panel exposes.
  params?: PendantParams;
  // True while a slider is mid-drag: the engine builds a quick draft.
  draft?: boolean;
  // Let the URL override aspects/outline and keep it in sync (prod only).
  urlOverrides?: boolean;
  // Orbitable 3D view (lab).
  orbit?: boolean;
  // Extra column to the right of the chart (the lab's settings).
  sidePanel?: React.ReactNode;
  className?: string;
}

export default function NatalChart({ params: controlledParams, draft = false, urlOverrides = true, orbit = false, sidePanel, className }: NatalChartProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvas3dRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ChartEngine | null>(null);
  const [ownParams, setOwnParams] = useState<PendantParams>(PENDANT_DEFAULTS);
  const [ownDraft, setOwnDraft] = useState(false);
  const params = controlledParams ?? ownParams;
  const isDraft = controlledParams ? draft : ownDraft;
  const latest = useRef({ params, isDraft });
  latest.current = { params, isDraft };
  const [step, setStep] = useState<'birth' | 'reading' | 'waitlist'>('birth');
  const mainRef = useRef<HTMLDivElement>(null);
  // The model's box changes between steps; glide it there instead of jumping.
  const captureGlide = useGlide(mainRef, wrapperRef, step);
  const goStep = (next: typeof step) => { captureGlide(); setStep(next); };
  const [birthStep, setBirthStep] = useState<'date' | 'time' | 'location'>('date');
  const [aspects, setAspects] = useState<ChartAspect[]>([]);
  const [bodies, setBodies] = useState<ChartBodies | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [segments, setSegments] = useState<AspectSegment[]>([]);
  // Reading layout prototypes; ?reading=steps|list|scroll|pins.
  const [variant, setVariant] = useState<ReadingVariant>('steps');
  useEffect(() => { setVariant(readingVariantFromURL()); }, []);
  // Phones: keep the sheet (and the location field) above the keyboard.
  useKeyboardInset();

  // iPhone Safari slides the whole page up to keep a focused field above
  // the keyboard, and doesn't always slide it back. This page never
  // scrolls, so put it back once the field lets go.
  useEffect(() => {
    const onFocusOut = (e: FocusEvent) => {
      if (!(e.target instanceof HTMLInputElement)) return;
      window.setTimeout(() => {
        if (!(document.activeElement instanceof HTMLInputElement)) window.scrollTo(0, 0);
      }, 60);
    };
    document.addEventListener('focusout', onFocusOut);
    return () => document.removeEventListener('focusout', onFocusOut);
  }, []);

  useEffect(() => {
    controlsRef.current?.scrollTo(0, 0);
    // Only the reading steers the chart's focus.
    if (step !== 'reading') engineRef.current?.setFocus(null);
  }, [step]);

  const handleFocus = (spec: FocusSpec | null) => {
    // The step-by-step reading swaps its text each step; start it at the top.
    if (variant === 'steps') controlsRef.current?.scrollTo(0, 0);
    engineRef.current?.setFocus(spec);
  };

  useEffect(() => {
    if (!canvasRef.current || !canvas3dRef.current) return;

    let destroyed = false;

    const canvas = canvasRef.current!;
    const handleAspects = (e: Event) => {
      if (destroyed) return;
      setAspects((e as CustomEvent).detail);
    };
    canvas.addEventListener('aspects-updated', handleAspects);

    const handleChart = (e: Event) => {
      if (destroyed) return;
      setBodies((e as CustomEvent).detail);
    };
    canvas.addEventListener('chart-updated', handleChart);

    const handleSegments = (e: Event) => {
      if (destroyed) return;
      setSegments((e as CustomEvent).detail);
    };
    canvas.addEventListener('aspect-segments', handleSegments);

    (async () => {
      const { initChartEngine } = await import('./chart-engine');
      if (destroyed) return;
      engineRef.current = initChartEngine(canvasRef.current!, canvas3dRef.current!, {
        params: latest.current.params,
        urlOverrides,
        orbit,
      });
    })();

    return () => {
      destroyed = true;
      canvas.removeEventListener('aspects-updated', handleAspects);
      canvas.removeEventListener('chart-updated', handleChart);
      canvas.removeEventListener('aspect-segments', handleSegments);
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push setting changes into the engine. (Changes made before it finished
  // loading are already in the params it was created with.)
  useEffect(() => {
    engineRef.current?.setParams(params, { draft: isDraft });
  }, [params, isDraft]);

  // Birth details and the reading share one layout: model left, text right.
  // (The lab keeps its card for birth details, beside its own side panel.)
  // The last step (bag or waitlist) keeps that layout too, so finishing the
  // reading doesn't flip the model to the other side.
  const flow = step === 'reading' || (!sidePanel && (step === 'birth' || step === 'waitlist'));

  return (
    <div className={`chart-page${flow ? ' is-flow' : ''}${flow && step === 'waitlist' ? ' is-finish' : ''}${step === 'reading' ? ` is-reading reading-${variant}` : ''}${className ? ' ' + className : ''}`}>
      <div id="controls" ref={controlsRef}>
        <h2>{step === 'reading' ? 'Your Reading' : step === 'birth' ? 'Your birth chart' : 'Customize your Aspect Pendant'}</h2>
        {step === 'birth' && (
          <p className="controls-intro hide-mobile">
            Your date, time and place of birth set the lines. The pendant redraws as you change them.
          </p>
        )}
        {step !== 'birth' && (
          <button className="controls-back-btn hide-mobile" onClick={() => goStep(step === 'reading' ? 'birth' : 'reading')}>
            &larr; {step === 'reading' ? 'Birth Details' : 'Your Reading'}
          </button>
        )}
        {step !== 'reading' && (
          <h3 className="controls-subheading">
            {step === 'birth' ? 'Birth Details' : SHOP_ENABLED ? 'Your Pendant' : 'Join the Waitlist'}
          </h3>
        )}

        <div style={{ display: step === 'birth' ? undefined : 'none' }}>
          <div className={`birth-field birth-field-date${birthStep === 'date' ? ' active' : ''}`}>
            <div className="form-group">
              <label>Date of Birth</label>
              <div className="date-row hide-mobile">
                <select id="birth-month"></select>
                <select id="birth-day"></select>
                <select id="birth-year"></select>
              </div>
              <div className="mobile-only">
                <WheelDatePicker />
              </div>
            </div>
            <div className="btn-row mobile-only">
              <button className="controls-step-btn" onClick={() => setBirthStep('time')}>
                Next &rarr;
              </button>
            </div>
          </div>
          <div className={`birth-field birth-field-time${birthStep === 'time' ? ' active' : ''}`}>
            <div className="form-group">
              <label>Time</label>
              <div className="time-row hide-mobile">
                <select id="birth-hour"></select>
                <select id="birth-minute"></select>
              </div>
              <div className="mobile-only">
                <WheelTimePicker />
              </div>
            </div>
            <div className="btn-row mobile-only">
              <button className="controls-back-btn-mobile" onClick={() => setBirthStep('date')}>
                &larr; Back
              </button>
              <button className="controls-step-btn" onClick={() => setBirthStep('location')}>
                Next &rarr;
              </button>
            </div>
          </div>
          <div className={`birth-field birth-field-location${birthStep === 'location' ? ' active' : ''}`}>
            <div className="form-group">
              <label>Location</label>
              <div className="location-input-wrap">
                <input type="text" id="location" defaultValue="Lexington, Fayette County" autoComplete="off" />
                <div id="location-dropdown" className="dropdown"></div>
              </div>
              <div id="location-info" className="location-display">38.0464°, -84.4970°</div>
            </div>
            <div className="btn-row mobile-only">
              <button className="controls-back-btn-mobile" onClick={() => setBirthStep('time')}>
                &larr; Back
              </button>
              <button className="controls-step-btn" onClick={() => goStep('reading')}>
                Explore my chart
              </button>
            </div>
          </div>
          <div id="error"></div>
          <button className="controls-step-btn hide-mobile" onClick={() => goStep('reading')}>
            Explore my chart
          </button>
        </div>

        <div style={{ display: step === 'reading' ? undefined : 'none' }}>
          {(() => {
            // The chart is still being worked out: don't show a reading of nothing.
            if (!aspects.length) {
              return <p className="reading-loading">Reading your sky<span aria-hidden="true">…</span></p>;
            }
            const props = {
              aspects,
              bodies,
              active: step === 'reading',
              onFocus: handleFocus,
              onBack: () => goStep('birth'),
              onFinish: () => goStep('waitlist'),
            };
            if (variant === 'list') return <ReadingList key={variant} {...props} />;
            if (variant === 'scroll') return <ReadingScroll key={variant} {...props} />;
            if (variant === 'pins') return <ReadingPins key={variant} {...props} segments={segments} overlayHost={wrapperRef.current} />;
            return <ReadingFlow key={variant} {...props} />;
          })()}
        </div>

        <div style={{ display: step === 'waitlist' ? undefined : 'none' }}>
          {SHOP_ENABLED ? (
            <AddToBagPanel canvasRef={canvasRef} active={step === 'waitlist'} />
          ) : submitted ? (
            <div className="waitlist-thanks">
              <p>Thank you for signing up! We&apos;ll be in touch.</p>
            </div>
          ) : (
            <WaitlistForm onSubmitted={() => setSubmitted(true)} />
          )}
        </div>
      </div>
      <div id="main" ref={mainRef}>
        <div className="chart-wrapper" ref={wrapperRef}>
          <canvas ref={canvasRef} id="chart" width="700" height="700"></canvas>
          <canvas ref={canvas3dRef} id="chart-3d" width="700" height="700"></canvas>
        </div>
        {step === 'reading' && <ReadingVariantSwitch value={variant} onChange={v => {
          controlsRef.current?.scrollTo(0, 0);
          setVariant(v);
        }} />}
        {!controlledParams && (
          <SettingsPanel params={ownParams} onChange={(next, d) => {
            setOwnParams((p) => ({ ...p, ...next }));
            setOwnDraft(d);
          }} />
        )}
      </div>
      {sidePanel}
    </div>
  );
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Replace with your Formspree form ID from https://formspree.io
const FORMSPREE_ID = 'xjgeozgv';

function WaitlistForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  function getBirthMeta() {
    const year = (document.getElementById('birth-year') as HTMLInputElement)?.value || '';
    const month = (document.getElementById('birth-month') as HTMLInputElement)?.value || '';
    const day = (document.getElementById('birth-day') as HTMLInputElement)?.value || '';
    const hour = (document.getElementById('birth-hour') as HTMLSelectElement)?.value || '';
    const minute = (document.getElementById('birth-minute') as HTMLSelectElement)?.value || '';
    const location = (document.getElementById('location') as HTMLInputElement)?.value || '';
    const monthName = MONTHS[parseInt(month) - 1] || month;
    return {
      birthdate: `${monthName} ${day}, ${year}`,
      birthtime: `${hour}:${minute}`,
      location,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || sending) return;
    setSending(true);
    const meta = getBirthMeta();
    try {
      await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          birthdate: meta.birthdate,
          birthtime: meta.birthtime,
          location: meta.location,
        }),
      });
      onSubmitted();
    } catch {
      setSending(false);
    }
  }

  return (
    <div className="waitlist-form">
      <p className="waitlist-intro">
        Constelier is a work in progress. Sign up to be notified when we launch
        and to receive your personalized pendant design.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button type="submit" className="controls-step-btn" disabled={sending}>
          {sending ? 'Submitting...' : 'Join Waitlist'}
        </button>
      </form>
      <p className="waitlist-disclosure">
        Your birth date, time, and location will be shared with Constelier
        so we can generate your pendant. We won&apos;t share your data with
        anyone else.
      </p>
    </div>
  );
}
