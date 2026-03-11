'use client';

import { useState, useEffect, useCallback } from 'react';
import Picker from 'react-mobile-picker';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function syncSelect(id: string, value: string) {
  const el = document.getElementById(id) as HTMLSelectElement | null;
  if (el && el.value !== value) {
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

export default function WheelDatePicker() {
  const [value, setValue] = useState({ month: '1', day: '1', year: '2000' });
  const [maxDay, setMaxDay] = useState(31);

  // Read initial values from hidden selects once chart-engine has populated them
  useEffect(() => {
    const timer = setTimeout(() => {
      const m = (document.getElementById('birth-month') as HTMLSelectElement)?.value;
      const d = (document.getElementById('birth-day') as HTMLSelectElement)?.value;
      const y = (document.getElementById('birth-year') as HTMLSelectElement)?.value;
      if (m && d && y) {
        setValue({ month: m, day: d, year: y });
        setMaxDay(daysInMonth(parseInt(m), parseInt(y)));
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = useCallback((next: { month: string; day: string; year: string }, key: string) => {
    const month = parseInt(next.month);
    const year = parseInt(next.year);
    const newMax = daysInMonth(month, year);
    const day = Math.min(parseInt(next.day), newMax);

    const final = { month: next.month, day: String(day), year: next.year };
    setValue(final);
    setMaxDay(newMax);

    // Sync to hidden selects — chart-engine listens for change events
    if (key === 'month' || key === 'year') {
      syncSelect('birth-month', final.month);
      syncSelect('birth-year', final.year);
      syncSelect('birth-day', final.day);
    } else {
      syncSelect('birth-day', final.day);
    }
  }, []);

  const days = Array.from({ length: maxDay }, (_, i) => String(i + 1));

  return (
    <div className="wheel-picker-container">
      <Picker value={value} onChange={handleChange} height={140} itemHeight={36} wheelMode="natural">
        <Picker.Column name="month">
          {MONTHS.map((label, i) => (
            <Picker.Item key={i} value={String(i + 1)}>
              {({ selected }) => (
                <span className={selected ? 'wheel-item-selected' : 'wheel-item'}>{label}</span>
              )}
            </Picker.Item>
          ))}
        </Picker.Column>
        <Picker.Column name="day">
          {days.map(d => (
            <Picker.Item key={d} value={d}>
              {({ selected }) => (
                <span className={selected ? 'wheel-item-selected' : 'wheel-item'}>{d}</span>
              )}
            </Picker.Item>
          ))}
        </Picker.Column>
        <Picker.Column name="year">
          {Array.from({ length: 2026 - 1925 + 1 }, (_, i) => String(2026 - i)).map(y => (
            <Picker.Item key={y} value={y}>
              {({ selected }) => (
                <span className={selected ? 'wheel-item-selected' : 'wheel-item'}>{y}</span>
              )}
            </Picker.Item>
          ))}
        </Picker.Column>
      </Picker>
    </div>
  );
}
