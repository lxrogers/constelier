'use client';

// The ceremonial reading: one aspect at a time. Each kind of aspect gets a
// short introduction the first time it comes up, then each of the user's
// aspects of that kind gets its own card, highlighted on the pendant.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ASPECT_TYPES, READING_ORDER, AspectKey, AspectLike,
  aspectId, chartSummary, planet, readingFor,
} from '@/lib/reading';
import './Reading.css';

type Item =
  | { kind: 'intro' }
  | { kind: 'type'; type: AspectKey; count: number }
  | { kind: 'aspect'; aspect: AspectLike; type: AspectKey; n: number; of: number; seq: number }
  | { kind: 'close' };

const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
const word = (n: number) => NUMBER_WORDS[n] || String(n);

function Sentences({ text, base = 0 }: { text: string; base?: number }) {
  const parts = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  return (
    <>
      {parts.map((s, i) => (
        <span key={i} className="reveal" style={{ ['--d' as string]: `${base + i * 90}ms` }}>
          {s}
        </span>
      ))}
    </>
  );
}

interface Props {
  aspects: AspectLike[];
  active: boolean;
  onFocus: (a: AspectLike | null) => void;
  onDone: () => void;
}

export default function Reading({ aspects, active, onFocus, onDone }: Props) {
  const { items, counts, total } = useMemo(() => {
    const items: Item[] = [{ kind: 'intro' }];
    const counts: Partial<Record<AspectKey, number>> = {};
    let seq = 0;
    for (const type of READING_ORDER) {
      const list = aspects.filter((a) => a.aspectKey === type);
      if (!list.length) continue;
      counts[type] = list.length;
      items.push({ kind: 'type', type, count: list.length });
      list.forEach((aspect, i) => items.push({ kind: 'aspect', aspect, type, n: i + 1, of: list.length, seq: seq++ }));
    }
    items.push({ kind: 'close' });
    return { items, counts, total: seq };
  }, [aspects]);

  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const signature = useMemo(() => aspects.map(aspectId).join('|'), [aspects]);

  // A new chart restarts the reading.
  useEffect(() => { setIndex(0); }, [signature]);

  const item = items[Math.min(index, items.length - 1)];

  // Highlight the current aspect on the pendant.
  useEffect(() => {
    if (!active) return;
    onFocus(item.kind === 'aspect' ? item.aspect : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, index, signature]);

  function go(delta: 1 | -1) {
    const next = index + delta;
    if (next < 0) return;
    if (next >= items.length) { onDone(); return; }
    setDir(delta);
    setIndex(next);
  }

  // Arrow keys step through the reading while it is on screen.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Horizontal swipe on touch screens.
  const touch = useRef<{ x: number; y: number } | null>(null);
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === 'mouse') return;
    touch.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e: React.PointerEvent) {
    const t = touch.current;
    touch.current = null;
    if (!t) return;
    const dx = e.clientX - t.x;
    const dy = e.clientY - t.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
  }

  const seqNow = item.kind === 'aspect' ? item.seq : item.kind === 'close' ? total : item.kind === 'type'
    ? (items.slice(index).find((x) => x.kind === 'aspect') as { seq: number } | undefined)?.seq ?? total
    : -1;

  return (
    <div className="reading" data-kind={item.kind}>
      <div className="reading-progress" aria-hidden={item.kind === 'intro'}>
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`reading-tick${i < seqNow ? ' done' : ''}${i === seqNow && item.kind === 'aspect' ? ' now' : ''}`}
          />
        ))}
      </div>

      <div
        className={`reading-card dir-${dir > 0 ? 'fwd' : 'back'}`}
        key={`${signature}-${index}`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        aria-live="polite"
      >
        {item.kind === 'intro' && (
          <>
            <p className="eyebrow reveal">Your reading</p>
            <h3 className="reading-title reveal" style={{ ['--d' as string]: '60ms' }}>
              {word(total)} {total === 1 ? 'line' : 'lines'}, {word(total).toLowerCase()} {total === 1 ? 'conversation' : 'conversations'}.
            </h3>
            <p className="reading-body">
              <Sentences
                base={140}
                text="Every line in your pendant is an aspect: two planets locked at a particular angle on the day you were born. Let's go through them one at a time."
              />
            </p>
          </>
        )}

        {item.kind === 'type' && (() => {
          const t = ASPECT_TYPES[item.type];
          return (
            <>
              <div className="reading-type-head reveal">
                <span className="reading-glyph" aria-hidden="true">{t.glyph}</span>
                <span className="eyebrow">{t.epithet} · {t.degrees}°</span>
              </div>
              <h3 className="reading-title reveal" style={{ ['--d' as string]: '60ms' }}>{t.plural}</h3>
              <p className="reading-body"><Sentences base={140} text={t.intro} /></p>
              <p className="reading-metal reveal" style={{ ['--d' as string]: '420ms' }}>
                <ChordIcon type={item.type} />
                <span>{t.inMetal}</span>
              </p>
              <p className="reading-count reveal" style={{ ['--d' as string]: '520ms' }}>
                You have {word(item.count).toLowerCase()}.
              </p>
            </>
          );
        })()}

        {item.kind === 'aspect' && (() => {
          const t = ASPECT_TYPES[item.type];
          const p1 = planet(item.aspect.point1Key);
          const p2 = planet(item.aspect.point2Key);
          return (
            <>
              <p className="eyebrow reveal">{t.name} · {item.n} of {item.of}</p>
              <div className="reading-pair reveal" style={{ ['--d' as string]: '60ms' }} aria-hidden="true">
                <span className="reading-pair-glyph">{p1.glyph}</span>
                <span className="reading-pair-aspect">{t.glyph}</span>
                <span className="reading-pair-glyph">{p2.glyph}</span>
              </div>
              <h3 className="reading-title reveal" style={{ ['--d' as string]: '100ms' }}>
                {p1.name} <em>{t.name.toLowerCase()}</em> {p2.name}
              </h3>
              <p className="reading-body"><Sentences base={180} text={readingFor(item.aspect)} /></p>
              <dl className="reading-keys reveal" style={{ ['--d' as string]: '520ms' }}>
                <div><dt>{p1.name}</dt><dd>{p1.rules}</dd></div>
                <div><dt>{p2.name}</dt><dd>{p2.rules}</dd></div>
              </dl>
            </>
          );
        })()}

        {item.kind === 'close' && (
          <>
            <p className="eyebrow reveal">The whole sky</p>
            <h3 className="reading-title reveal" style={{ ['--d' as string]: '60ms' }}>That is your chart.</h3>
            <ul className="reading-tally reveal" style={{ ['--d' as string]: '140ms' }}>
              {READING_ORDER.filter((k) => counts[k]).map((k) => (
                <li key={k}>
                  <span className="reading-tally-n">{counts[k]}</span>
                  <span className="reading-tally-g" aria-hidden="true">{ASPECT_TYPES[k].glyph}</span>
                  <span className="reading-tally-l">{counts[k] === 1 ? ASPECT_TYPES[k].name : ASPECT_TYPES[k].plural}</span>
                </li>
              ))}
            </ul>
            <p className="reading-body"><Sentences base={220} text={chartSummary(counts)} /></p>
          </>
        )}
      </div>

      <div className="reading-nav">
        {index > 0 ? (
          <button type="button" className="btn btn-ghost reading-prev" onClick={() => go(-1)} aria-label="Previous">
            <span aria-hidden="true">&larr;</span>
          </button>
        ) : (
          <button type="button" className="reading-skip" onClick={onDone}>Skip the reading</button>
        )}
        <button type="button" className="btn reading-next" onClick={() => go(1)}>
          {item.kind === 'intro' ? 'Begin the reading'
            : item.kind === 'close' ? 'Shape your pendant'
            : item.kind === 'type' ? `Read ${item.count === 1 ? 'it' : 'them'}`
            : 'Next'}
          <span className="btn-arrow" aria-hidden="true">&rarr;</span>
        </button>
      </div>
      <p className="reading-hint" aria-hidden="true">Placeholder readings · written by AI</p>
    </div>
  );
}

// A tiny circle with the chord length of that aspect, so the copy about
// "long lines" and "short chords" has something to point at.
function ChordIcon({ type }: { type: AspectKey }) {
  const deg = ASPECT_TYPES[type].degrees || 8;
  const a0 = (-90 - deg / 2) * Math.PI / 180;
  const a1 = (-90 + deg / 2) * Math.PI / 180;
  const r = 9;
  const x0 = 11 + r * Math.cos(a0 + Math.PI), y0 = 11 + r * Math.sin(a0 + Math.PI);
  const x1 = 11 + r * Math.cos(a1 + Math.PI), y1 = 11 + r * Math.sin(a1 + Math.PI);
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="reading-chord">
      <circle cx="11" cy="11" r={r} fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1" />
      <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
