'use client';
import { useEffect, useRef, useState } from 'react';
import { defaults, limits, presets } from '@/modules/prototypes/sun-arcs-params';
import Outline from './Outline';
import useDebouncedMesh from './useDebouncedMesh';
import './prototype.css';
export default function SunArcs() {
  const [params, setParams] = useState(defaults);
  const [ready, setReady] = useState(false), [viewerError, setViewerError] = useState('');
  const [exporting, setExporting] = useState(false), [exportStatus, setExportStatus] = useState('');
  const { mesh, status } = useDebouncedMesh(params);
  const container = useRef<HTMLDivElement>(null), viewer = useRef<any>(null), alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    let instance;
    let observer: ResizeObserver;
    let redraw: () => void;
    let frame = 0;
    import('@/modules/three-pendant-viewer').then(async ({ PendantViewer }) => {
      if (cancelled) return;
      instance = viewer.current = new PendantViewer(container.current, { hdriPath: '/softbox.hdr', enableGroundPlane: false, enablePostProcessing: true, enableEdges: false, roughness: 0, background: null });
      // Match the core chart's polished gold and studio reflection orientation.
      instance.scene.background = null;
      instance.scene.environmentRotation.set(344 * Math.PI / 180, 308 * Math.PI / 180, 0);
      await instance.hdriReady;
      if (cancelled) { instance._hdrTexture?.dispose(); return; }
      // Core studio lights/shadow cameras are sized for a ~600-unit model.
      // Display-only scale: CAD and STL dimensions remain in millimetres.
      instance.pendantGroup.scale.setScalar(20);
      instance.addShadowPlane(-28);
      instance.controls.enableDamping = false;
      redraw = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; if (!cancelled) instance.renderOnce(); }); };
      instance.controls.addEventListener('change', redraw);
      observer = new ResizeObserver(() => {
        instance.resize();
        if (instance.pendantGroup.children.length) {
          instance.camera.fov = 2 * Math.atan((400 / Math.min(1, instance.camera.aspect)) / 2000) * 180 / Math.PI;
          instance.camera.updateProjectionMatrix();
        }
        instance.renderOnce();
      });
      observer.observe(container.current);
      viewer.current.start();
      setReady(true);
    }).catch(e => { if (!cancelled) { setViewerError(`Viewer unavailable: ${e.message}`); } });
    return () => { cancelled = true; alive.current = false; cancelAnimationFrame(frame); observer?.disconnect(); instance?.controls?.removeEventListener('change', redraw); instance?.controls?.dispose(); instance?._shadowPlane?.geometry.dispose(); instance?._shadowPlane?.material.dispose(); instance?._hdrTexture?.dispose(); instance?.composer?.passes.forEach(pass => pass.dispose?.()); instance?.composer?.dispose(); instance?.dispose(); instance?.renderer.domElement.remove(); };
  }, []);
  useEffect(() => {
    if (!ready || !mesh) return;
    const v = viewer.current;
    v.updateMeshFromData(mesh);
    const half = 400 / Math.min(1, v.camera.aspect);
    v.camera.fov = 2 * Math.atan(half / 2000) * 180 / Math.PI;
    v.camera.position.set(0, 2000, 0);
    v.controls.target.set(0, 0, 0);
    v.camera.updateProjectionMatrix();
    v.controls.update();
    v.setShadowPlaneY(-mesh.params.depth * 20 - 4);
    v.renderOnce();
  }, [mesh, ready]);

  async function exportSTL() {
    setExporting(true); setExportStatus('Exporting current parameters…');
    try {
      const response = await fetch('/api/prototypes/sun-arcs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...params, export: 'stl' }) });
      if (!response.ok) throw new Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob()), a = document.createElement('a');
      a.href = url; a.download = 'sun-arcs.stl'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (alive.current) setExportStatus('STL exported from parameters at click time');
    } catch (error) { if (alive.current) setExportStatus(error.message); }
    finally { if (alive.current) setExporting(false); }
  }

  return <main className="sun-prototype">
    <header><small>EXPERIMENTAL / 01</small><h1>Sun & arcs</h1><p>Shape the outline live. The gold preview follows after a short pause.</p></header>
    <section className="sun-layout">
      <aside>
        <div className="sun-presets">{Object.entries(presets).map(([name, value]) => <button key={name} onClick={() => setParams({ ...value })}>{name}</button>)}</div>
        {Object.entries(limits).map(([key, [min, max, step]]) => <label key={key}>{key} <output>{params[key]}{['stroke','spacing','depth'].includes(key) ? ' mm' : ''}</output><input aria-label={key} type="range" min={min} max={max} step={step} value={params[key]} onChange={e => setParams({ ...params, [key]: Number(e.target.value) })} /></label>)}
        <button disabled={exporting} onClick={exportSTL}>Export current parameters · STL</button>
        <button onClick={() => setParams({ ...defaults })}>Reset defaults</button>
        <p role="status">{viewerError || (!ready ? 'Loading studio lighting…' : status)}</p><p aria-live="polite">{exportStatus}</p>
        <p className="sun-note">30 mm diameter · 0.65 mm rim. Prototype only: no bail, fillets, casting allowance or minimum-feature certification. Dense settings can close gaps; disconnected islands must be checked before fabrication.</p>
      </aside>
      <div>
        <Outline params={params} />
        <div ref={container} className="sun-view" aria-label="Interactive gold pendant preview" data-mesh-params={mesh ? JSON.stringify(mesh.params) : ''} />
        <p>{status === '3D is up to date' ? '3D preview · drag to orbit · scroll to zoom' : 'Previous 3D preview shown while the new outline is built'}</p>
      </div>
    </section>
  </main>;
}
