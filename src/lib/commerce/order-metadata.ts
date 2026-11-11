import 'server-only';
import { createHash } from 'node:crypto';
import type { PendantDesign } from './design';
import type { Quote } from './pricing';

// Until there is an orders database, each line item's Stripe product carries
// its full design in metadata, so a paid order can be rebuilt from Stripe
// alone. Stripe allows 50 keys of up to 500 characters each.
//
// TODO: move designs to our own database and keep only `design_id` here.
// Birth date and place are personal data and Stripe advises against PII in metadata.

const CHUNK = 490;

export function designId(design: PendantDesign) {
  return 'dsn_' + createHash('sha256').update(JSON.stringify(design)).digest('hex').slice(0, 16);
}

export function encodeDesignMetadata(design: PendantDesign, quote: Quote): Record<string, string> {
  const { spec, geometry } = design;
  const specJson = JSON.stringify({
    b: { ...spec.birth, location: spec.birth.location.slice(0, 80) },
    a: spec.aspects,
    o: spec.outlineStyle,
    q: spec.liquidity,
    bt: spec.borderThickness,
    lt: spec.lineThickness,
    fr: spec.filletRadius,
    th: spec.thickness,
    ef: spec.edgeFillet,
    rr: spec.rimRoundness,
    mm: spec.diameterMm,
    bl: spec.bailEnabled ? [spec.bailInnerMm, spec.bailBand, spec.bailGapMm, spec.bailBlend] : undefined,
    r: geometry.circleRadius,
    ma: geometry.minArea,
    mg: geometry.minAngle,
  });
  const chords = geometry.chords.map((c) => `${c.a1.toFixed(6)},${c.a2.toFixed(6)}`).join(';');
  const meta: Record<string, string> = {
    design_id: designId(design),
    metal: quote.metal,
    est_grams: quote.grams.toFixed(2),
    spec: specJson.slice(0, 500),
  };
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
        thickness: s.th, edgeFillet: s.ef, rimRoundness: s.rr, diameterMm: s.mm,
        ...(Array.isArray(s.bl) ? {
          bailEnabled: true,
          bailInnerMm: s.bl[0], bailBand: s.bl[1], bailGapMm: s.bl[2], bailBlend: s.bl[3],
        } : {}),
      },
      geometry: { chords, circleRadius: s.r, minArea: s.ma, minAngle: s.mg },
    };
  } catch {
    return null;
  }
}
