'use client';
import { useEffect, useRef, useState } from 'react';
import { PENDANT_DEFAULTS } from '@/config/pendant-params';
import type { LabSample } from '@/config/lab-samples';
import { chordsForBirth } from '@/lib/natal-chords';
import { outlineParamsFor } from '@/lib/print-cart';
import { buildPreview, meshOptionsFor, pendantExtent } from '@/modules/pendant-build';
import type { Curve, RevealPlay, ShaderStage, StageOptions, StageStats } from './shader-stage-engine';

// Owns the Three.js stage: builds the sample's pendant with the saved default
// settings, hands it to the engine, and reports frame rate back.
export function useShaderStage(sample: LabSample, options: StageOptions) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<ShaderStage | null>(null);
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<StageStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false, timer = 0;
    import('./shader-stage-engine').then(({ ShaderStage }) => {
      if (cancelled || !host.current) return;
      stage.current = new ShaderStage(host.current);
      (window as any).__shaderStage = stage.current;   // for measuring from the console
      timer = window.setInterval(() => stage.current && setStats(stage.current.stats()), 500);
      setReady(true);
    }).catch((e) => setError(String(e?.message || e)));
    return () => { cancelled = true; clearInterval(timer); stage.current?.dispose(); stage.current = null; delete (window as any).__shaderStage; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      const p = PENDANT_DEFAULTS, opts = meshOptionsFor(p);
      const { mesh } = buildPreview(outlineParamsFor(p, chordsForBirth(sample, p.aspects)), opts);
      stage.current.setMesh({
        vertices: mesh.vertices, normals: mesh.normals, triangles: mesh.triangles,
        thickness: opts.thickness, edgeRound: mesh.filletR, rimRound: mesh.outerFilletR, rimDrop: opts.outerFilletZ, rimWidth: p.borderThickness, extent: pendantExtent(opts, p.borderThickness),
      });
      setError('');
    } catch (e) { setError(String(e?.message || e)); }
  }, [sample, ready]);

  useEffect(() => { if (ready) stage.current.setOptions(options); }, [options, ready]);

  return {
    host, stats, error,
    benchmark: () => stage.current?.benchmark() ?? 0,
    setCurve: (c: Curve) => stage.current?.setCurve(c),
    playReveal: (play: RevealPlay) => stage.current?.playReveal(play),
  };
}
