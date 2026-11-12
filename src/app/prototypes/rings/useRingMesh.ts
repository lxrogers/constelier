'use client';
import { useEffect, useRef, useState } from 'react';
import { createMeshQueue } from '@/modules/rings/mesh-queue.mjs';

/** One active job + one replaceable pending job. No queue grows with input rate. */
export function useRingMesh(params, family = 'wave', selection = 0) {
  const queue = useRef<((params, quality: string, family: string, selection: number) => void) | null>(null);
  const [result, setResult] = useState<any>(null);
  const [status, setStatus] = useState('Preparing your ring…');
  const [error, setError] = useState('');
  useEffect(() => {
    const worker = new Worker(new URL('./ring.worker.ts', import.meta.url));
    const scheduler = createMeshQueue({ send: job => worker.postMessage(job), publish: setResult, setStatus, setError });
    queue.current = (next, quality, nextFamily, nextSelection) => { scheduler.request(next, quality, nextFamily, nextSelection); };
    worker.onmessage = ({ data }) => scheduler.complete(data);
    worker.onerror = () => { scheduler.fail('The geometry worker failed. Reload to try again.'); worker.terminate(); };
    return () => { queue.current = null; scheduler.dispose(); worker.terminate(); };
  }, []);
  useEffect(() => {
    queue.current?.(params, 'preview', family, selection);
    const timer = setTimeout(() => queue.current?.(params, 'settled', family, selection), 220);
    return () => clearTimeout(timer);
  }, [params, family, selection]);
  // Filter synchronously during render, before effects can enqueue new work.
  // This also hides an A result during a rapid A -> B -> A selection sequence.
  const matching = result?.family === family && result?.selection === selection;
  return { result: matching ? result : null, status, error };
}

export function exportRing(params, family = 'wave'): Promise<any> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./ring.worker.ts', import.meta.url));
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('Export timed out. Try again.')); }, 30000);
    worker.onmessage = ({ data }) => {
      clearTimeout(timer); worker.terminate();
      if (data.error) reject(new Error(data.error));
      else if (data.family !== family || data.quality !== 'export') reject(new Error('Export returned a different ring family.'));
      else resolve(data);
    };
    worker.onerror = () => { clearTimeout(timer); worker.terminate(); reject(new Error('Export worker failed.')); };
    worker.postMessage({ id: 1, quality: 'export', family, params: { ...params } });
  });
}
