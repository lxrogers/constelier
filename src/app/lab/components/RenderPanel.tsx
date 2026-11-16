'use client';

import { useEffect, useState } from 'react';
import type { useRenders } from '@/hooks/useRenders';
import {
  RENDER_QUALITIES, RENDER_SCENES, renderImageUrl,
  type RenderJob, type RenderQuality, type RenderScene,
} from '@/lib/lab-render';
import RenderViewer from './RenderViewer';

export type SceneChoice = RenderScene | 'both';

interface Props {
  renders: ReturnType<typeof useRenders>;
  scene: SceneChoice;
  quality: RenderQuality;
  onScene: (s: SceneChoice) => void;
  onQuality: (q: RenderQuality) => void;
  onRenderMain: () => string | null;      // returns an error message, if any
}

const sceneLabel = (s: RenderScene) => RENDER_SCENES.find((x) => x.id === s)?.label ?? s;

function elapsed(job: RenderJob, now: number) {
  const s = Math.max(0, Math.round(((job.finishedAt ?? now) - job.startedAt) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

export default function RenderPanel({ renders, scene, quality, onScene, onQuality, onRenderMain }: Props) {
  const { jobs, available } = renders;
  const [viewing, setViewing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const active = jobs.some((j) => j.status === 'building' || j.status === 'rendering');
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  const viewed = jobs.find((j) => j.id === viewing && j.status === 'done');

  return (
    <section className="lab-card lab-renders">
      <div className="lab-renders-head">
        <h2>Photo renders <span className="lab-count">{jobs.length}</span></h2>
        <div className="lab-renders-controls">
          <label>
            Scene
            <select value={scene} onChange={(e) => onScene(e.target.value as SceneChoice)}>
              {RENDER_SCENES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              <option value="both">Both</option>
            </select>
          </label>
          <label>
            Quality
            <select value={quality} onChange={(e) => onQuality(e.target.value as RenderQuality)}>
              {RENDER_QUALITIES.map((q) => <option key={q.id} value={q.id}>{q.label} ({q.hint})</option>)}
            </select>
          </label>
          <button type="button" className="lab-btn primary" disabled={!available}
            onClick={() => setError(onRenderMain())}>
            Render main preview
          </button>
          <button type="button" className="lab-btn" disabled={!jobs.length} onClick={renders.clear}>Clear</button>
        </div>
      </div>
      {available === false && (
        <p className="lab-msg error">
          Renders are off: set RENDER_API_URL, RENDER_API_KEY and RENDER_API_SECRET in .env.local and restart the dev server.
        </p>
      )}
      {error && <p className="lab-msg error">{error}</p>}
      {jobs.length === 0 ? (
        <p className="lab-empty">
          Render the main preview from here, or any sample chart with its Render button. Each render uses the settings on screen when you press it.
        </p>
      ) : (
        <ul className="lab-render-list">
          {jobs.map((j) => (
            <li key={j.id} className="lab-render">
              {j.status === 'done' ? (
                <button type="button" className="lab-render-image" onClick={() => setViewing(j.id)} aria-label={`View ${j.label}`}>
                  <img src={renderImageUrl(j)} alt={`${j.label}, ${sceneLabel(j.scene)}`} loading="lazy" />
                </button>
              ) : (
                <div className={`lab-render-image ${j.status}`}>
                  <span>
                    {j.status === 'building' && 'Building mesh…'}
                    {j.status === 'rendering' && `Rendering… ${elapsed(j, now)}`}
                    {j.status === 'failed' && (j.error || 'Failed')}
                  </span>
                </div>
              )}
              <div className="lab-render-info">
                <span>{j.label}</span>
                <span className="lab-sample-meta">
                  {sceneLabel(j.scene)} · {j.quality}{j.status === 'done' ? ` · ${elapsed(j, now)}` : ''}
                </span>
              </div>
              <button type="button" className="lab-mini" onClick={() => renders.remove(j.id)} aria-label="Remove">✕</button>
            </li>
          ))}
        </ul>
      )}
      {viewed && <RenderViewer job={viewed} sceneLabel={sceneLabel(viewed.scene)} onClose={() => setViewing(null)} />}
    </section>
  );
}
