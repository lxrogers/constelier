// A pendant design as it travels from the configurator to the bag, the
// checkout route and the order. `spec` is what the customer chose (enough to
// reopen the design); `geometry` is what the server prices and builds from.

export interface Chord { a1: number; a2: number }

export interface DesignSpec {
  birth: {
    year: string; month: string; day: string;
    hour: string; minute: string;
    lat: number; lon: number; location: string;
  };
  aspects: string[];
  outlineStyle: string;
  liquidity: number;
  borderThickness: number;
  lineThickness: number;
  filletRadius: number;
}

export interface DesignGeometry {
  chords: Chord[];
  circleRadius: number;
  minArea: number;
  minAngle: number;
}

export interface PendantDesign {
  spec: DesignSpec;
  geometry: DesignGeometry;
}

export interface BagItem {
  id: string;
  design: PendantDesign;
  title: string;
  subtitle: string;
  thumbnail: string | null;
  // Display only. Checkout re-prices every item on the server.
  unitAmount: number;
  quantity: number;
  addedAt: number;
}

export const MAX_BAG_ITEMS = 10;
export const MAX_QUANTITY = 5;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

export function describeDesign(spec: DesignSpec) {
  const { birth } = spec;
  const month = MONTHS[parseInt(birth.month, 10) - 1] || birth.month;
  const place = birth.location.split(',')[0].trim();
  return {
    title: 'Aspect Pendant',
    subtitle: `${month} ${parseInt(birth.day, 10)}, ${birth.year}${place ? ' · ' + place : ''}`,
  };
}

// Reopens the configurator on this design (same params the chart page syncs to its URL).
export function designQuery(spec: DesignSpec) {
  const p = new URLSearchParams();
  p.set('y', spec.birth.year);
  p.set('m', spec.birth.month);
  p.set('d', spec.birth.day);
  p.set('h', spec.birth.hour);
  p.set('mi', spec.birth.minute);
  p.set('lat', String(spec.birth.lat));
  p.set('lon', String(spec.birth.lon));
  p.set('loc', spec.birth.location);
  p.set('a', [...spec.aspects].sort().join(','));
  if (spec.outlineStyle !== 'current') p.set('outline', spec.outlineStyle);
  if (spec.outlineStyle === 'liquid') p.set('liq', String(spec.liquidity));
  return p.toString();
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown, max = 120) => typeof v === 'string' && v.length <= max;

// Validates an untrusted design from a request body. Returns null if invalid.
export function parseDesign(input: unknown): PendantDesign | null {
  const d = input as PendantDesign;
  if (!d || typeof d !== 'object' || !d.spec || !d.geometry) return null;
  const { spec, geometry } = d;
  const b = spec.birth;
  if (!b || !str(b.year, 4) || !str(b.month, 2) || !str(b.day, 2) || !str(b.hour, 2) || !str(b.minute, 2)) return null;
  if (!finite(b.lat) || !finite(b.lon) || !str(b.location, 200)) return null;
  if (!Array.isArray(spec.aspects) || spec.aspects.length > 10 || !spec.aspects.every((a) => str(a, 20))) return null;
  if (!str(spec.outlineStyle, 20)) return null;
  for (const k of ['liquidity', 'borderThickness', 'lineThickness', 'filletRadius'] as const) {
    if (!finite(spec[k])) return null;
  }
  const { chords } = geometry;
  if (!Array.isArray(chords) || chords.length === 0 || chords.length > 60) return null;
  if (!chords.every((c) => c && finite(c.a1) && finite(c.a2))) return null;
  if (!finite(geometry.circleRadius) || !finite(geometry.minArea) || !finite(geometry.minAngle)) return null;
  return {
    spec: {
      birth: { year: b.year, month: b.month, day: b.day, hour: b.hour, minute: b.minute, lat: b.lat, lon: b.lon, location: b.location },
      aspects: spec.aspects,
      outlineStyle: spec.outlineStyle,
      liquidity: spec.liquidity,
      borderThickness: spec.borderThickness,
      lineThickness: spec.lineThickness,
      filletRadius: spec.filletRadius,
    },
    geometry: {
      chords: chords.map((c) => ({ a1: c.a1, a2: c.a2 })),
      circleRadius: geometry.circleRadius,
      minArea: geometry.minArea,
      minAngle: geometry.minAngle,
    },
  };
}
