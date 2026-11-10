export interface ChartPoint {
  deg: number;        // ecliptic longitude, 0..360
  signIndex: number;
  sign: string;
  degInSign: number;
  house: number | null;
}

export interface Big3 {
  asc: ChartPoint;
  sun: ChartPoint;
  moon: ChartPoint;
}

export interface BirthData {
  year: number;
  month: number;      // 1..12
  day: number;
  hour: number;       // 0..23
  minute: number;
  lat: number;
  lon: number;
  place: string;
}

export interface RingDesign {
  asc: string;        // style keys from modules/prototypes/big3-ring
  sun: string;
  moon: string;
  width: number;      // band width, mm
  thickness: number;  // band wall, mm
  size: number;       // marker scale
  relief: number;     // how far the markers stand out from the band's face, mm (0 = flush)
  tiltDeg: number;    // how far the view tips over once tilted
  tiltDir: number;    // which way: 0 = camera drops toward the bottom of the screen, 90 = toward the left
}

// flat-first: down the ring's axis like the 2D chart while the bodies move, then tilt.
// always-3d: tilted the whole time.
export type ViewMode = 'flat-first' | 'always-3d';
