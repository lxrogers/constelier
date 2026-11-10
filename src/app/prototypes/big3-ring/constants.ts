import type { BirthData, RingDesign } from './types';

export const DEFAULT_BIRTH: BirthData = {
  year: 2000, month: 1, day: 1, hour: 12, minute: 0,
  lat: 38.0464, lon: -84.497, place: 'Lexington, Fayette County',
};

export const DEFAULT_DESIGN: RingDesign = {
  asc: 'bar', sun: 'halo', moon: 'full',
  width: 2.4, size: 1, relief: 0.25, tiltDeg: 58, tiltDir: 90,
};

export const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const SETTINGS_KEY = 'constelier.prototype.big3-ring.v4';
