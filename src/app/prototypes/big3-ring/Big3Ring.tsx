'use client';

import { useRef, useState } from 'react';
import { ASC_STYLES, SUN_STYLES, MOON_STYLES } from '@/modules/prototypes/big3-ring';
import RingStage, { type RingStageHandle } from './components/RingStage';
import BirthFields from './components/BirthFields';
import StyleCycler from './components/StyleCycler';
import ViewModeToggle from './components/ViewModeToggle';
import SliderField from './components/SliderField';
import Big3Summary from './components/Big3Summary';
import { useBig3 } from './useBig3';
import { useSavedSetup } from './useSavedSetup';
import './big3-ring.css';

const DIRECTIONS = ['bottom', 'bottom left', 'left', 'top left', 'top', 'top right', 'right', 'bottom right'];
const formatDirection = (v: number) => `${DIRECTIONS[Math.round(v / 45) % 8]} · ${v}°`;

export default function Big3Ring() {
  const { birth, design, mode, ready, setBirth, setDesign, setMode } = useSavedSetup();
  const { big3, error } = useBig3(ready ? birth : null);
  const [showWheel, setShowWheel] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const stage = useRef<RingStageHandle>(null);

  // Keep the angle found by orbiting as the tilt both prototypes go to.
  const useCurrentView = () => {
    const v = stage.current?.getView();
    if (v) setDesign({ tiltDeg: Math.min(90, v.tiltDeg), tiltDir: v.tiltDir });
  };

  return (
    <div className="b3-page">
      <aside className="b3-controls">
        <h2>Big Three Ring <span className="b3-tag">prototype</span></h2>

        <ViewModeToggle value={mode} onChange={setMode} />

        <h3>Birth Details</h3>
        <BirthFields value={birth} onChange={setBirth} />
        {error && <div className="b3-error">{error}</div>}
        <Big3Summary big3={big3} />

        <h3>Markers</h3>
        <StyleCycler label="Ascendant" options={ASC_STYLES} value={design.asc} onChange={asc => setDesign({ asc })} />
        <StyleCycler label="Sun" options={SUN_STYLES} value={design.sun} onChange={sun => setDesign({ sun })} />
        <StyleCycler label="Moon" options={MOON_STYLES} value={design.moon} onChange={moon => setDesign({ moon })} />

        <h3>Ring</h3>
        <SliderField label="Band width" value={design.width} min={1.4} max={5} step={0.1} format={v => `${v.toFixed(1)} mm`} onChange={width => setDesign({ width })} />
        <SliderField label="Marker relief" value={design.relief} min={0} max={0.6} step={0.05} format={v => (v === 0 ? 'flush' : `${v.toFixed(2)} mm`)} onChange={relief => setDesign({ relief })} />
        <SliderField label="Marker size" value={design.size} min={0.7} max={1.2} step={0.05} format={v => `${Math.round(v * 100)}%`} onChange={size => setDesign({ size })} />

        <h3>View</h3>
        <p className="b3-hint">Drag the ring to orbit, scroll to zoom. Changing a marker turns the ring to face it.</p>
        <SliderField label="Tilt" value={design.tiltDeg} min={0} max={90} step={1} format={v => `${v}°`} onChange={tiltDeg => setDesign({ tiltDeg })} />
        <SliderField label="Tilt direction" value={design.tiltDir} min={0} max={359} step={1} format={formatDirection} onChange={tiltDir => setDesign({ tiltDir })} />
        <div className="b3-row">
          <button type="button" className="b3-button" onClick={useCurrentView}>Use current angle</button>
          <button type="button" className="b3-button" onClick={() => stage.current?.resetView()}>Reset view</button>
        </div>

        <div className="b3-toggles">
          <label><input type="checkbox" checked={showWheel} onChange={e => setShowWheel(e.target.checked)} /> Zodiac wheel</label>
          <label><input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} /> Labels</label>
        </div>

        <button type="button" className="b3-replay" onClick={() => stage.current?.replay()}>Replay animation</button>
      </aside>

      <main className="b3-main">
        <RingStage ref={stage} big3={big3} design={design} mode={mode} showWheel={showWheel} showLabels={showLabels} />
      </main>
    </div>
  );
}
