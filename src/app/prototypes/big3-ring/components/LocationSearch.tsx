'use client';

import { useEffect, useRef, useState } from 'react';

interface Place { name: string; lat: number; lon: number; }

interface Props {
  place: string;
  lat: number;
  lon: number;
  onSelect: (p: Place) => void;
}

// Birth place lookup (OpenStreetMap Nominatim), same as the pendant flow.
export default function LocationSearch({ place, lat, lon, onSelect }: Props) {
  const [query, setQuery] = useState(place);
  const [results, setResults] = useState<Place[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQuery(place); }, [place]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function onInput(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) { setResults(null); return; }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value.trim())}&format=json&limit=5`, { headers: { Accept: 'application/json' } });
        const data: Array<{ display_name: string; lat: string; lon: string }> = await res.json();
        setResults(data.map(d => ({ name: d.display_name, lat: parseFloat(d.lat), lon: parseFloat(d.lon) })));
      } catch (err) {
        console.error('Geocoding error:', err);
      }
    }, 300);
  }

  return (
    <div className="b3-field b3-location">
      <label className="b3-label" htmlFor="b3-location">Location</label>
      <input
        id="b3-location"
        type="text"
        autoComplete="off"
        value={query}
        onChange={e => onInput(e.target.value)}
        onBlur={() => setTimeout(() => setResults(null), 200)}
      />
      {results && (
        <div className="b3-dropdown">
          {results.length === 0 && <div className="b3-dropdown-item muted">No results</div>}
          {results.map((r, i) => (
            <div
              key={i}
              className="b3-dropdown-item"
              onMouseDown={e => {
                e.preventDefault();
                onSelect({ ...r, name: r.name.split(',').slice(0, 2).join(',') });
                setResults(null);
              }}
            >
              {r.name}
            </div>
          ))}
        </div>
      )}
      <div className="b3-hint">{lat.toFixed(4)}°, {lon.toFixed(4)}°</div>
    </div>
  );
}
