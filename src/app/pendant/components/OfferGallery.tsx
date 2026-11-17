'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface GallerySlide { key: string; node: ReactNode }

// How long each slide shows before the next one slides in.
const SLIDE_MS = 5000;

// A row of slides that moves on by itself, loops, and can be swiped. The
// controls sit under the picture: arrows either side of the dots, and the
// current dot is a bar that fills as its slide's time runs out. Hovering or
// focusing the gallery holds it; so does asking for reduced motion.
export default function OfferGallery({ slides }: { slides: GallerySlide[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = slides.length;

  // Fewer slides than before (another metal or size): stay in range.
  useEffect(() => {
    if (index > count - 1) go(0, 'auto');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const onScroll = () => {
    const el = trackRef.current;
    if (el) setIndex(Math.min(count - 1, Math.round(el.scrollLeft / Math.max(1, el.clientWidth))));
  };
  function go(i: number, behavior: ScrollBehavior = 'smooth') {
    const el = trackRef.current;
    if (!el || !count) return;
    const next = ((i % count) + count) % count; // past either end wraps round
    el.scrollTo({ left: next * el.clientWidth, behavior });
  }

  return (
    <div className="pdp-gallery">
      <div className="pdp-stage">
        <div className="pdp-track" ref={trackRef} onScroll={onScroll}>
          {slides.map((s, i) => (
            <div key={s.key} className="pdp-slide" aria-hidden={i !== index}>{s.node}</div>
          ))}
        </div>
      </div>

      {count > 1 && (
        <div className="pdp-controls">
          <button type="button" className="pdp-arrow" aria-label="Previous photo" onClick={() => go(index - 1)}>&larr;</button>
          <div className="pdp-dots">
            {slides.map((s, i) => (
              <button
                key={s.key} type="button"
                className={`pdp-dot${i === index ? ' on' : ''}`}
                aria-label={`Photo ${i + 1} of ${count}`} aria-current={i === index}
                onClick={() => go(i)}
              >
                {/* Re-made for each slide, so its fill starts again; when the fill ends, move on. */}
                {i === index && (
                  <span
                    key={index} className="pdp-dot-fill"
                    style={{ animationDuration: `${SLIDE_MS}ms` }}
                    onAnimationEnd={() => go(index + 1)}
                  />
                )}
              </button>
            ))}
          </div>
          <button type="button" className="pdp-arrow" aria-label="Next photo" onClick={() => go(index + 1)}>&rarr;</button>
        </div>
      )}
    </div>
  );
}
