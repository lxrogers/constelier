'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildPendantSTL, checkRender, submitRender, RENDERS_KEY,
  type RenderJob, type RenderQuality, type RenderScene,
} from '@/lib/lab-render';
import type { PendantParams } from '@/config/pendant-params';
import type { Chord } from '@/lib/natal-chords';

const POLL_MS = 4000;
const tick = () => new Promise((r) => setTimeout(r, 30));

// The lab's photo renders: starts them, polls until each image exists, and
// keeps the list in localStorage (the API keeps finished images for 7 days).
export function useRenders() {
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  const commit = useCallback((fn: (prev: RenderJob[]) => RenderJob[]) => {
    setJobs((prev) => {
      const next = fn(prev);
      try { localStorage.setItem(RENDERS_KEY, JSON.stringify(next.filter((j) => j.remoteId))); } catch {}
      return next;
    });
  }, []);
  const patch = useCallback((id: string, change: Partial<RenderJob>) => {
    commit((prev) => prev.map((j) => (j.id === id ? { ...j, ...change } : j)));
  }, [commit]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RENDERS_KEY);
      if (raw) setJobs(JSON.parse(raw));
    } catch {}
    fetch('/api/lab/render').then((r) => r.json()).then((d) => setAvailable(!!d?.available)).catch(() => setAvailable(false));
  }, []);

  // One pendant, one or more scenes: the STL is built once and sent per scene.
  const start = useCallback(async (label: string, params: PendantParams, chords: Chord[], scenes: RenderScene[], quality: RenderQuality) => {
    const fresh: RenderJob[] = scenes.map((scene) => ({
      id: Math.random().toString(36).slice(2, 10), label, scene, quality, status: 'building', startedAt: Date.now(),
    }));
    commit((prev) => [...fresh, ...prev]);
    await tick();                       // let the tiles paint before the mesh build blocks
    let stl: ArrayBuffer;
    try {
      stl = buildPendantSTL(params, chords);
    } catch (e) {
      fresh.forEach((j) => patch(j.id, { status: 'failed', error: 'Could not build the mesh: ' + (e as Error).message }));
      return;
    }
    await Promise.all(fresh.map(async (j) => {
      try {
        patch(j.id, { remoteId: await submitRender(stl, j.scene, quality), status: 'rendering' });
      } catch (e) {
        patch(j.id, { status: 'failed', error: (e as Error).message });
      }
    }));
  }, [commit, patch]);

  const rendering = jobs.some((j) => j.status === 'rendering');
  useEffect(() => {
    if (!rendering) return;
    let busy = false;
    const timer = setInterval(async () => {
      if (busy) return;
      busy = true;
      for (const j of jobsRef.current.filter((x) => x.status === 'rendering' && x.remoteId)) {
        try {
          if (await checkRender(j.remoteId!) === 'done') patch(j.id, { status: 'done', finishedAt: Date.now() });
        } catch (e) {
          patch(j.id, { status: 'failed', error: (e as Error).message });
        }
      }
      busy = false;
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [rendering, patch]);

  const remove = useCallback((id: string) => commit((prev) => prev.filter((j) => j.id !== id)), [commit]);
  const clear = useCallback(() => commit(() => []), [commit]);

  return { jobs, available, start, remove, clear };
}
