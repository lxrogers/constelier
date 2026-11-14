'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RingStudio } from '@/modules/rings/studio';

export default function RingCanvas({ result, material, view, onLighting, onError }) {
  const host = useRef<HTMLDivElement>(null), studio = useRef<RingStudio>(null);
  const [ready, setReady] = useState(false);
  const callbacks = useRef({ onLighting, onError });
  callbacks.current = { onLighting, onError };
  useEffect(() => {
    let cancelled = false;
    import('@/modules/rings/studio').then(({ RingStudio }) => {
      if (cancelled) return;
      studio.current = new RingStudio(host.current, s => callbacks.current.onLighting(s));
      // Read-only instrumentation for reproducible browser/performance checks.
      (window as any).__ringStudio = { diagnostics: () => studio.current?.diagnostics() };
      setReady(true);
    }).catch(error => callbacks.current.onError(error.message));
    return () => { cancelled = true; studio.current?.dispose(); studio.current = null; delete (window as any).__ringStudio; };
  }, []);
  useLayoutEffect(() => {
    if (!ready) return;
    if (result?.mesh) studio.current.update(result.mesh, result.id, result.selection);
    else studio.current.clear();
  }, [result, ready]);
  useEffect(() => { if (ready) studio.current.setMaterial(material); }, [material, ready]);
  useEffect(() => { if (ready) studio.current.view(view.direction); }, [view, ready]);
  return <div ref={host} className="ring-canvas" data-testid="ring-canvas" data-mesh-family={result?.family || ''} data-selection={result?.selection ?? ''} data-mesh-params={result ? JSON.stringify(result.mesh.params) : ''} data-quality={result?.quality || ''} data-triangles={result?.report.triangleCount || 0} />;
}
