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

// Random birthdays for the lab's "Generate 4 new pendants" button, so
// settings can be tried on charts nobody tuned them for.
const CITIES: { name: string; lat: number; lon: number }[] = [
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 }, { name: 'Chicago', lat: 41.8781, lon: -87.6298 },
  { name: 'New York', lat: 40.7128, lon: -74.006 }, { name: 'Mexico City', lat: 19.4326, lon: -99.1332 },
  { name: 'São Paulo', lat: -23.5505, lon: -46.6333 }, { name: 'London', lat: 51.5074, lon: -0.1278 },
  { name: 'Lagos', lat: 6.5244, lon: 3.3792 }, { name: 'Cairo', lat: 30.0444, lon: 31.2357 },
  { name: 'Mumbai', lat: 19.076, lon: 72.8777 }, { name: 'Manila', lat: 14.5995, lon: 120.9842 },
  { name: 'Seoul', lat: 37.5665, lon: 126.978 }, { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { name: 'Melbourne', lat: -37.8136, lon: 144.9631 }, { name: 'Stockholm', lat: 59.3293, lon: 18.0686 },
  { name: 'Honolulu', lat: 21.3069, lon: -157.8583 }, { name: 'Toronto', lat: 43.6532, lon: -79.3832 },
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function randomSamples(n = 4): LabSample[] {
  const stamp = Date.now().toString(36);
  return Array.from({ length: n }, (_, i) => {
    const city = CITIES[Math.floor(Math.random() * CITIES.length)];
    const year = 1950 + Math.floor(Math.random() * 61); // 1950-2010
    const month = 1 + Math.floor(Math.random() * 12);
    const day = 1 + Math.floor(Math.random() * new Date(year, month, 0).getDate());
    const hour = Math.floor(Math.random() * 24);
    const minute = Math.floor(Math.random() * 60);
    const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return {
      id: `random-${stamp}-${i}`,
      label: `${MONTHS[month - 1]} ${day} ${year} ${time} · ${city.name}`,
      year, month, day, hour, minute, lat: city.lat, lon: city.lon,
    };
  });
}
