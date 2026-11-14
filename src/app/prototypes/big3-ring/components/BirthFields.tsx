'use client';

import LocationSearch from './LocationSearch';
import { MONTH_ABBR } from '../constants';
import type { BirthData } from '../types';

interface Props { value: BirthData; onChange: (next: BirthData) => void; }

const YEARS = Array.from({ length: 2026 - 1925 + 1 }, (_, i) => 2026 - i);
const daysIn = (year: number, month: number) => new Date(year, month, 0).getDate();
const hourLabel = (h: number) => (h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`);

export default function BirthFields({ value, onChange }: Props) {
  const set = (patch: Partial<BirthData>) => {
    const next = { ...value, ...patch };
    next.day = Math.min(next.day, daysIn(next.year, next.month));
    onChange(next);
  };
  const num = (key: keyof BirthData) => (e: React.ChangeEvent<HTMLSelectElement>) => set({ [key]: parseInt(e.target.value) });

  return (
    <>
      <div className="b3-field">
        <span className="b3-label">Date of Birth</span>
        <div className="b3-row">
          <select aria-label="Month" value={value.month} onChange={num('month')}>
            {MONTH_ABBR.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select aria-label="Day" value={value.day} onChange={num('day')}>
            {Array.from({ length: daysIn(value.year, value.month) }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
          </select>
          <select aria-label="Year" value={value.year} onChange={num('year')}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>
      <div className="b3-field">
        <span className="b3-label">Time</span>
        <div className="b3-row">
          <select aria-label="Hour" value={value.hour} onChange={num('hour')}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
          <select aria-label="Minute" value={value.minute} onChange={num('minute')}>
            {Array.from({ length: 60 }, (_, m) => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
          </select>
        </div>
      </div>
      <LocationSearch
        place={value.place}
        lat={value.lat}
        lon={value.lon}
        onSelect={p => set({ place: p.name, lat: p.lat, lon: p.lon })}
      />
    </>
  );
}
