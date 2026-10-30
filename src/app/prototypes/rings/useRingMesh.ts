'use client';
import { useEffect, useRef, useState } from 'react';

/** One active job + one replaceable pending job. No queue grows with input rate. */
export function useRingMesh(params) {
  const queue = useRef<((params, quality: string) => void) | null>(null);
  const [result, setResult] = useState<any>(null);
  const [status, setStatus] = useState('Preparing your ring…');
  const [error, setError] = useState('');
  useEffect(() => {
    const worker = new Worker(new URL('./ring.worker.ts', import.meta.url));
    let active = false, pending = null, latest = 0, closed = false;
    const send = job => { active = true; worker.postMessage(job); };
    queue.current = (next, quality) => {
      const job = { id: ++latest, params: next, quality };
      if (active) pending = job; else send(job);
      setStatus(quality === 'preview' ? 'Shaping…' : 'Checking your ring…');
    };
    worker.onmessage = ({ data }) => {
      if (closed) return;
      active = false;
      if (data.id === latest) {
        if (data.error) { setError(data.error); setStatus('Shape rejected'); }
        else {
          setResult(data); setError('');
          setStatus(data.quality === 'settled' ? 'Ready' : 'Live preview');
        }
      }
      if (pending) { const job = pending; pending = null; send(job); }
    };
    worker.onerror = () => { setError('The geometry worker could not start. Reload to try again.'); setStatus('Unavailable'); };
    return () => { closed = true; queue.current = null; worker.terminate(); };
  }, []);
  useEffect(() => {
    queue.current?.(params, 'preview');
    const timer = setTimeout(() => queue.current?.(params, 'settled'), 220);
    return () => clearTimeout(timer);
  }, [params]);
  return { result, status, error };
}

export function exportRing(params): Promise<any> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./ring.worker.ts', import.meta.url));
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('Export timed out. Try again.')); }, 30000);
    worker.onmessage = ({ data }) => { clearTimeout(timer); worker.terminate(); if (data.error) reject(new Error(data.error)); else resolve(data); };
    worker.onerror = () => { clearTimeout(timer); worker.terminate(); reject(new Error('Export worker failed.')); };
    worker.postMessage({ id: 1, quality: 'export', params });
  });
}
