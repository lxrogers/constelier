// Asks the main chart for its current pendant (same event the bag uses).
export interface MainChartSnapshot {
  design: {
    spec: { birth: { year: string; month: string; day: string; hour: string; minute: string; lat: number; lon: number; location: string } };
    geometry: { chords: { a1: number; a2: number }[] };
  };
  thumbnail: string | null;
}

export function snapshotMainChart(): MainChartSnapshot | null {
  let result: MainChartSnapshot | null = null;
  document.getElementById('chart')?.dispatchEvent(new CustomEvent('design-snapshot', {
    detail: { respond: (s: MainChartSnapshot | null) => { result = s; } },
  }));
  return result;
}

// "3/9/1968 11:05 · Paris"
export function snapshotLabel(snap: MainChartSnapshot) {
  const b = snap.design.spec.birth;
  const place = b.location.split(',')[0].trim();
  return `${b.month}/${b.day}/${b.year} ${b.hour.padStart(2, '0')}:${b.minute.padStart(2, '0')}${place ? ' · ' + place : ''}`;
}
