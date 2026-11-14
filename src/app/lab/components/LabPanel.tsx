'use client';

import { useState } from 'react';
import { PENDANT_SIZES } from '@/config/pendant-sizes';
import ParamControl from '@/components/params/ParamControl';
import {
  PARAMS, PARAM_GROUPS, paramEquals, mmPerUnit,
  type ParamKey, type PendantParams,
} from '@/config/pendant-params';

interface Props {
  params: PendantParams;
  saved: PendantParams;
  canWrite: boolean;
  onChange: (next: Partial<PendantParams>, draft: boolean) => void;
  onSave: (values: Partial<PendantParams>) => Promise<void>;
  randomSamples: boolean;
  onNewSamples: () => void;
  onStandardSamples: () => void;
}

export default function LabPanel({ params, saved, canWrite, onChange, onSave, randomSamples, onNewSamples, onStandardSamples }: Props) {
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const changedKeys = PARAMS.map((d) => d.key).filter((k) => !paramEquals(params, saved, k));

  async function save(keys: ParamKey[]) {
    if (!keys.length) return;
    try {
      await onSave(Object.fromEntries(keys.map((k) => [k, params[k]])));
      setMsg({ text: keys.length === 1 ? `Saved ${keys[0]} as default` : `Saved ${keys.length} defaults` });
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true });
    }
  }

  function revert(keys: ParamKey[]) {
    onChange(Object.fromEntries(keys.map((k) => [k, saved[k]])), false);
  }

  const mm = mmPerUnit(params);

  return (
    <aside className="lab-panel">
      <div className="lab-panel-head">
        <h2>Lab settings</h2>
        <p className="lab-panel-sub">
          {changedKeys.length ? `${changedKeys.length} changed from defaults` : 'Matches saved defaults'}
        </p>
        <div className="lab-panel-actions">
          <button type="button" className="lab-btn primary" disabled={!changedKeys.length || !canWrite}
            onClick={() => save(changedKeys)}>Save all as defaults</button>
          <button type="button" className="lab-btn" disabled={!changedKeys.length}
            onClick={() => revert(changedKeys)}>Revert</button>
        </div>
        <p className="lab-panel-sub">Drag the 3D view to orbit, scroll to zoom, double-click to reset. The samples follow the angle.</p>
        <div className="lab-panel-actions">
          <button type="button" className="lab-btn" onClick={onNewSamples}>Generate 4 new pendants</button>
          {randomSamples && <button type="button" className="lab-btn" onClick={onStandardSamples}>Standard samples</button>}
        </div>
        {!canWrite && <p className="lab-msg error">Saving defaults only works under npm run dev.</p>}
        {msg && <p className={`lab-msg${msg.error ? ' error' : ''}`}>{msg.text}</p>}
      </div>

      {PARAM_GROUPS.map((group) => {
        const defs = PARAMS.filter((d) => d.group === group && (!d.showIf || d.showIf(params)));
        if (!defs.length) return null;
        return (
          <section key={group} className="lab-group">
            <h3>{group}</h3>
            {group === 'Size' && (
              <div className="lab-panel-actions">
                {PENDANT_SIZES.map((sz) => (
                  <button key={sz.id} type="button"
                    className={`lab-btn${params.diameterMm === sz.diameterMm && params.thicknessMm === sz.thicknessMm ? ' primary' : ''}`}
                    onClick={() => onChange({ diameterMm: sz.diameterMm, thicknessMm: sz.thicknessMm }, false)}>
                    {sz.label} {sz.diameterMm} mm
                  </button>
                ))}
              </div>
            )}
            {group === 'Size' && (
              <p className="lab-derived">
                {params.thicknessMm < 1 || params.barWidthMm < 0.8
                  ? `Thinner than casting usually allows (about 1.0 mm thick, 0.8 mm bars).`
                  : `Inner circle ${(params.diameterMm - 2 * params.rimWidthMm).toFixed(1)} mm across. Castable sizes.`}
              </p>
            )}
            {group === 'Bail' && params.bailEnabled && (
              <p className="lab-derived">
                Band {(params.bailBand * params.borderThickness * mm).toFixed(2)} mm · loop outer diameter {(params.bailInnerMm + 2 * params.bailBand * params.borderThickness * mm).toFixed(2)} mm
              </p>
            )}
            {defs.map((def) => {
              const dirty = !paramEquals(params, saved, def.key);
              return (
                <ParamControl key={def.key} def={def} value={params[def.key]}
                  onChange={(v, d) => onChange({ [def.key]: v } as Partial<PendantParams>, d)}
                  badge={dirty ? <span className="lab-dirty" title={`Default: ${JSON.stringify(saved[def.key])}`} /> : null}
                  actions={dirty ? (
                    <>
                      <button type="button" className="lab-mini" title="Revert to default" onClick={() => revert([def.key])}>↺</button>
                      <button type="button" className="lab-mini" title="Make this the default" disabled={!canWrite}
                        onClick={() => save([def.key])}>Set default</button>
                    </>
                  ) : null}
                />
              );
            })}
          </section>
        );
      })}
    </aside>
  );
}
