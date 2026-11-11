// The birthdays the lab previews every setting on. Picked to span sparse to
// dense charts (aspect chords with the default four aspects in brackets).
import type { BirthData } from '@/lib/natal-chords';

export interface LabSample extends BirthData { id: string; label: string }

export const LAB_SAMPLES: LabSample[] = [
  { id: 'chicago-1995', label: 'Dec 3 1995 · Chicago (sparse, 7)', year: 1995, month: 12, day: 3, hour: 18, minute: 20, lat: 41.8781, lon: -87.6298 },
  { id: 'nyc-1990', label: 'Jan 15 1990 · New York (10)', year: 1990, month: 1, day: 15, hour: 8, minute: 30, lat: 40.7128, lon: -74.006 },
  { id: 'paris-1968', label: 'Mar 9 1968 · Paris (13)', year: 1968, month: 3, day: 9, hour: 11, minute: 5, lat: 48.8566, lon: 2.3522 },
  { id: 'sydney-2010', label: 'Jun 21 2010 · Sydney (dense, 15)', year: 2010, month: 6, day: 21, hour: 3, minute: 40, lat: -33.8688, lon: 151.2093 },
];
