'use client';

import { useEffect, useState } from 'react';
import { big3FromHoroscope } from '@/modules/prototypes/big3-ring';
import type { Big3, BirthData } from './types';

// Ascendant, sun and moon for a birth moment. null until the first result.
export function useBig3(birth: BirthData | null): { big3: Big3 | null; error: string | null } {
  const [big3, setBig3] = useState<Big3 | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!birth) return;
    let cancelled = false;
    (async () => {
      const { Horoscope, Origin } = await import('@/lib/horoscope');
      if (cancelled) return;
      try {
        const origin = new Origin({
          year: birth.year, month: birth.month - 1, date: birth.day,
          hour: birth.hour, minute: birth.minute,
          latitude: birth.lat, longitude: birth.lon,
        });
        const horoscope = new Horoscope({
          origin, houseSystem: 'placidus', zodiac: 'tropical',
          aspectPoints: ['all'], aspectTypes: ['major'], language: 'en',
        });
        setBig3(big3FromHoroscope(horoscope));
        setError(null);
      } catch (err) {
        console.error('Horoscope error:', err);
        setError('Could not calculate the chart. Check the birth details.');
      }
    })();
    return () => { cancelled = true; };
  }, [birth]);

  return { big3, error };
}
