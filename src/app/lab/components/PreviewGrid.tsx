'use client';

import { usePendantGrid } from '@/hooks/usePendantGrid';
import type { LabSample } from '@/config/lab-samples';
import type { PendantParams } from '@/config/pendant-params';
import type { PrintItem } from '@/lib/print-cart';
import type { Chord } from '@/lib/natal-chords';

interface Props {
  samples: LabSample[];
  params: PendantParams;
  draft: boolean;
  onAddToCart: (item: Omit<PrintItem, 'id' | 'addedAt'>) => void;
  onRender: (label: string, chords: Chord[]) => void;
  canRender: boolean;
}

export default function PreviewGrid({ samples, params, draft, onAddToCart, onRender, canRender }: Props) {
  const { canvases, status, chords, thumbnail } = usePendantGrid(samples, params, draft);

  return (
    <section className="lab-card lab-grid-wrap">
      <h2>Sample charts</h2>
      <div className="lab-grid">
        {samples.map((s, i) => {
          const st = status[i];
          return (
            <figure key={s.id} className="lab-sample">
              <div className="lab-sample-canvas">
                <canvas ref={(el) => { canvases.current[i] = el; }} width={560} height={560} />
                {st?.state === 'building' && <span className="lab-sample-status">building…</span>}
                {st?.state === 'empty' && <span className="lab-sample-status">no aspects</span>}
                {st?.state === 'error' && <span className="lab-sample-status">build failed</span>}
              </div>
              <figcaption>
                <span>{s.label}</span>
                <span className="lab-sample-meta">
                  {chords[i]?.length ?? 0} chords{st?.ms != null ? ` · ${Math.round(st.ms)} ms` : ''}
                </span>
              </figcaption>
              <div className="lab-sample-actions">
              <button type="button" className="lab-btn" disabled={!chords[i]?.length}
                onClick={() => onAddToCart({
                  label: s.label.split(' (')[0],
                  params: { ...params, aspects: [...params.aspects] },
                  chords: chords[i],
                  birth: { year: s.year, month: s.month, day: s.day, hour: s.hour, minute: s.minute, lat: s.lat, lon: s.lon },
                  thumbnail: thumbnail(i),
                })}>
                + Print cart
              </button>
              <button type="button" className="lab-btn" disabled={!canRender || !chords[i]?.length}
                onClick={() => onRender(s.label.split(' (')[0], chords[i])}>
                Render
              </button>
              </div>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
