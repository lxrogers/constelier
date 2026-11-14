// Every tunable pendant setting in one place. The production configurator
// and the lab (/lab) both render from this list, and both start from the
// saved defaults in pendant-defaults.json, which the lab writes back to.
//
// To expose a setting to customers on /chart, set `prod: true` on it.

import savedDefaults from './pendant-defaults.json';

export const ASPECT_KEYS = ['opposition', 'trine', 'square', 'sextile', 'conjunction'] as const;
export type AspectKey = (typeof ASPECT_KEYS)[number];
export type OutlineStyle = 'current' | 'liquid' | 'pebble';

export interface PendantParams {
  outlineStyle: OutlineStyle;
  liquidity: number;
  aspects: AspectKey[];
  // Physical sizes, set in the UI. Everything below in model units is derived
  // from these and diameterMm (withDerived), so a bigger pendant gets finer
  // lines rather than a uniformly scaled-up copy.
  thicknessMm: number;
  barWidthMm: number;
  rimWidthMm: number;
  edgeRoundMm: number;
  // Derived model units (inner circle r = 100), what the geometry code reads.
  lineThickness: number;
  filletRadius: number;
  minArea: number;
  minAngle: number;
  borderThickness: number;
  rimRoundness: number;
  thickness: number;
  edgeFillet: number;
  roughness: number;
  hdriRx: number;
  hdriRy: number;
  diameterMm: number;
  bailEnabled: boolean;
  bailInnerMm: number;
  bailBand: number;
  bailGapMm: number;
  bailBlend: number;
}

export type ParamKey = keyof PendantParams;

interface Base<K extends ParamKey> {
  key: K;
  label: string;
  group: ParamGroup;
  hint?: string;
  prod?: boolean;
  // Only meaningful when another setting has a given value.
  showIf?: (p: PendantParams) => boolean;
}
export interface NumberParam extends Base<ParamKey> { kind: 'number'; min: number; max: number; step: number; unit?: string }
export interface ChoiceParam extends Base<'outlineStyle'> { kind: 'choice'; options: { value: string; label: string }[] }
export interface MultiParam extends Base<'aspects'> { kind: 'multi'; options: { value: AspectKey; label: string }[] }
export interface ToggleParam extends Base<'bailEnabled'> { kind: 'toggle' }
export type ParamDef = NumberParam | ChoiceParam | MultiParam | ToggleParam;

export const PARAM_GROUPS = ['Size', 'Outline', 'Rim', 'Edges', 'Bail', 'Aspects', 'Cleanup', 'Look'] as const;
export type ParamGroup = (typeof PARAM_GROUPS)[number];

export const PARAMS: ParamDef[] = [
  { key: 'diameterMm', kind: 'number', label: 'Overall size', group: 'Size', min: 10, max: 50, step: 0.5, unit: 'mm',
    hint: 'Outer diameter of the finished pendant. Thickness, bar and rim widths stay in mm, so a bigger pendant has finer lines.' },
  { key: 'outlineStyle', kind: 'choice', label: 'Outline', group: 'Outline',
    options: [{ value: 'current', label: 'Today' }, { value: 'liquid', label: 'Liquid' }, { value: 'pebble', label: 'Pebble' }] },
  { key: 'liquidity', kind: 'number', label: 'Liquidity', group: 'Outline', min: 2, max: 30, step: 0.5,
    hint: 'Crisp bars → poured disc', showIf: (p) => p.outlineStyle === 'liquid' },
  { key: 'barWidthMm', kind: 'number', label: 'Bar width', group: 'Outline', min: 0.3, max: 2.5, step: 0.05, unit: 'mm',
    hint: 'Width of the chord bars. Casting needs about 0.8 mm; 1.0+ is sturdier.' },
  { key: 'filletRadius', kind: 'number', label: '2D corner fillet', group: 'Outline', min: 0, max: 20, step: 0.5,
    showIf: (p) => p.outlineStyle === 'current' },

  { key: 'rimWidthMm', kind: 'number', label: 'Rim width', group: 'Rim', min: 0, max: 4, step: 0.05, unit: 'mm',
    hint: 'Outer radius minus inner radius' },
  { key: 'rimRoundness', kind: 'number', label: 'Rim roundness', group: 'Rim', min: 0, max: 3, step: 0.01,
    hint: '1 = half-round profile. Above 1 the curve stretches inward into a half-ellipse (2 = reaches in one thickness). Capped by rim width.' },

  { key: 'thicknessMm', kind: 'number', label: 'Thickness', group: 'Edges', min: 0.4, max: 3, step: 0.05, unit: 'mm',
    hint: 'Casting needs about 1.0 mm; 1.2+ is sturdier.' },
  { key: 'edgeRoundMm', kind: 'number', label: 'Void edge rounding', group: 'Edges', min: 0, max: 1.5, step: 0.01, unit: 'mm',
    hint: 'Capped at half the thickness and by narrow bars' },

  { key: 'bailEnabled', kind: 'toggle', label: 'Bail', group: 'Bail',
    hint: 'Flat loop at the top for the chain, cut from the same slab: flush faces, rim-style rounded edge' },
  { key: 'bailInnerMm', kind: 'number', label: 'Hole diameter', group: 'Bail', min: 1, max: 8, step: 0.1, unit: 'mm',
    hint: 'What the chain (or jump ring) passes through', showIf: (p) => p.bailEnabled },
  { key: 'bailBand', kind: 'number', label: 'Band width', group: 'Bail', min: 0.4, max: 2.5, step: 0.05, unit: '× rim',
    hint: 'Width of the loop around the hole; 1 = same as the rim', showIf: (p) => p.bailEnabled },
  { key: 'bailGapMm', kind: 'number', label: 'Hole offset', group: 'Bail', min: 0, max: 4, step: 0.05, unit: 'mm',
    hint: 'Distance from the disc edge to the hole. Past about one band width the loop rises on a neck, whose curves widen automatically so it stays sturdy.', showIf: (p) => p.bailEnabled },
  { key: 'bailBlend', kind: 'number', label: 'Neck blend', group: 'Bail', min: 0, max: 3, step: 0.05, unit: '× rim',
    hint: 'Radius of the curve where the loop flows into the rim; 0 = sharp join', showIf: (p) => p.bailEnabled },

  { key: 'aspects', kind: 'multi', label: 'Aspects used', group: 'Aspects',
    options: [
      { value: 'opposition', label: 'Opp' }, { value: 'trine', label: 'Tri' }, { value: 'square', label: 'Sq' },
      { value: 'sextile', label: 'Sxt' }, { value: 'conjunction', label: 'Conj' },
    ] },

  { key: 'minArea', kind: 'number', label: 'Min void area', group: 'Cleanup', min: 0, max: 800, step: 5 },
  { key: 'minAngle', kind: 'number', label: 'Min void angle', group: 'Cleanup', min: 0, max: 45, step: 0.5, unit: '°' },

  { key: 'roughness', kind: 'number', label: 'Roughness', group: 'Look', min: 0, max: 1, step: 0.01 },
  { key: 'hdriRx', kind: 'number', label: 'HDRI rotate X', group: 'Look', min: 0, max: 360, step: 1, unit: '°' },
  { key: 'hdriRy', kind: 'number', label: 'HDRI rotate Y', group: 'Look', min: 0, max: 360, step: 1, unit: '°' },
];

export const PARAM_BY_KEY = Object.fromEntries(PARAMS.map((p) => [p.key, p])) as Record<ParamKey, ParamDef>;

// Model units → millimetres for a given set of params (the inner circle is
// r = 100 units; the outer edge is r + rim width).
// Model units per millimetre. The inner circle is always r = 100 units and
// the rim sits outside it, so the inner circle's real radius is what's left
// of the pendant's radius after the rim.
export function unitsPerMm(p: Pick<PendantParams, 'diameterMm' | 'rimWidthMm'>) {
  return 100 / Math.max(1, p.diameterMm / 2 - p.rimWidthMm);
}

// Fill in the model-unit fields from the mm ones. Call after any change to
// the mm fields or the diameter.
export function withDerived(p: PendantParams): PendantParams {
  const rimMm = Math.min(p.rimWidthMm, p.diameterMm / 2 - 1);
  const u = unitsPerMm({ diameterMm: p.diameterMm, rimWidthMm: rimMm });
  return {
    ...p,
    borderThickness: rimMm * u,
    lineThickness: (p.barWidthMm / 2) * u,
    thickness: p.thicknessMm * u,
    edgeFillet: p.edgeRoundMm * u,
  };
}

export function mmPerUnit(p: Pick<PendantParams, 'diameterMm' | 'borderThickness'>) {
  return p.diameterMm / (2 * (100 + p.borderThickness));
}

// Used for anything missing from the JSON file.
const FALLBACK: PendantParams = {
  outlineStyle: 'current',
  liquidity: 11,
  aspects: ['opposition', 'sextile', 'square', 'trine'],
  thicknessMm: 1.2,
  barWidthMm: 1.0,
  rimWidthMm: 1.3,
  edgeRoundMm: 0.28,
  lineThickness: 3,
  filletRadius: 5,
  minArea: 185,
  minAngle: 5,
  borderThickness: 8,
  rimRoundness: 0.9,
  thickness: 5,
  edgeFillet: 2,
  roughness: 0,
  hdriRx: 344,
  hdriRy: 308,
  diameterMm: 25,
  bailEnabled: false,
  bailInnerMm: 3,
  bailBand: 1,
  bailGapMm: 0.3,
  bailBlend: 1,
};

function snap(def: NumberParam, v: number) {
  const clamped = Math.min(def.max, Math.max(def.min, v));
  const decimals = (def.step.toString().split('.')[1] || '').length;
  return parseFloat((Math.round(clamped / def.step) * def.step).toFixed(decimals));
}

// Coerce untrusted input (JSON file, localStorage, request body) into a
// full, valid set of params. Unknown keys are dropped.
export function normalizeParams(input: unknown, base: PendantParams = FALLBACK): PendantParams {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out: PendantParams = { ...base, aspects: [...base.aspects] };
  for (const def of PARAMS) {
    const v = src[def.key];
    if (v === undefined) continue;
    if (def.kind === 'number') {
      if (typeof v === 'number' && Number.isFinite(v)) (out as unknown as Record<string, number>)[def.key] = snap(def, v);
    } else if (def.kind === 'choice') {
      if (def.options.some((o) => o.value === v)) (out as unknown as Record<string, string>)[def.key] = v as string;
    } else if (def.kind === 'toggle') {
      if (typeof v === 'boolean') out.bailEnabled = v;
    } else if (def.kind === 'multi') {
      if (Array.isArray(v)) out.aspects = ASPECT_KEYS.filter((k) => v.includes(k));
    }
  }
  return withDerived(out);
}

export const PENDANT_DEFAULTS: PendantParams = normalizeParams(savedDefaults, FALLBACK);

export function paramEquals(a: PendantParams, b: PendantParams, key: ParamKey) {
  const x = a[key], y = b[key];
  if (Array.isArray(x) && Array.isArray(y)) return x.length === y.length && x.every((v) => (y as string[]).includes(v));
  return x === y;
}

export const PROD_PARAMS = PARAMS.filter((p) => p.prod);
