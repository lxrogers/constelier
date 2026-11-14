'use client';

// Hero form: date and time right on the homepage. Opens the configurator
// with both filled in; the place is asked there (it needs a lookup).
// Styled selects, not native date/time inputs, so it reads the same on
// every browser and matches the configurator.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEARS = Array.from({ length: 2026 - 1920 + 1 }, (_, i) => 2026 - i);
const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function daysIn(m: number, y: number) {
  return new Date(y || 2000, m || 1, 0).getDate();
}

export default function BirthTeaser() {
  const router = useRouter();
  const [m, setM] = useState('');
  const [d, setD] = useState('');
  const [y, setY] = useState('');
  const [h, setH] = useState('');
  const [mi, setMi] = useState('');
  const [ap, setAp] = useState('AM');

  const nDays = daysIn(+m, +y);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams({ theme: 'mono', from: 'eclipse' });
    if (y) p.set('y', y);
    if (m) p.set('m', m);
    if (d) p.set('d', String(Math.min(+d, nDays)));
    if (h) {
      const h12 = +h % 12;
      p.set('h', String(ap === 'PM' ? h12 + 12 : h12));
      p.set('mi', mi || '0');
    }
    router.push(`/chart?${p.toString()}`);
  }

  return (
    <form className="ecl-teaser" onSubmit={submit}>
      <div className="ecl-field">
        <span id="ecl-born">Born on</span>
        <div className="ecl-selects" role="group" aria-labelledby="ecl-born">
          <select value={m} onChange={(e) => setM(e.target.value)} aria-label="Month" className={m ? '' : 'empty'}>
            <option value="" disabled>Month</option>
            {MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
          </select>
          <select value={d} onChange={(e) => setD(e.target.value)} aria-label="Day" className={d ? '' : 'empty'}>
            <option value="" disabled>Day</option>
            {Array.from({ length: nDays }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
          </select>
          <select value={y} onChange={(e) => setY(e.target.value)} aria-label="Year" className={y ? '' : 'empty'}>
            <option value="" disabled>Year</option>
            {YEARS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <div className="ecl-field">
        <span id="ecl-at">At</span>
        <div className="ecl-selects" role="group" aria-labelledby="ecl-at">
          <select value={h} onChange={(e) => setH(e.target.value)} aria-label="Hour" className={h ? '' : 'empty'}>
            <option value="" disabled>Hr</option>
            {HOURS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={mi} onChange={(e) => setMi(e.target.value)} aria-label="Minute" className={mi ? '' : 'empty'}>
            <option value="" disabled>Min</option>
            {MINUTES.map((n) => <option key={n} value={n}>{String(n).padStart(2, '0')}</option>)}
          </select>
          <select value={ap} onChange={(e) => setAp(e.target.value)} aria-label="AM or PM">
            <option>AM</option>
            <option>PM</option>
          </select>
        </div>
      </div>
      <button type="submit" className="btn ecl-teaser-btn">
        Read my sky <span className="btn-arrow" aria-hidden="true">&rarr;</span>
      </button>
    </form>
  );
}
