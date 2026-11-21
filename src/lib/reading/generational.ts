// Multi-year generational windows (1920–2035) for slow-planet aspects
// (Saturn, Uranus, Neptune, Pluto), computed against the same horoscope
// ephemeris and orbs used by the chart engine.

import { canonicalPairKey, type MajorLineAspect } from './pair-readings';

const OUTER_PLANETS = new Set(['saturn', 'uranus', 'neptune', 'pluto']);

// [startYear, endYear] inclusive, for spans lasting roughly 1+ years.
type YearSpan = readonly [number, number];

const WINDOWS: Record<string, readonly YearSpan[]> = {
  'saturn-uranus:opposition': [[1964, 1967], [2007, 2011]],
  'saturn-uranus:sextile': [[1934, 1936], [1947, 1949], [1978, 1981], [1995, 1997], [2024, 2026]],
  'saturn-uranus:square': [[1929, 1932], [1950, 1953], [1975, 1977], [1998, 2001], [2020, 2022]],
  'saturn-uranus:trine': [[1924, 1928], [1955, 1958], [1971, 1974], [2001, 2004], [2015, 2018]],

  'saturn-neptune:opposition': [[1935, 1937], [1970, 1973], [2005, 2008]],
  'saturn-neptune:sextile': [[1922, 1923], [1946, 1948], [1959, 1960], [1981, 1983], [1995, 1997], [2018, 2019], [2030, 2032]],
  'saturn-neptune:square': [[1925, 1927], [1943, 1945], [1962, 1964], [1978, 1980], [1998, 2000], [2014, 2016], [2033, 2035]],
  'saturn-neptune:trine': [[1928, 1930], [1941, 1943], [1965, 1967], [1975, 1978], [2000, 2002], [2011, 2013]],

  'saturn-pluto:opposition': [[1930, 1932], [1964, 1967], [2001, 2003]],
  'saturn-pluto:sextile': [[1942, 1943], [1952, 1953], [1976, 1977], [1989, 1990], [2012, 2014], [2025, 2027]],
  'saturn-pluto:square': [[1921, 1923], [1939, 1941], [1955, 1956], [1973, 1975], [1992, 1994], [2009, 2011], [2028, 2029]],
  'saturn-pluto:trine': [[1924, 1926], [1936, 1938], [1958, 1960], [1970, 1972], [1995, 1998], [2006, 2008], [2030, 2032]],

  'uranus-neptune:sextile': [[1964, 1970], [2022, 2030]],
  'uranus-neptune:square': [[1951, 1959]],
  'uranus-neptune:trine': [[1935, 1947]],

  'uranus-pluto:sextile': [[1941, 1947], [1991, 2001]],
  'uranus-pluto:square': [[1929, 1936], [2009, 2018]],
  'uranus-pluto:trine': [[1920, 1925], [2023, 2031]],
};

const CURRENT_YEAR = 2026;

export function generationalInsight(
  p1: string,
  p2: string,
  aspect: MajorLineAspect,
  birthYear?: number,
): string | null {
  if (!OUTER_PLANETS.has(p1) || !OUTER_PLANETS.has(p2)) return null;

  const pair = canonicalPairKey(p1, p2);
  const key = `${pair}:${aspect}`;

  // Neptune sextile Pluto spans most of the past century (nearly continuous
  // 1941–2002, summer passes 2003–2009, and back in orb from 2010 onward).
  if (key === 'neptune-pluto:sextile' && birthYear !== undefined) {
    if (birthYear >= 1941 && birthYear <= 2002) {
      return 'Almost everyone born between 1941 and 2002 has this.';
    }
    if (birthYear >= 2003 && birthYear <= 2009) {
      return 'Almost everyone born between 1941 and 2002 has this, along with summer births through 2009.';
    }
    if (birthYear >= 2010) {
      return 'Almost everyone born from 2010 onward has this.';
    }
  }

  const spans = WINDOWS[key];
  if (spans && birthYear !== undefined) {
    // Allow 1-year slack for brief retrograde edge passes right before a span.
    const match =
      spans.find(([start, end]) => birthYear >= start && birthYear <= end) ??
      spans.find(([start, end]) => birthYear >= start - 1 && birthYear <= end + 1);
    if (match) {
      const [start, end] = match;
      if (end > CURRENT_YEAR && start <= CURRENT_YEAR) {
        return `Most people born from ${start} onward have this.`;
      }
      if (start === end) {
        return `Most people born in ${start} have this.`;
      }
      if (end - start === 1) {
        return `Most people born in ${start} and ${end} have this.`;
      }
      return `Most people born between ${start} and ${end} have this.`;
    }
  }

  return 'Both planets move slowly, so you share this line with much of your generation.';
}
