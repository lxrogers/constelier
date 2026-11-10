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

export default function Big3Ring() {
  const { birth, design, mode, ready, setBirth, setDesign, setMode } = useSavedSetup();
  const { big3, error } = useBig3(ready ? birth : null);
  const [showWheel, setShowWheel] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const stage = useRef<RingStageHandle>(null);

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
        <SliderField label="Band width" value={design.width} min={1.6} max={5} step={0.1} format={v => `${v.toFixed(1)} mm`} onChange={width => setDesign({ width })} />
        <SliderField label="Marker size" value={design.size} min={0.7} max={1.2} step={0.05} format={v => `${Math.round(v * 100)}%`} onChange={size => setDesign({ size })} />
        <SliderField label="Tilt" value={design.tiltDeg} min={30} max={75} step={1} format={v => `${v}°`} onChange={tiltDeg => setDesign({ tiltDeg })} />

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
