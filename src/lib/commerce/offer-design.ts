// The design that goes in the bag for an offer. Until offers carry the
// maker's own settings per size, it is the customer's configurator design
// (or one built from the birth details with the default settings), made at
// the chosen diameter.
import { PENDANT_DEFAULTS, withDerived } from '@/config/pendant-params';
import { chordsForBirth } from '@/lib/natal-chords';
import type { PendantDesign } from './design';
import type { PendantOffer } from './offer';

export function designForOffer(offer: PendantOffer, mm: number, own?: PendantDesign | null): PendantDesign | null {
  if (own) return { ...own, spec: { ...own.spec, diameterMm: mm } };
  const b = offer.birth;
  if (!b) return null;
  const p = withDerived({ ...PENDANT_DEFAULTS, diameterMm: mm });
  const aspects = offer.aspects ?? p.aspects;
  const chords = chordsForBirth(b, aspects).map((c) => ({ a1: c.a1, a2: c.a2 }));
  if (!chords.length) return null;
  return {
    spec: {
      birth: {
        year: String(b.year), month: String(b.month), day: String(b.day),
        hour: String(b.hour), minute: String(b.minute),
        lat: b.lat, lon: b.lon, location: offer.birthPlace ?? '',
      },
      aspects: [...aspects].sort(),
      outlineStyle: p.outlineStyle,
      liquidity: p.liquidity,
      borderThickness: p.borderThickness,
      lineThickness: p.lineThickness,
      filletRadius: p.filletRadius,
      thickness: p.thickness,
      edgeFillet: p.edgeFillet,
      rimRoundness: p.rimRoundness,
      diameterMm: mm,
      bailEnabled: p.bailEnabled,
      bailInnerMm: p.bailInnerMm,
      bailBand: p.bailBand,
      bailGapMm: p.bailGapMm,
      bailBlend: p.bailBlend,
    },
    geometry: { chords, circleRadius: 100, minArea: p.minArea, minAngle: p.minAngle },
  };
}
