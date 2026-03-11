'use client';

import { useState, useEffect, useCallback } from 'react';
import Picker from 'react-mobile-picker';

function syncSelect(id: string, value: string) {
  const el = document.getElementById(id) as HTMLSelectElement | null;
  if (el && el.value !== value) {
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function to24(hour12: string, period: string): string {
  const h = parseInt(hour12);
  if (period === 'AM') return String(h === 12 ? 0 : h);
  return String(h === 12 ? 12 : h + 12);
}

function from24(hour24: number): { hour: string; period: string } {
  if (hour24 === 0) return { hour: '12', period: 'AM' };
  if (hour24 < 12) return { hour: String(hour24), period: 'AM' };
  if (hour24 === 12) return { hour: '12', period: 'PM' };
  return { hour: String(hour24 - 12), period: 'PM' };
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i === 0 ? 12 : i));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i));

export default function WheelTimePicker() {
  const [value, setValue] = useState({ hour: '12', minute: '0', period: 'PM' });

  useEffect(() => {
    const timer = setTimeout(() => {
      const h = (document.getElementById('birth-hour') as HTMLSelectElement)?.value;
      const mi = (document.getElementById('birth-minute') as HTMLSelectElement)?.value;
      if (h && mi) {
        const { hour, period } = from24(parseInt(h));
        setValue({ hour, minute: mi, period });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = useCallback((next: { hour: string; minute: string; period: string }, key: string) => {
    setValue(next);
    if (key === 'hour' || key === 'period') {
      syncSelect('birth-hour', to24(next.hour, next.period));
    }
    if (key === 'minute') {
      syncSelect('birth-minute', next.minute);
    }
  }, []);

  return (
    <div className="wheel-picker-container">
      <Picker value={value} onChange={handleChange} height={140} itemHeight={36} wheelMode="natural">
        <Picker.Column name="hour">
          {HOURS_12.map(h => (
            <Picker.Item key={h} value={h}>
              {({ selected }) => (
                <span className={selected ? 'wheel-item-selected' : 'wheel-item'}>{h}</span>
              )}
            </Picker.Item>
          ))}
        </Picker.Column>
        <Picker.Column name="minute">
          {MINUTES.map(m => (
            <Picker.Item key={m} value={m}>
              {({ selected }) => (
                <span className={selected ? 'wheel-item-selected' : 'wheel-item'}>
                  {m.padStart(2, '0')}
                </span>
              )}
            </Picker.Item>
          ))}
        </Picker.Column>
        <Picker.Column name="period">
          {['AM', 'PM'].map(p => (
            <Picker.Item key={p} value={p}>
              {({ selected }) => (
                <span className={selected ? 'wheel-item-selected' : 'wheel-item'}>{p}</span>
              )}
            </Picker.Item>
          ))}
        </Picker.Column>
      </Picker>
    </div>
  );
}
