'use client';

// A heading with previous/next buttons over a row of cards that scrolls
// sideways (native scrolling with snap; the buttons move it one card).

import { useCallback, useEffect, useRef, useState } from 'react';

// `prefix` names the page's own classes (stu-rail, halo-rail, ...), so each
// homepage direction styles the rail itself.
export default function CardRail({ title, lede, prefix = 'stu', children }: {
  title: string;
  lede?: string;
  prefix?: string;
  children: React.ReactNode;
}) {
  const rail = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const step = (dir: 1 | -1) => {
    const el = rail.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: dir * (card.offsetWidth + gap), behavior: 'smooth' });
  };

  return (
    <>
      <div className={`${prefix}-rail-head`}>
        <div className={`${prefix}-sec-head`}>
          <h2 className={`${prefix}-h2`}>{title}</h2>
          {lede && <p className={`${prefix}-body`}>{lede}</p>}
        </div>
        <div className={`${prefix}-rail-btns`}>
          <button type="button" aria-label="Previous" disabled={edge.start} onClick={() => step(-1)}><Chevron flip /></button>
          <button type="button" aria-label="Next" disabled={edge.end} onClick={() => step(1)}><Chevron /></button>
        </div>
      </div>
      <ul className={`${prefix}-rail`} ref={rail} onScroll={measure}>{children}</ul>
    </>
  );
}

function Chevron({ flip }: { flip?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
