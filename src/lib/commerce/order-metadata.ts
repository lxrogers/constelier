import 'server-only';
import { createHash } from 'node:crypto';
import type { PendantDesign } from './design';
import type { Quote } from './pricing';

// Each line item's Stripe product carries `design_id`, `metal` and
// `est_grams`. With a database (DATABASE_URL set) that is all: the design,
// with its birth date, time and place, is saved in our own designs table when
// checkout starts, because Stripe advises against personal data in metadata.
//
// Without a database the full design rides along in metadata as before, so a
// paid order can still be rebuilt from Stripe alone. Stripe allows 50 keys of
// up to 500 characters each.

const CHUNK = 490;

export function designId(design: PendantDesign) {
  return 'dsn_' + createHash('sha256').update(JSON.stringify(design)).digest('hex').slice(0, 16);
}

export function encodeDesignMetadata(
  design: PendantDesign,
  quote: Quote,
  { includeDesign }: { includeDesign: boolean },
): Record<string, string> {
  const base: Record<string, string> = {
    design_id: designId(design),
    metal: quote.metal,
    est_grams: quote.grams.toFixed(2),
  };
  if (!includeDesign) return base;

  const { spec, geometry } = design;
  const specJson = JSON.stringify({
    b: { ...spec.birth, location: spec.birth.location.slice(0, 80) },
    a: spec.aspects,
    o: spec.outlineStyle,
    q: spec.liquidity,
    bt: spec.borderThickness,
    lt: spec.lineThickness,
    fr: spec.filletRadius,
    r: geometry.circleRadius,
    ma: geometry.minArea,
    mg: geometry.minAngle,
  });
  const chords = geometry.chords.map((c) => `${c.a1.toFixed(6)},${c.a2.toFixed(6)}`).join(';');
  const meta: Record<string, string> = { ...base, spec: specJson.slice(0, 500) };
  for (let i = 0, n = 0; i < chords.length; i += CHUNK, n++) {
    meta[`chords_${n}`] = chords.slice(i, i + CHUNK);
  }
  if (Object.keys(meta).length > 50) throw new Error('design too large for metadata');
  return meta;
}

export function decodeDesignMetadata(meta: Record<string, string>): PendantDesign | null {
  try {
    const s = JSON.parse(meta.spec);
    let chordStr = '';
    for (let n = 0; meta[`chords_${n}`] !== undefined; n++) chordStr += meta[`chords_${n}`];
    const chords = chordStr.split(';').filter(Boolean).map((p) => {
      const [a1, a2] = p.split(',').map(Number);
      return { a1, a2 };
    });
    return {
      spec: {
        birth: s.b, aspects: s.a, outlineStyle: s.o, liquidity: s.q,
        borderThickness: s.bt, lineThickness: s.lt, filletRadius: s.fr,
      },
      geometry: { chords, circleRadius: s.r, minArea: s.ma, minAngle: s.mg },
    };
  } catch {
    return null;
  }
}
