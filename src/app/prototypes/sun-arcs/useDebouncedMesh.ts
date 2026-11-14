import { useEffect, useRef, useState } from 'react';

export default function useDebouncedMesh(params) {
  const [mesh, setMesh] = useState<any>(null);
  const [status, setStatus] = useState('Waiting to generate 3D…');
  const latest = useRef(params), revision = useRef(0), running = useRef(false), due = useRef(false), mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    latest.current = params;
    revision.current++;
    due.current = false;
    setStatus('2D updated · waiting for changes to settle…');
    // One request at a time. Coalesce edits made while CAD is running.
    async function run() {
      if (running.current || !mounted.current) return;
      running.current = true;
      due.current = false;
      const currentRevision = revision.current;
      setStatus('Generating 3D · live outline remains editable…');
      try {
        const response = await fetch('/api/prototypes/sun-arcs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(latest.current) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Generation failed');
        if (mounted.current && currentRevision === revision.current) {
          setMesh(data);
          setStatus('3D is up to date');
        }
      } catch (error) {
        if (mounted.current && currentRevision === revision.current) setStatus(`3D failed: ${error.message}. Adjust a parameter to retry.`);
      } finally {
        running.current = false;
        if (mounted.current && due.current) run();
      }
    }
    const timer = setTimeout(() => { due.current = true; run(); }, 800);
    return () => clearTimeout(timer);
  }, [params]);
  return { mesh, status };
}
