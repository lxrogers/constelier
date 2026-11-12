// @ts-nocheck
// Chart engine — extracted from natal-chart.html inline <script>
// Imperative canvas/animation logic, called from React useEffect

import { Horoscope, Origin } from '@/lib/horoscope';
import { easeInOutCubic, easeOutQuartic } from '@/modules/easing';
import { polygonArea, buildPendantModel } from '@/modules/pendant-geometry';
import { buildRingPreviewMesh } from '@/modules/fast-pendant-mesh';
import { buildPreview, buildOutlineLoops, meshOptionsFor, pendantExtent, OUTLINE_STYLE_IDS, LIQUIDITY } from '@/modules/pendant-build';
import { chordsFromHoroscope } from '@/lib/natal-chords';
import type { PendantParams } from '@/config/pendant-params';
import makerjs from 'makerjs';

const m = makerjs;

// ── Constants ──────────────────────────────────────────────

const SIGNS = [
  { key: 'aries',       glyph: '\u2648', abbr: 'Ari', name: 'Aries',       element: 'fire' },
  { key: 'taurus',      glyph: '\u2649', abbr: 'Tau', name: 'Taurus',      element: 'earth' },
  { key: 'gemini',      glyph: '\u264A', abbr: 'Gem', name: 'Gemini',      element: 'air' },
  { key: 'cancer',      glyph: '\u264B', abbr: 'Can', name: 'Cancer',      element: 'water' },
  { key: 'leo',         glyph: '\u264C', abbr: 'Leo', name: 'Leo',         element: 'fire' },
  { key: 'virgo',       glyph: '\u264D', abbr: 'Vir', name: 'Virgo',       element: 'earth' },
  { key: 'libra',       glyph: '\u264E', abbr: 'Lib', name: 'Libra',       element: 'air' },
  { key: 'scorpio',     glyph: '\u264F', abbr: 'Sco', name: 'Scorpio',     element: 'water' },
  { key: 'sagittarius', glyph: '\u2650', abbr: 'Sag', name: 'Sagittarius', element: 'fire' },
  { key: 'capricorn',   glyph: '\u2651', abbr: 'Cap', name: 'Capricorn',   element: 'earth' },
  { key: 'aquarius',    glyph: '\u2652', abbr: 'Aqu', name: 'Aquarius',    element: 'air' },
  { key: 'pisces',      glyph: '\u2653', abbr: 'Pis', name: 'Pisces',      element: 'water' },
];

const PLANET_KEYS = [
  'sun', 'moon', 'mercury', 'venus', 'mars',
  'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
];

const PLANET_GLYPHS = {
  sun: '\u2609', moon: '\u263D', mercury: '\u263F', venus: '\u2640',
  mars: '\u2642', jupiter: '\u2643', saturn: '\u2644', uranus: '\u2645',
  neptune: '\u2646', pluto: '\u2647', chiron: '\u26B7', northnode: '\u260A',
  sirius: '\u2605', southnode: '\u260B', lilith: '\u26B8',
};

const PLANET_NAMES = {
  sun: 'Sun', moon: 'Moon', mercury: 'Mercury', venus: 'Venus',
  mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus',
  neptune: 'Neptune', pluto: 'Pluto',
};

const ASPECT_STYLES = {
  conjunction: { color: '#2c2c2c', width: 1.2, dash: [],     opacity: 0.5 },
  sextile:     { color: '#2c2c2c', width: 0.8, dash: [4, 4], opacity: 0.5 },
  square:      { color: '#2c2c2c', width: 1.2, dash: [],     opacity: 0.35 },
  trine:       { color: '#2c2c2c', width: 1.2, dash: [],     opacity: 0.5 },
  opposition:  { color: '#2c2c2c', width: 1.5, dash: [],     opacity: 0.35 },
};

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export interface ChartEngineOptions {
  params: PendantParams;
  // Prod: the URL may override aspects/outline (shared links, reopened bag
  // designs) and is kept in sync. The lab drives every setting itself.
  urlOverrides?: boolean;
  // Drag to orbit the 3D pendant, scroll to zoom, double-click to reset
  // (lab only). Emits `pendant-camera` on window with the view direction.
  orbit?: boolean;
}

// What the reading is currently about: these aspect lines (and planets) are
// highlighted, the 3D pendant fades so they show through, and with `zoom`
// the chart eases in toward them.
export interface FocusSpec {
  aspects: { point1Key: string; point2Key: string; aspectKey: string }[];
  planets?: string[];
  zoom?: boolean;
}

export interface ChartEngine {
  destroy(): void;
  setFocus(spec: FocusSpec | null): void;
  // `draft`: a slider is mid-drag, so a quick build is fine; a call with
  // draft false afterwards settles it at full quality.
  setParams(next: Partial<PendantParams>, opts?: { draft?: boolean }): void;
}

export function initChartEngine(canvas: HTMLCanvasElement, canvas3d: HTMLCanvasElement, options: ChartEngineOptions): ChartEngine {
  const urlOverrides = options.urlOverrides !== false;
  let P: PendantParams = { ...options.params, aspects: [...options.params.aspects] };

  // ── URL Params ────────────────────────────────────────────────

  const urlParams = new URLSearchParams(window.location.search);

  // ── Enabled aspects ─────────────────────────────────────────

  const urlAspects = urlOverrides ? urlParams.get('a') : null;
  let enabledAspects = new Set<string>(
    urlAspects ? urlAspects.split(',').filter(a => ASPECT_STYLES[a]) : P.aspects
  );

  function onAspectsChanged() {
    // Cancel any in-progress animations
    if (aspectAnimId) { cancelAnimationFrame(aspectAnimId); aspectAnimId = null; }
    if (expansionAnimId) { cancelAnimationFrame(expansionAnimId); expansionAnimId = null; }
    if (pendantFadeId) { cancelAnimationFrame(pendantFadeId); pendantFadeId = null; }
    stopGrowIn();
    stopGrowth();
    // Fade out old pendant + crossfade 3D back to ring
    pendantAlpha = 0;
    pendantModelData = null;
    aspectAnimLines = [];
    aspectAnimDone = false;
    if (pendantViewer && shown3d) {
      crossFadeToRing(400);
    }
    if (displayState) drawChartState(displayState);
    startAspectAnim();
    syncURL();
  }

  // ── Canvas Setup ───────────────────────────────────────────

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const SIZE = 700;
  canvas.width = SIZE * dpr;
  canvas.height = SIZE * dpr;
  ctx.scale(dpr, dpr);

  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const OUTER_R = 310;
  const ZODIAC_INNER_R = 265;
  const ASPECT_R = 265;
  const PLANET_R = (OUTER_R + ASPECT_R) / 2;
  const PLANET_INNER_R = 205;
  const INNER_R = 145;
  // Model units that fit inside the aspect ring (ASPECT_R - 10 px). Chosen so
  // the default rim (r 100 + ~12 border) sits just inside the zodiac ring;
  // the 2D outline, aspect lines and 3D camera all scale from it.
  const FIT_R = 114;
  const PENDANT_R = 100 * (ASPECT_R - 10) / FIT_R;

  // ── State ──────────────────────────────────────────────────

  let selectedLat = urlParams.has('lat') ? parseFloat(urlParams.get('lat')!) : 38.0464;
  let selectedLon = urlParams.has('lon') ? parseFloat(urlParams.get('lon')!) : -84.4970;
  let chartOpacity = 0.6;
  let filletRadius = P.filletRadius;
  let borderThickness = P.borderThickness;
  let lineThickness = P.lineThickness;
  let scale3d = 1.0;

  let displayState = null;
  let fromState = null;
  let targetState = null;
  let animStartTime = null;
  let animFrameId = null;
  const ANIM_DURATION = 700;

  let spreadT = 1;
  let spreadAnimId = null;
  let spreadAnimStart = null;
  const SPREAD_DURATION = 350;

  let aspectAnimId = null;
  let aspectAnimStart = null;
  let aspectAnimLines = [];
  let aspectAnimDone = false;
  let showPendantRing = false;
  const ASPECT_LINE_DURATION = 500;
  const ASPECT_STAGGER_INITIAL = 100;
  const ASPECT_STAGGER_MIN = 25;

  let hoveredAspect = null;
  let drawnAspects = [];
  const HOVER_THRESHOLD = 6;

  // Reading focus (see FocusSpec). Pairs are stored both ways round.
  let focus: { pairs: Set<string>; planets: Set<string>; zoom: boolean } | null = null;
  let shown3d = false; // the 3D pendant has faded in at least once
  const pairKey = (a: string, b: string) => a + '|' + b;
  const isFocusedPair = (a: string, b: string) => !!focus && focus.pairs.has(pairKey(a, b));

  // DOM tooltip — renders above both 2D and 3D canvases
  const tooltip = document.createElement('div');
  tooltip.id = 'aspect-tooltip';
  tooltip.style.cssText = 'position:absolute;pointer-events:none;z-index:300;' +
    'background:rgba(58,54,48,0.9);color:#f5f0e6;font:12px Graphik Web,system-ui,sans-serif;' +
    'padding:5px 8px;border-radius:4px;white-space:nowrap;display:none;';
  canvas.parentElement!.appendChild(tooltip);

  // SVG overlay for hovered aspect line — renders above 3D canvas
  const hoverSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  hoverSvg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;' +
    'pointer-events:none;z-index:1;display:none;';
  const hoverLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  hoverLine.setAttribute('stroke', 'none');
  hoverLine.setAttribute('stroke-width', '0');
  hoverLine.setAttribute('stroke-linecap', 'round');
  hoverSvg.appendChild(hoverLine);
  canvas.parentElement!.appendChild(hoverSvg);

  // Thin foreground line on top of 3D model
  const hoverSvgFg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  hoverSvgFg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;' +
    'pointer-events:none;z-index:3;display:none;';
  const hoverLineFg = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  hoverLineFg.setAttribute('stroke', 'rgba(44,42,38,0.75)');
  hoverLineFg.setAttribute('stroke-width', '1.5');
  hoverLineFg.setAttribute('stroke-linecap', 'round');
  hoverSvgFg.appendChild(hoverLineFg);
  canvas.parentElement!.appendChild(hoverSvgFg);

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function focusedSegments() {
    if (!focus || !aspectAnimDone) return [];
    return drawnAspects.filter(a => isFocusedPair(a.point1Key, a.point2Key));
  }

  // The 3D pendant dims to half while a reading line grows in on the 2D
  // canvas beneath it; otherwise it stays fully visible.
  function apply3DFade(seconds = 0.15) {
    if (!shown3d) return;
    chart3dCanvas.style.transition = `opacity ${seconds}s ease`;
    chart3dCanvas.style.opacity = growth?.hide3d ? '0.5' : '1';
  }

  // Ease the whole chart (2D + 3D together) toward the focused lines.
  function applyZoom() {
    const wrapper = canvas.parentElement!;
    wrapper.style.transition = 'transform 1.4s cubic-bezier(.22,.7,.2,1)';
    const segs = focus?.zoom ? focusedSegments() : [];
    if (!segs.length) {
      wrapper.style.transform = 'scale(1) translate(0%, 0%)';
      delete wrapper.dataset.zoomed;
      return;
    }
    // Lets the page soften whatever the zoomed chart slides under.
    wrapper.dataset.zoomed = '';
    const xs = segs.flatMap(a => [a.x1, a.x2]);
    const ys = segs.flatMap(a => [a.y1, a.y2]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const extent = Math.max(maxX - minX, maxY - minY, 1);
    // Kept subtle: long lines (oppositions) barely zoom; short ones get up to 1.4x.
    const s = Math.max(1.08, Math.min(1.4, (PENDANT_R * 1.6) / extent));
    // Pull most of the way toward the lines, keeping some context.
    const pull = 0.85;
    const tx = (CX - (minX + maxX) / 2) / SIZE * 100 * pull;
    const ty = (CY - (minY + maxY) / 2) / SIZE * 100 * pull;
    wrapper.style.transform = `scale(${s.toFixed(3)}) translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%)`;
  }

  function refreshFocus() {
    if (displayState) drawChartState(displayState);
    applyZoom();
    // One line being read: replay it drawing in and thickening.
    const segs = focus?.zoom ? focusedSegments() : [];
    if (segs.length === 1) {
      const key = pairKey(segs[0].point1Key, segs[0].point2Key);
      if (growth?.key !== key) startGrowth(segs[0].point1Key, segs[0].point2Key);
    } else {
      stopGrowth();
    }
  }

  function setFocus(spec: FocusSpec | null) {
    if (!spec || (!spec.aspects.length && !spec.planets?.length)) {
      focus = null;
    } else {
      const pairs = new Set<string>();
      const planets = new Set<string>(spec.planets || []);
      for (const a of spec.aspects) {
        pairs.add(pairKey(a.point1Key, a.point2Key));
        pairs.add(pairKey(a.point2Key, a.point1Key));
        planets.add(a.point1Key);
        planets.add(a.point2Key);
      }
      focus = { pairs, planets, zoom: !!spec.zoom };
    }
    refreshFocus();
  }

  function updateHoverOverlays() {
    if (hoveredAspect && aspectAnimDone) {
      const ha = hoveredAspect;
      const name1 = PLANET_NAMES[ha.point1Key] || ha.point1Key;
      const name2 = PLANET_NAMES[ha.point2Key] || ha.point2Key;
      tooltip.textContent = `Your ${name1} and ${name2} are in ${ha.aspectKey}`;
      const scale = canvas.offsetWidth / SIZE;
      const cx = (SIZE / 2) * scale;
      const cy = (SIZE / 2) * scale;
      tooltip.style.display = '';
      tooltip.style.left = cx + 'px';
      tooltip.style.top = cy + 'px';
      tooltip.style.transform = 'translate(-50%, -50%)';
      const canvasLeft = canvas.offsetLeft;
      const canvasTop = canvas.offsetTop;
      hoverLine.setAttribute('x1', String(canvasLeft + ha.x1 * scale));
      hoverLine.setAttribute('y1', String(canvasTop + ha.y1 * scale));
      hoverLine.setAttribute('x2', String(canvasLeft + ha.x2 * scale));
      hoverLine.setAttribute('y2', String(canvasTop + ha.y2 * scale));
      hoverSvg.style.display = '';
      hoverLineFg.setAttribute('x1', String(canvasLeft + ha.x1 * scale));
      hoverLineFg.setAttribute('y1', String(canvasTop + ha.y1 * scale));
      hoverLineFg.setAttribute('x2', String(canvasLeft + ha.x2 * scale));
      hoverLineFg.setAttribute('y2', String(canvasTop + ha.y2 * scale));
      hoverSvgFg.style.display = '';
    } else {
      tooltip.style.display = 'none';
      hoverSvg.style.display = 'none';
      hoverSvgFg.style.display = 'none';
    }
  }

  function setHoveredAspect(next) {
    const prev = hoveredAspect;
    hoveredAspect = next;
    const changed = (prev?.point1Key !== hoveredAspect?.point1Key ||
                     prev?.point2Key !== hoveredAspect?.point2Key);
    if (changed && displayState) drawChartState(displayState);
    if (changed) {
      apply3DFade(0.15);
      canvas.dispatchEvent(new CustomEvent('hover-changed', {
        detail: hoveredAspect ? {
          point1Key: hoveredAspect.point1Key,
          point2Key: hoveredAspect.point2Key,
          aspectKey: hoveredAspect.aspectKey,
        } : null,
      }));
    }
    updateHoverOverlays();
  }

  const onMouseMove = (e) => {
    if (!aspectAnimDone || !drawnAspects.length) {
      if (hoveredAspect) { setHoveredAspect(null); canvas.style.cursor = ''; }
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (SIZE / rect.width);
    const my = (e.clientY - rect.top) * (SIZE / rect.height);

    let closest = null, closestDist = Infinity;
    for (const a of drawnAspects) {
      const d = distToSegment(mx, my, a.x1, a.y1, a.x2, a.y2);
      if (d < closestDist) { closestDist = d; closest = a; }
    }

    if (closest && closestDist < HOVER_THRESHOLD) {
      setHoveredAspect({ ...closest, tooltipX: mx, tooltipY: my });
      canvas.style.cursor = 'pointer';
    } else {
      setHoveredAspect(null);
      canvas.style.cursor = '';
    }
  };
  canvas.addEventListener('mousemove', onMouseMove);

  // Listen for programmatic hover from React aspect list
  const onAspectHover = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (!detail) {
      setHoveredAspect(null);
      return;
    }
    // Find the matching drawn aspect
    const match = drawnAspects.find(a =>
      a.point1Key === detail.point1Key && a.point2Key === detail.point2Key &&
      a.aspectKey === detail.aspectKey
    );
    if (match) {
      setHoveredAspect({ ...match });
    }
  };
  canvas.addEventListener('aspect-hover', onAspectHover);

  const onMouseLeave = () => {
    setHoveredAspect(null);
    canvas.style.cursor = '';
  };
  canvas.addEventListener('mouseleave', onMouseLeave);

  // ── Coordinate Helpers ─────────────────────────────────────

  function eclToAngle(eclDeg, ascDeg) {
    return (180 - eclDeg + ascDeg) * Math.PI / 180;
  }

  function eclToXY(eclDeg, radius, ascDeg) {
    const a = eclToAngle(eclDeg, ascDeg);
    return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
  }

  function normDeg(d) { return ((d % 360) + 360) % 360; }

  function lerpAngle(from, to, t) {
    let diff = to - from;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return normDeg(from + diff * t);
  }

  // ── Geocoding ──────────────────────────────────────────────

  let searchTimeout = null;
  const locationInput = document.getElementById('location') as HTMLInputElement;
  const dropdown = document.getElementById('location-dropdown');
  const locationInfo = document.getElementById('location-info');

  const onLocationInput = () => {
    clearTimeout(searchTimeout);
    const q = locationInput.value.trim();
    if (q.length < 2) { dropdown.classList.remove('open'); return; }
    searchTimeout = setTimeout(() => searchLocation(q), 300);
  };
  locationInput.addEventListener('input', onLocationInput);

  const onLocationBlur = () => {
    setTimeout(() => dropdown.classList.remove('open'), 200);
  };
  locationInput.addEventListener('blur', onLocationBlur);

  async function searchLocation(query) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const data = await res.json();
      dropdown.innerHTML = '';
      if (!data.length) {
        dropdown.innerHTML = '<div class="dropdown-item" style="color:#8899aa">No results</div>';
        dropdown.classList.add('open');
        return;
      }
      for (const item of data) {
        const div = document.createElement('div');
        div.className = 'dropdown-item';
        div.textContent = item.display_name;
        div.addEventListener('mousedown', (e) => {
          e.preventDefault();
          selectedLat = parseFloat(item.lat);
          selectedLon = parseFloat(item.lon);
          const name = item.display_name.split(',').slice(0, 2).join(',');
          locationInput.value = name;
          locationInfo.textContent = `${selectedLat.toFixed(4)}°, ${selectedLon.toFixed(4)}°`;
          dropdown.classList.remove('open');
          generateChart();
          syncURL();
        });
        dropdown.appendChild(div);
      }
      dropdown.classList.add('open');
    } catch (err) {
      console.error('Geocoding error:', err);
    }
  }

  // ── Chart State Extraction ─────────────────────────────────

  function extractState(h) {
    const ascDeg = getAscendantDeg(h);
    const mcDeg = getMidheavenDeg(h);
    const planets = getBodyPositions(h);
    const cusps = getHouseCusps(h);
    return { ascDeg, mcDeg, planets, cusps, horoscope: h };
  }

  function lerpState(from, to, t) {
    return {
      ascDeg: lerpAngle(from.ascDeg, to.ascDeg, t),
      mcDeg: (from.mcDeg != null && to.mcDeg != null)
        ? lerpAngle(from.mcDeg, to.mcDeg, t) : to.mcDeg,
      planets: to.planets.map(tp => {
        const fp = from.planets.find(p => p.key === tp.key);
        if (!fp) return tp;
        return { ...tp, deg: lerpAngle(fp.deg, tp.deg, t) };
      }),
      cusps: to.cusps.map((tc, i) => {
        const fc = from.cusps[i];
        if (!fc) return tc;
        return { ...tc, deg: lerpAngle(fc.deg, tc.deg, t) };
      }),
      horoscope: to.horoscope,
    };
  }

  // ── Chart Generation & Animation ───────────────────────────

  const errorEl = document.getElementById('error');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
    setTimeout(() => { errorEl.style.display = 'none'; }, 5000);
  }

  function generateChart() {
    errorEl.style.display = 'none';
    if (selectedLat === null) return;

    const year = parseInt((document.getElementById('birth-year') as HTMLSelectElement).value);
    const month = parseInt((document.getElementById('birth-month') as HTMLSelectElement).value);
    const date = parseInt((document.getElementById('birth-day') as HTMLSelectElement).value);
    const hour = parseInt((document.getElementById('birth-hour') as HTMLSelectElement).value);
    const minute = parseInt((document.getElementById('birth-minute') as HTMLSelectElement).value);

    let horoscope;
    try {
      const origin = new Origin({
        year, month: month - 1, date, hour, minute,
        latitude: selectedLat, longitude: selectedLon,
      });
      horoscope = new Horoscope({
        origin,
        houseSystem: 'placidus',
        zodiac: 'tropical',
        aspectPoints: ['all'],
        aspectTypes: ['major'],
        language: 'en',
      });
    } catch (err) {
      console.error('Horoscope error:', err);
      return showError('Error calculating chart. Check inputs.');
    }

    const newState = extractState(horoscope);
    animateTo(newState);
  }

  function animateTo(newState) {
    if (spreadAnimId) { cancelAnimationFrame(spreadAnimId); spreadAnimId = null; }
    if (aspectAnimId) { cancelAnimationFrame(aspectAnimId); aspectAnimId = null; }
    if (pendantFadeId) { cancelAnimationFrame(pendantFadeId); pendantFadeId = null; }
    if (expansionAnimId) { cancelAnimationFrame(expansionAnimId); expansionAnimId = null; }
    stopGrowIn();
    stopGrowth();
    if (pendantViewer && shown3d) {
      crossFadeToRing(400);
    }
    spreadT = 0;
    aspectAnimLines = [];
    aspectAnimDone = false;
    pendantAlpha = 0;
    _3dModelReady = false;
    pendantModelData = null;

    if (!displayState) {
      displayState = newState;
      drawChartState(displayState);
      startStage2();
      return;
    }

    if (animFrameId) cancelAnimationFrame(animFrameId);

    fromState = { ...displayState };
    targetState = newState;
    animStartTime = null;
    animFrameId = requestAnimationFrame(animStep);
  }

  function animStep(timestamp) {
    if (!animStartTime) animStartTime = timestamp;
    const elapsed = timestamp - animStartTime;
    const t = Math.min(elapsed / ANIM_DURATION, 1);
    const eased = easeInOutCubic(t);

    displayState = lerpState(fromState, targetState, eased);
    displayState.horoscope = targetState.horoscope;
    drawChartState(displayState);

    if (t < 1) {
      animFrameId = requestAnimationFrame(animStep);
    } else {
      displayState = targetState;
      fromState = null;
      targetState = null;
      animFrameId = null;
      startStage2();
    }
  }

  // ── Stage 2: Spread then Aspect Fade ────────────────────────

  function startStage2() {
    spreadT = 0;
    spreadAnimStart = null;
    spreadAnimId = requestAnimationFrame(spreadStep);
  }

  function spreadStep(timestamp) {
    if (!spreadAnimStart) spreadAnimStart = timestamp;
    const elapsed = timestamp - spreadAnimStart;
    spreadT = Math.min(elapsed / SPREAD_DURATION, 1);
    spreadT = easeInOutCubic(spreadT);
    drawChartState(displayState);
    if (spreadT < 1) {
      spreadAnimId = requestAnimationFrame(spreadStep);
    } else {
      spreadAnimId = null;
      startAspectAnim();
    }
  }

  function startAspectAnim() {
    if (aspectAnimId) cancelAnimationFrame(aspectAnimId);
    aspectAnimDone = false;
    aspectAnimStart = null;
    showPendantRing = true;

    aspectAnimLines = [];
    if (!displayState?.horoscope) { aspectAnimDone = true; showPendantRing = false; renderPendantOnCanvas(); return; }

    const h = displayState.horoscope;
    const ascDeg = displayState.ascDeg;
    const degMap = {};
    for (const p of displayState.planets) degMap[p.key] = p.deg;

    let aspects = [];
    try {
      if (h.Aspects?.all) aspects = h.Aspects.all;
      else if (Array.isArray(h?.Aspects)) aspects = h.Aspects;
    } catch {}

    const collected = [];
    for (const asp of aspects) {
      const key = asp.aspectKey || asp.key || '';
      const style = ASPECT_STYLES[key];
      if (!style) continue;
      const d1 = degMap[asp.point1Key];
      const d2 = degMap[asp.point2Key];
      if (d1 === undefined || d2 === undefined) continue;
      collected.push({ d1, d2, style, aspectKey: key, point1Key: asp.point1Key, point2Key: asp.point2Key, enabled: enabledAspects.has(key) });
    }

    applyZoom();

    // Dispatch the chart and its aspects to the React UI
    canvas.dispatchEvent(new CustomEvent('chart-updated', {
      detail: {
        ascDeg,
        planets: displayState.planets.map(p => ({ key: p.key, deg: p.deg })),
      },
    }));
    canvas.dispatchEvent(new CustomEvent('aspects-updated', {
      detail: collected.map(a => ({
        aspectKey: a.aspectKey,
        point1Key: a.point1Key,
        point2Key: a.point2Key,
        enabled: a.enabled,
        deg1: a.d1,
        deg2: a.d2,
      })),
    }));

    let cumDelay = 0;
    const n = collected.length;
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0;
      const stagger = ASPECT_STAGGER_INITIAL + (ASPECT_STAGGER_MIN - ASPECT_STAGGER_INITIAL) * t;
      aspectAnimLines.push({
        ...collected[i],
        delay: cumDelay,
        duration: ASPECT_LINE_DURATION,
      });
      cumDelay += stagger;
    }

    if (aspectAnimLines.length === 0) {
      aspectAnimDone = true;
      showPendantRing = false;
      renderPendantOnCanvas();
      return;
    }

    aspectAnimId = requestAnimationFrame(aspectAnimStep);
  }

  function aspectAnimStep(timestamp) {
    if (!aspectAnimStart) aspectAnimStart = timestamp;
    const elapsed = timestamp - aspectAnimStart;

    const lastLine = aspectAnimLines[aspectAnimLines.length - 1];
    const totalDuration = lastLine.delay + lastLine.duration;
    const allDone = elapsed >= totalDuration;

    drawChartState(displayState);

    if (!allDone) {
      aspectAnimId = requestAnimationFrame(aspectAnimStep);
    } else {
      aspectAnimId = null;
      aspectAnimDone = true;
      drawChartState(displayState);
      renderPendantOnCanvas();
      refreshFocus();
    }
  }

  // ── Input Setup & Listeners ─────────────────────────────────

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function updateDayMax() {
    const year = parseInt((document.getElementById('birth-year') as HTMLSelectElement).value);
    const month = parseInt((document.getElementById('birth-month') as HTMLSelectElement).value);
    const max = daysInMonth(year, month);
    const daySel = document.getElementById('birth-day') as HTMLSelectElement;
    const cur = parseInt(daySel.value);
    daySel.innerHTML = '';
    for (let d = 1; d <= max; d++) {
      const opt = document.createElement('option');
      opt.value = String(d);
      opt.textContent = String(d);
      daySel.appendChild(opt);
    }
    daySel.value = String(cur > max ? max : cur);
  }

  // Populate month dropdown
  {
    const monthSel = document.getElementById('birth-month') as HTMLSelectElement;
    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement('option');
      opt.value = String(m);
      opt.textContent = MONTH_ABBR[m - 1];
      monthSel.appendChild(opt);
    }
    monthSel.value = '1';
  }

  // Populate year dropdown
  {
    const yearSel = document.getElementById('birth-year') as HTMLSelectElement;
    for (let y = 2026; y >= 1925; y--) {
      const opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = String(y);
      yearSel.appendChild(opt);
    }
    yearSel.value = '2000';
  }

  // Populate day dropdown (initial)
  {
    const daySel = document.getElementById('birth-day') as HTMLSelectElement;
    for (let d = 1; d <= 31; d++) {
      const opt = document.createElement('option');
      opt.value = String(d);
      opt.textContent = String(d);
      daySel.appendChild(opt);
    }
    daySel.value = '1';
  }

  // Populate hour dropdown
  {
    const hourSel = document.getElementById('birth-hour') as HTMLSelectElement;
    for (let h = 0; h < 24; h++) {
      const opt = document.createElement('option');
      opt.value = String(h);
      const display = h === 0 ? '12 AM' : h < 12 ? h + ' AM' : h === 12 ? '12 PM' : (h - 12) + ' PM';
      opt.textContent = display;
      hourSel.appendChild(opt);
    }
    hourSel.value = '12';
  }

  // Populate minute dropdown
  {
    const minSel = document.getElementById('birth-minute') as HTMLSelectElement;
    for (let mi = 0; mi < 60; mi++) {
      const opt = document.createElement('option');
      opt.value = String(mi);
      opt.textContent = String(mi).padStart(2, '0');
      minSel.appendChild(opt);
    }
    minSel.value = '0';
  }

  // ── Apply URL params to form elements ─────────────────────────
  {
    if (urlParams.has('y')) {
      (document.getElementById('birth-year') as HTMLSelectElement).value = urlParams.get('y')!;
    }
    if (urlParams.has('m')) {
      (document.getElementById('birth-month') as HTMLSelectElement).value = urlParams.get('m')!;
    }
    if (urlParams.has('d')) {
      (document.getElementById('birth-day') as HTMLSelectElement).value = urlParams.get('d')!;
    }
    if (urlParams.has('h')) {
      (document.getElementById('birth-hour') as HTMLSelectElement).value = urlParams.get('h')!;
    }
    if (urlParams.has('mi')) {
      (document.getElementById('birth-minute') as HTMLSelectElement).value = urlParams.get('mi')!;
    }
    if (urlParams.has('loc')) {
      (document.getElementById('location') as HTMLInputElement).value = urlParams.get('loc')!;
    }
    if (urlParams.has('lat') && urlParams.has('lon')) {
      document.getElementById('location-info')!.textContent = `${selectedLat.toFixed(4)}°, ${selectedLon.toFixed(4)}°`;
    }
    updateDayMax();
  }

  // ── URL Sync ──────────────────────────────────────────────────

  function syncURL() {
    const p = new URLSearchParams();
    p.set('y', (document.getElementById('birth-year') as HTMLSelectElement).value);
    p.set('m', (document.getElementById('birth-month') as HTMLSelectElement).value);
    p.set('d', (document.getElementById('birth-day') as HTMLSelectElement).value);
    p.set('h', (document.getElementById('birth-hour') as HTMLSelectElement).value);
    p.set('mi', (document.getElementById('birth-minute') as HTMLSelectElement).value);
    p.set('lat', String(selectedLat));
    p.set('lon', String(selectedLon));
    p.set('loc', (document.getElementById('location') as HTMLInputElement).value);
    if (urlOverrides) {
      const aspects = [...enabledAspects].sort().join(',');
      p.set('a', aspects);
      if (outlineStyle !== options.params.outlineStyle) p.set('outline', outlineStyle);
      if (outlineStyle === 'liquid' && liquidity !== options.params.liquidity) p.set('liq', String(liquidity));
    }
    history.replaceState(null, '', '?' + p.toString());
  }

  const listeners: Array<[Element, string, EventListener]> = [];
  function addListener(id: string, event: string, handler: EventListener) {
    const el = document.getElementById(id);
    if (el) { el.addEventListener(event, handler); listeners.push([el, event, handler]); }
  }

  addListener('birth-year', 'change', () => {
    updateDayMax();
    generateChart();
    syncURL();
  });
  addListener('birth-month', 'change', () => {
    updateDayMax();
    generateChart();
    syncURL();
  });
  addListener('birth-day', 'change', () => {
    generateChart();
    syncURL();
  });
  addListener('birth-hour', 'change', () => { generateChart(); syncURL(); });
  addListener('birth-minute', 'change', () => { generateChart(); syncURL(); });
  addListener('chart-opacity', 'input', () => {
    const v = parseInt((document.getElementById('chart-opacity') as HTMLInputElement).value);
    document.getElementById('chart-opacity-val').textContent = v + '%';
    chartOpacity = v / 100;
    if (displayState) drawChartState(displayState);
  });
  function applyHdri() {
    if (!pendantViewer) return;
    if (pendantViewer.scene.environmentRotation !== undefined) {
      pendantViewer.scene.environmentRotation.set(P.hdriRx * Math.PI / 180, P.hdriRy * Math.PI / 180, 0);
    }
    pendantViewer.renderOnce();
  }

  // ── FPS Counter ───────────────────────────────────────────

  let _fpsFrames = 0;
  let _fpsLastTime = performance.now();
  let _fpsDisplay = 0;

  function _updateFps() {
    _fpsFrames++;
    const now = performance.now();
    if (now - _fpsLastTime >= 1000) {
      _fpsDisplay = _fpsFrames;
      _fpsFrames = 0;
      _fpsLastTime = now;
    }
  }

  function _drawFps() {
    ctx.save();
    ctx.font = '11px monospace';
    ctx.fillStyle = '#888';
    ctx.textAlign = 'right';
    ctx.fillText(_fpsDisplay + ' fps', SIZE - 8, 16);
    ctx.restore();
  }

  // ── Drawing from State ─────────────────────────────────────

  function drawChartState(state) {
    _updateFps();
    const { ascDeg, mcDeg, planets, cusps } = state;
    ctx.clearRect(0, 0, SIZE, SIZE);

    if (showPendantRing) {
      const outerR = PENDANT_R * 1.08; // the default 8-unit border
      const innerR = PENDANT_R;
      ctx.save();
      ctx.beginPath();
      ctx.arc(CX, CY, outerR, 0, Math.PI * 2);
      ctx.arc(CX, CY, innerR, 0, Math.PI * 2, true);
      ctx.fillStyle = '#f5f0e6';
      ctx.fill('evenodd');
      ctx.strokeStyle = '#5a524a';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(CX, CY, outerR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(CX, CY, innerR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    drawPendant();

    ctx.globalAlpha = chartOpacity;

    ctx.beginPath();
    ctx.arc(CX, CY, OUTER_R, 0, Math.PI * 2);
    ctx.arc(CX, CY, ASPECT_R, 0, Math.PI * 2, true);
    ctx.fillStyle = '#f5f0e6';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(CX, CY, ASPECT_R, 0, Math.PI * 2);
    ctx.strokeStyle = '#b8b0a2';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    drawZodiacRing(ascDeg);

    const degMap = {};
    for (const p of planets) degMap[p.key] = p.deg;
    drawAspectLines(state.horoscope, degMap, ascDeg);
    drawPlanets(planets, ascDeg);

    ctx.globalAlpha = 1;
  }

  function getAscendantDeg(h) {
    try { return h.Ascendant.ChartPosition.Ecliptic.DecimalDegrees; }
    catch { try { return h.Houses[0].ChartPosition.StartPosition.Ecliptic.DecimalDegrees; }
    catch { return 0; } }
  }

  function getMidheavenDeg(h) {
    try { return h.Midheaven.ChartPosition.Ecliptic.DecimalDegrees; }
    catch { return null; }
  }

  // ── Zodiac Ring ────────────────────────────────────────────

  function drawZodiacRing(ascDeg) {
    ctx.beginPath();
    ctx.arc(CX, CY, OUTER_R, 0, Math.PI * 2);
    ctx.strokeStyle = '#a89f92';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    for (let i = 0; i < 12; i++) {
      const sign = SIGNS[i];
      const startEcl = i * 30;

      const p1 = eclToXY(startEcl, OUTER_R, ascDeg);
      const p2 = eclToXY(startEcl, ASPECT_R, ascDeg);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = '#a89f92';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Draw sign name curved along the arc
      const labelR = OUTER_R + 18;
      const label = sign.name.toUpperCase();
      ctx.font = '13px Graphik Web, system-ui, sans-serif';
      ctx.fillStyle = '#8a8078';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Measure total angular width of the label
      const charWidths: number[] = [];
      let totalWidth = 0;
      for (let c = 0; c < label.length; c++) {
        const w = ctx.measureText(label[c]).width;
        charWidths.push(w);
        totalWidth += w;
      }
      const totalAngle = totalWidth / labelR;
      const midAngle = eclToAngle(startEcl + 15, ascDeg);

      // Detect bottom half: canvas angles 0..π (right → bottom → left)
      const normMid = ((midAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const inBottomHalf = normMid > 0.05 && normMid < Math.PI - 0.05;

      if (inBottomHalf) {
        // Bottom: start from left (higher angle at bottom = left), go clockwise
        let angle = midAngle + totalAngle / 2;
        for (let c = 0; c < label.length; c++) {
          const charAngle = charWidths[c] / labelR;
          angle -= charAngle / 2;
          ctx.save();
          ctx.translate(CX + labelR * Math.cos(angle), CY + labelR * Math.sin(angle));
          ctx.rotate(angle - Math.PI / 2);
          ctx.fillText(label[c], 0, 0);
          ctx.restore();
          angle -= charAngle / 2;
        }
      } else {
        // Top: start from left (lower angle at top = left), go counter-clockwise
        let angle = midAngle - totalAngle / 2;
        for (let c = 0; c < label.length; c++) {
          const charAngle = charWidths[c] / labelR;
          angle += charAngle / 2;
          ctx.save();
          ctx.translate(CX + labelR * Math.cos(angle), CY + labelR * Math.sin(angle));
          ctx.rotate(angle + Math.PI / 2);
          ctx.fillText(label[c], 0, 0);
          ctx.restore();
          angle += charAngle / 2;
        }
      }
    }
  }

  // ── Houses ─────────────────────────────────────────────────

  function getHouseCusps(h) {
    const cusps = [];
    try {
      for (let i = 0; i < h.Houses.length; i++) {
        const house = h.Houses[i];
        let deg;
        if (house.ChartPosition && house.ChartPosition.StartPosition) {
          deg = house.ChartPosition.StartPosition.Ecliptic.DecimalDegrees;
        } else if (house.ChartPosition && house.ChartPosition.Ecliptic) {
          deg = house.ChartPosition.Ecliptic.DecimalDegrees;
        }
        cusps.push({ id: house.id || (i + 1), deg: normDeg(deg) });
      }
    } catch (err) { console.error('Error reading house cusps:', err); }
    return cusps;
  }

  // ── Planets ────────────────────────────────────────────────

  function getBodyPositions(h) {
    const positions = [];
    const addBody = (body, key) => {
      if (!body || !body.ChartPosition) return;
      const ecl = body.ChartPosition.Ecliptic;
      if (!ecl) return;
      positions.push({
        key,
        deg: normDeg(ecl.DecimalDegrees),
        sign: body.Sign ? body.Sign.key : null,
        signLabel: body.Sign ? body.Sign.label : '',
        house: body.House ? (body.House.id || '') : '',
        retrograde: !!body.isRetrograde,
        arcDeg: ecl.ArcDegrees || null,
        formatted30: ecl.ArcDegreesFormatted30 || '',
      });
    };
    for (const key of PLANET_KEYS) {
      const body = h.CelestialBodies[key] || (h.CelestialPoints && h.CelestialPoints[key]);
      addBody(body, key);
    }
    return positions;
  }

  function spreadPositions(positions, minGap) {
    const items = positions.map(p => ({ ...p, displayDeg: p.deg, fixed: false }));
    for (let i = 0; i < 12; i++) {
      items.push({ deg: normDeg(i * 30), displayDeg: normDeg(i * 30), fixed: true, key: '_sign_' + i });
    }

    const n = items.length;
    items.sort((a, b) => a.deg - b.deg);

    let maxGap = -1, breakAfter = n - 1;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const gap = normDeg(items[j].deg - items[i].deg);
      if (gap > maxGap) { maxGap = gap; breakAfter = i; }
    }
    const order = [];
    for (let i = 0; i < n; i++) order.push((breakAfter + 1 + i) % n);

    const baseDeg = items[order[0]].deg;
    const truePos = order.map(idx => {
      let d = items[idx].deg - baseDeg;
      if (d < 0) d += 360;
      return d;
    });
    const isFixed = order.map(idx => items[idx].fixed);

    function layoutGroup(g) {
      if (g.count === 1) return [g.truePositions[0]];
      if (!g.fixedFlags.some(f => f)) {
        const mean = g.truePositions.reduce((a, b) => a + b) / g.count;
        const start = mean - (g.count - 1) * minGap / 2;
        return g.truePositions.map((_, i) => start + i * minGap);
      }
      const d = g.truePositions.slice();
      for (let i = 1; i < g.count; i++) {
        if (!g.fixedFlags[i]) {
          d[i] = Math.max(d[i], d[i - 1] + minGap);
        }
      }
      for (let i = g.count - 2; i >= 0; i--) {
        if (!g.fixedFlags[i]) {
          d[i] = Math.min(d[i], d[i + 1] - minGap);
          if (i > 0) d[i] = Math.max(d[i], d[i - 1] + minGap);
        }
      }
      return d;
    }

    let groups = truePos.map((p, i) => ({
      count: 1, truePositions: [p], fixedFlags: [isFixed[i]],
    }));

    let changed = true;
    while (changed) {
      changed = false;
      const merged = [groups[0]];
      for (let i = 1; i < groups.length; i++) {
        const prev = merged[merged.length - 1];
        const curr = groups[i];
        const prevLayout = layoutGroup(prev);
        const currLayout = layoutGroup(curr);
        if (currLayout[0] - prevLayout[prevLayout.length - 1] < minGap) {
          prev.truePositions = prev.truePositions.concat(curr.truePositions);
          prev.fixedFlags = prev.fixedFlags.concat(curr.fixedFlags);
          prev.count += curr.count;
          changed = true;
        } else {
          merged.push(curr);
        }
      }
      groups = merged;
    }

    let itemIdx = 0;
    for (const g of groups) {
      const layout = layoutGroup(g);
      for (let i = 0; i < g.count; i++) {
        items[order[itemIdx]].displayDeg = normDeg(layout[i] + baseDeg);
        itemIdx++;
      }
    }

    return items.filter(p => !p.fixed);
  }

  function drawPlanets(bodyPositions, ascDeg) {
    const spread = spreadPositions(bodyPositions, 5);

    for (const p of spread) {
      const renderDeg = lerpAngle(p.deg, p.displayDeg, spreadT);

      const tick1 = eclToXY(p.deg, ASPECT_R + 4, ascDeg);
      const tick2 = eclToXY(p.deg, ASPECT_R - 4, ascDeg);
      ctx.beginPath();
      ctx.moveTo(tick1.x, tick1.y);
      ctx.lineTo(tick2.x, tick2.y);
      ctx.strokeStyle = '#8b8078';
      ctx.lineWidth = 1;
      ctx.stroke();

      const offset = Math.abs(normDeg(renderDeg - p.deg));
      if (offset > 1) {
        const from = eclToXY(p.deg, ASPECT_R + 4, ascDeg);
        const to = eclToXY(renderDeg, PLANET_R, ascDeg);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = `rgba(139,128,120,${0.3 * spreadT})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      const glyphP = eclToXY(renderDeg, PLANET_R, ascDeg);
      const isHighlighted = hoveredAspect
        ? (p.key === hoveredAspect.point1Key || p.key === hoveredAspect.point2Key)
        : !!focus?.planets.has(p.key);
      const fontSize = p.key === 'sun' ? 28 : 22;
      const weight = isHighlighted ? 600 : 400;
      const reading = isHighlighted && !hoveredAspect;
      if (reading) {
        // A short gold tick where the planet meets the ring, so the eye can
        // run from the glyph to the bar it anchors.
        const a = eclToXY(p.deg, ASPECT_R - 12, ascDeg);
        const b = eclToXY(p.deg, ASPECT_R + 8, ascDeg);
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#a07a26';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        const dot = eclToXY(p.deg, ASPECT_R, ascDeg);
        ctx.fillStyle = '#a07a26';
        ctx.beginPath(); ctx.arc(dot.x, dot.y, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = prev;
      }
      ctx.font = weight + ' ' + fontSize + 'px Graphik Web, system-ui, sans-serif';
      ctx.fillStyle = reading ? '#8a6416' : isHighlighted ? '#000000' : '#2c2c2c';
      const prevAlpha = ctx.globalAlpha;
      if (isHighlighted) ctx.globalAlpha = 1.0;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(PLANET_GLYPHS[p.key] || p.key[0].toUpperCase(), glyphP.x, glyphP.y);
      if (isHighlighted) ctx.globalAlpha = prevAlpha;
    }
  }

  function formatDeg(p) {
    if (p.formatted30 && p.formatted30 !== "NaN° NaN' NaN''") return p.formatted30.split("'")[0] + "'";
    if (p.arcDeg) return p.arcDeg.degrees + '°' + p.arcDeg.minutes + "'";
    const inSign = p.deg % 30;
    return Math.floor(inSign) + '°';
  }

  // ── Aspects ────────────────────────────────────────────────

  function drawAspectLines(h, degMap, ascDeg) {
    drawnAspects = [];
    if (aspectAnimLines.length === 0 && !aspectAnimDone) return;

    const elapsed = aspectAnimStart ? performance.now() - aspectAnimStart : Infinity;

    if (aspectAnimDone) {
      let aspects = [];
      try {
        if (h && h.Aspects && h.Aspects.all) aspects = h.Aspects.all;
        else if (Array.isArray(h?.Aspects)) aspects = h.Aspects;
      } catch { return; }

      for (const asp of aspects) {
        const key = asp.aspectKey || asp.key || '';
        const style = ASPECT_STYLES[key];
        if (!style) continue;
        const d1 = degMap[asp.point1Key];
        const d2 = degMap[asp.point2Key];
        if (d1 === undefined || d2 === undefined) continue;

        const p1 = eclToXY(d1, PENDANT_R, ascDeg);
        const p2 = eclToXY(d2, PENDANT_R, ascDeg);

        const isHovered = hoveredAspect &&
          hoveredAspect.point1Key === asp.point1Key &&
          hoveredAspect.point2Key === asp.point2Key;
        // While reading, the lines not being read step back. (The line being
        // read is shown by the pendant animation, not drawn heavier here.)
        const dimmed = !isHovered && (focus?.pairs.size ?? 0) > 0 && !isFocusedPair(asp.point1Key, asp.point2Key);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = style.color;
        ctx.lineWidth = isHovered ? style.width + 2.5 : style.width;
        ctx.setLineDash(style.dash);
        ctx.globalAlpha = isHovered ? 0.95 : style.opacity * chartOpacity * (dimmed ? 0.35 : 1);
        ctx.stroke();
        ctx.globalAlpha = chartOpacity;
        ctx.setLineDash([]);

        drawnAspects.push({
          x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
          point1Key: asp.point1Key, point2Key: asp.point2Key,
          aspectKey: key,
        });
      }
    } else {
      for (const line of aspectAnimLines) {
        const lineElapsed = elapsed - line.delay;
        if (lineElapsed <= 0) continue;
        const progress = Math.min(lineElapsed / line.duration, 1);
        const eased = easeOutQuartic(progress);

        const p1 = eclToXY(line.d1, PENDANT_R, ascDeg);
        const p2 = eclToXY(line.d2, PENDANT_R, ascDeg);

        const ex = p1.x + (p2.x - p1.x) * eased;
        const ey = p1.y + (p2.y - p1.y) * eased;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = line.style.color;
        ctx.lineWidth = line.style.width;
        ctx.setLineDash(line.style.dash);
        ctx.globalAlpha = line.style.opacity * chartOpacity;
        ctx.stroke();
        ctx.globalAlpha = chartOpacity;
        ctx.setLineDash([]);

        if (progress >= 1) {
          drawnAspects.push({
            x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
            point1Key: line.point1Key, point2Key: line.point2Key,
            aspectKey: line.aspectKey,
          });
        }
      }
    }

    // Tooltip is now rendered as a DOM element above both canvases
  }

  // ── Angles (AC, MC) ───────────────────────────────────────

  function drawAngles(ascDeg, mcDeg) {
    const acP = eclToXY(ascDeg, OUTER_R + 5, ascDeg);
    const acI = eclToXY(ascDeg, ZODIAC_INNER_R - 2, ascDeg);
    ctx.beginPath(); ctx.moveTo(acP.x, acP.y); ctx.lineTo(acI.x, acI.y);
    ctx.strokeStyle = '#5a524a'; ctx.lineWidth = 1.5; ctx.stroke();
    const acL = eclToXY(ascDeg, OUTER_R + 18, ascDeg);
    ctx.font = 'bold 11px Graphik Web, system-ui, sans-serif';
    ctx.fillStyle = '#3a3630'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('AC', acL.x, acL.y);

    const dcDeg = normDeg(ascDeg + 180);
    const dcP = eclToXY(dcDeg, OUTER_R + 5, ascDeg);
    const dcI = eclToXY(dcDeg, ZODIAC_INNER_R - 2, ascDeg);
    ctx.beginPath(); ctx.moveTo(dcP.x, dcP.y); ctx.lineTo(dcI.x, dcI.y);
    ctx.strokeStyle = '#5a524a'; ctx.lineWidth = 1.5; ctx.stroke();
    const dcL = eclToXY(dcDeg, OUTER_R + 18, ascDeg);
    ctx.fillStyle = '#3a3630';
    ctx.fillText('DC', dcL.x, dcL.y);

    if (mcDeg != null) {
      const mcP = eclToXY(mcDeg, OUTER_R + 5, ascDeg);
      const mcI = eclToXY(mcDeg, ZODIAC_INNER_R - 2, ascDeg);
      ctx.beginPath(); ctx.moveTo(mcP.x, mcP.y); ctx.lineTo(mcI.x, mcI.y);
      ctx.strokeStyle = '#7a7268'; ctx.lineWidth = 1.5; ctx.stroke();
      const mcL = eclToXY(mcDeg, OUTER_R + 18, ascDeg);
      ctx.font = 'bold 11px Graphik Web, system-ui, sans-serif';
      ctx.fillStyle = '#5a524a';
      ctx.fillText('MC', mcL.x, mcL.y);

      const icDeg = normDeg(mcDeg + 180);
      const icP = eclToXY(icDeg, OUTER_R + 5, ascDeg);
      const icI = eclToXY(icDeg, ZODIAC_INNER_R - 2, ascDeg);
      ctx.beginPath(); ctx.moveTo(icP.x, icP.y); ctx.lineTo(icI.x, icI.y);
      ctx.strokeStyle = '#7a7268'; ctx.lineWidth = 1.5; ctx.stroke();
      const icL = eclToXY(icDeg, OUTER_R + 18, ascDeg);
      ctx.fillText('IC', icL.x, icL.y);
    }
  }

  // ── Results Table ──────────────────────────────────────────

  function formatDegFull(p) {
    if (p.formatted30 && p.formatted30 !== "NaN° NaN' NaN''") return p.formatted30;
    if (p.arcDeg) return p.arcDeg.degrees + '° ' + p.arcDeg.minutes + "' " + (p.arcDeg.seconds || 0) + "''";
    const inSign = p.deg % 30;
    const d = Math.floor(inSign);
    const mi = Math.floor((inSign - d) * 60);
    return d + '° ' + mi + "'";
  }

  // ── MakerJS Pendant Build ──────────────────────────────────

  let pendantModelData = null;
  let pendantAlpha = 0;
  let pendantFadeId = null;
  let pendantFadeStart = null;
  const PENDANT_FADE_DURATION = 500;

  let pendantChords = null;
  let pendantExpansion = 0;
  const EXPANSION_STEP = 0.3;
  const EXPANSION_DURATION = 2000;
  let expansionAnimId = null;
  let expansionAnimStart = null;

  function buildPendantFromChart(horoscope, ascDeg, expansion) {
    const chords = chordsFromHoroscope(horoscope, ascDeg, enabledAspects);
    if (chords.length === 0) return null;
    const r = 100;
    const model = buildPendantModel(chords, expansion, r, borderThickness, P.minArea, P.minAngle, filletRadius);
    return { model, r, chords };
  }

  function renderPendantOnCanvas() {
    if (!displayState?.horoscope) return;
    try {
      const result = buildPendantFromChart(displayState.horoscope, displayState.ascDeg, lineThickness);
      if (!result) { pendantModelData = null; return; }
      pendantChords = result.chords;
      pendantExpansion = 0;
      pendantAlpha = 1;

      // Fire server request immediately with final expansion value,
      // so it runs in parallel with the expansion animation
      // Start the viewer (and its HDRI download) now, so it is ready by the
      // time the 2 s expansion animation ends instead of starting then.
      ensureViewer().catch(() => {});

      if (outlineStyle === 'current') startExpansionAnim();
      else startGrowIn(result.model);
    } catch (err) {
      console.error('Pendant build error:', err);
      pendantModelData = null;
    }
  }

  function startExpansionAnim() {
    if (expansionAnimId) cancelAnimationFrame(expansionAnimId);
    expansionAnimStart = null;
    expansionAnimId = requestAnimationFrame(expansionStep);
  }

  function expansionStep(timestamp) {
    if (!pendantChords || !displayState) return;
    if (!expansionAnimStart) expansionAnimStart = timestamp;
    const elapsed = timestamp - expansionAnimStart;
    const t = Math.min(elapsed / EXPANSION_DURATION, 1);
    const eased = easeOutQuartic(t);

    const rawExp = EXPANSION_STEP + eased * (lineThickness - EXPANSION_STEP);
    const quantized = Math.min(Math.round(rawExp / EXPANSION_STEP) * EXPANSION_STEP, lineThickness);

    if (quantized !== pendantExpansion) {
      pendantExpansion = quantized;
      try {
        const r = 100;
        const model = buildPendantModel(pendantChords, pendantExpansion, r, borderThickness, P.minArea, P.minAngle, filletRadius);
        pendantModelData = { model, r, chords: pendantChords, expansion: pendantExpansion };
        drawChartState(displayState);
      } catch {}
    }

    if (t < 1) {
      expansionAnimId = requestAnimationFrame(expansionStep);
    } else {
      expansionAnimId = null;
      start3DTransition();
    }
  }

  // ── Grow-in frames with the real outline smoothing ─────────
  // The MakerJS expansion animation above only knows today's outline. For
  // Liquid and Pebble each step is built by the same code as the final
  // pendant (in a worker), so the metal pools at the junctions as it grows.

  function outlineParams(chords, draft) {
    return {
      style: outlineStyle,
      chords,
      circleRadius: 100,
      borderThickness,
      expansion: lineThickness,
      minArea: P.minArea,
      minAngle: P.minAngle,
      filletRadius,
      liquidity,
      draft,
    };
  }

  // Liquid scales each bar (width and how far it pools) by chord.w; Pebble
  // only has one width, so its frames grow the expansion instead.
  function grownParams(chords, scale) {
    if (outlineStyle === 'liquid') return outlineParams(chords.map(c => ({ ...c, w: scale })), true);
    return { ...outlineParams(chords, true), expansion: Math.max(0.3, lineThickness * scale) };
  }

  // A second worker just for frame lists, so animations never displace the
  // mesh builds queued on the main one.
  let framesWorker = null;
  let framesBroken = false;
  let framesSeq = 0;
  let framesJob = null;

  function getFramesWorker() {
    if (framesWorker || framesBroken || typeof Worker === 'undefined') return framesWorker;
    try {
      framesWorker = new Worker(new URL('./pendant.worker.ts', import.meta.url), { type: 'module' });
      framesWorker.onmessage = (e) => {
        const d = e.data;
        if (!framesJob || d.id !== framesJob.id) return;
        if (d.loops) framesJob.onFrame(d.index, d.loops);
        else if (d.error) console.warn('[pendant frames]', d.error);
      };
      framesWorker.onerror = () => {
        framesBroken = true;
        try { framesWorker.terminate(); } catch {}
        framesWorker = null;
        if (framesJob) runFramesOnMain(framesJob);
      };
    } catch {
      framesBroken = true;
      framesWorker = null;
    }
    return framesWorker;
  }

  function runFramesOnMain(job) {
    let i = 0;
    const step = () => {
      if (framesJob !== job || i >= job.paramsList.length) return;
      try { job.onFrame(i, buildOutlineLoops(job.paramsList[i])); } catch (err) { console.warn(err); }
      i++;
      setTimeout(step, 0);
    };
    setTimeout(step, 0);
  }

  // Frames arrive one by one through onFrame(index, loops); a newer request
  // replaces this one.
  function requestOutlineFrames(paramsList, onFrame) {
    const job = { id: ++framesSeq, paramsList, onFrame };
    framesJob = job;
    const w = getFramesWorker();
    if (w) w.postMessage({ kind: 'frames', id: job.id, paramsList });
    else runFramesOnMain(job);
  }

  function cancelOutlineFrames() {
    framesJob = null;
    framesWorker?.postMessage({ kind: 'cancel' });
  }

  // Each frame is held at least this long; a slow build just holds longer.
  const GROW_STEPS = [0.08, 0.16, 0.25, 0.35, 0.46, 0.58, 0.7, 0.82, 0.92, 1];

  let growInId = null;

  function stopGrowIn() {
    if (growInId) { cancelAnimationFrame(growInId); growInId = null; cancelOutlineFrames(); }
  }

  function startGrowIn(finalModel) {
    stopGrowIn();
    const chords = pendantChords;
    const frames = [];
    const hold = EXPANSION_DURATION / GROW_STEPS.length;
    let shown = -1;
    let lastSwitch = 0;
    requestOutlineFrames(GROW_STEPS.map(sc => grownParams(chords, sc)), (i, loops) => { frames[i] = loops; });
    const tick = (now) => {
      if (pendantChords !== chords) { growInId = null; return; }
      if (frames[shown + 1] && now - lastSwitch >= hold) {
        shown++;
        lastSwitch = now;
        pendantExpansion = lineThickness * GROW_STEPS[shown];
        pendantModelData = { model: finalModel, r: 100, chords, expansion: pendantExpansion, loops: frames[shown] };
        if (displayState) drawChartState(displayState);
      }
      if (shown < GROW_STEPS.length - 1) {
        growInId = requestAnimationFrame(tick);
      } else {
        growInId = null;
        start3DTransition();
      }
    };
    growInId = requestAnimationFrame(tick);
  }

  // ── Reading: one line draws in, then thickens ──────────────
  // The 3D pendant fades out to the 2D outline without that bar, a thin line
  // draws between the two planets, the bar grows in frame by frame (Liquid
  // smoothing at every step), and the 3D pendant fades back.

  let growth = null;
  let growthId = null;
  const GROWTH_FADE_MS = 350;
  const GROWTH_DRAW_MS = 650;
  const GROWTH_HOLD_MS = 130;
  const GROWTH_REST_MS = 250;
  const GROWTH_PULSE_MS = 1800; // one full fade in and out of the line

  function stopGrowth(restore3D = true) {
    if (growthId) { cancelAnimationFrame(growthId); growthId = null; }
    if (!growth) return;
    growth = null;
    cancelOutlineFrames();
    if (displayState) drawChartState(displayState);
    if (restore3D) apply3DFade(0.5);
  }

  function startGrowth(p1, p2) {
    stopGrowth(false);
    const chords = pendantModelData?.chords;
    const idx = chords ? chords.findIndex(c => (c.p1 === p1 && c.p2 === p2) || (c.p1 === p2 && c.p2 === p1)) : -1;
    if (idx < 0 || !shown3d || !_3dModelReady || outlineStyle === 'current') { apply3DFade(0.5); return; }

    const steps = [0, ...GROW_STEPS];
    const frames = [];
    const g = {
      key: pairKey(p1, p2), chord: chords[idx], phase: 'wait', start: 0, lastSwitch: 0, shown: 0,
      loops: null, lineT: 0, lineAlpha: 1, hide3d: false,
    };
    growth = g;
    const paramsList = steps.map(sc =>
      outlineStyle === 'liquid'
        ? outlineParams(chords.map((c, i) => (i === idx ? { ...c, w: sc } : c)), true)
        // Pebble: only one width, so leave the bar out, then put it back.
        : outlineParams(sc === 0 ? chords.filter((_, i) => i !== idx) : chords, true));
    requestOutlineFrames(paramsList, (i, loops) => { frames[i] = loops; });

    const tick = (now) => {
      if (growth !== g) return;
      if (g.phase === 'wait') {
        if (frames[0]) {
          g.phase = 'fade'; g.start = now; g.loops = frames[0]; g.hide3d = true;
          apply3DFade(GROWTH_FADE_MS / 1000);
        }
      } else if (g.phase === 'fade') {
        if (now - g.start >= GROWTH_FADE_MS) { g.phase = 'draw'; g.start = now; }
      } else if (g.phase === 'draw') {
        g.lineT = Math.min(1, (now - g.start) / GROWTH_DRAW_MS);
        if (g.lineT >= 1) { g.phase = 'grow'; g.lastSwitch = now; }
      } else if (g.phase === 'grow') {
        const last = steps.length - 1;
        if (g.shown < last && frames[g.shown + 1] && now - g.lastSwitch >= GROWTH_HOLD_MS) {
          g.shown++;
          g.lastSwitch = now;
          g.loops = frames[g.shown];
          g.lineAlpha = 1 - g.shown / last;
        }
        if (g.shown >= last && now - g.lastSwitch >= GROWTH_REST_MS) { g.phase = 'pulse'; g.start = now; }
      } else if (g.phase === 'pulse') {
        // Stay on the grown outline with the 3D dimmed, and keep the line
        // breathing in and out until the reader moves on (stopGrowth).
        const t = (now - g.start) / GROWTH_PULSE_MS;
        g.lineAlpha = 0.85 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2));
      }
      if (displayState) drawChartState(displayState);
      growthId = requestAnimationFrame(tick);
    };
    growthId = requestAnimationFrame(tick);
  }

  function startPendantFade() {
    if (pendantFadeId) cancelAnimationFrame(pendantFadeId);
    pendantAlpha = 0;
    pendantFadeStart = null;
    pendantFadeId = requestAnimationFrame(pendantFadeStep);
  }

  function pendantFadeStep(timestamp) {
    if (!pendantFadeStart) pendantFadeStart = timestamp;
    const elapsed = timestamp - pendantFadeStart;
    pendantAlpha = Math.min(elapsed / PENDANT_FADE_DURATION, 1);
    if (displayState) drawChartState(displayState);
    if (pendantAlpha < 1) {
      pendantFadeId = requestAnimationFrame(pendantFadeStep);
    } else {
      pendantFadeId = null;
    }
  }

  let _dotAnimTime = 0;
  let _dotAnimId = null;
  let _3dModelReady = false;

  function _startDotAnim() {
    if (_dotAnimId) return;
    function tick() {
      _dotAnimTime = performance.now() / 1000;
      if (displayState && pendantModelData && pendantAlpha > 0) {
        drawChartState(displayState);
      }
      _dotAnimId = requestAnimationFrame(tick);
    }
    _dotAnimId = requestAnimationFrame(tick);
  }

  function _stopDotAnim() {
    if (_dotAnimId) { cancelAnimationFrame(_dotAnimId); _dotAnimId = null; }
  }

  function modelCutouts(model, r) {
    const fillChains = m.model.findChains(model);
    const circleArea = Math.PI * r * r;
    const cutouts = [];
    for (const ch of fillChains) {
      if (!ch.endless) continue;
      try {
        const pts = m.chain.toKeyPoints(ch, 1);
        if (pts.length < 3) continue;
        const area = polygonArea(pts);
        if (area >= circleArea * 0.95) continue;
        cutouts.push(pts);
      } catch {}
    }
    return cutouts;
  }

  function drawPendant() {
    if (!pendantModelData || pendantAlpha <= 0) { _stopDotAnim(); return; }
    const { model, r } = pendantModelData;
    // Scale is fixed by FIT_R so the r=100 circle always lines up with the
    // chart; a wider rim just draws larger.
    const outerR = r + borderThickness;

    const drawR = ASPECT_R - 10;
    const scale = drawR / FIT_R * viewScale();

    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, ASPECT_R - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = pendantAlpha;
    ctx.translate(CX, CY);
    ctx.scale(scale, scale);

    // Organic outlines (Liquid, Pebble) only exist once the 3D build has
    // run; until then the 2D view shows today's outline growing in.
    const cutouts = growth?.loops || pendantModelData.loops || modelCutouts(model, r);

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, outerR, 0, Math.PI * 2);
    for (const pts of cutouts) {
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
      ctx.closePath();
    }
    ctx.clip('evenodd');

    if (_3dModelReady && !growth?.loops) {
      // 3D model is visible — skip dot grid, just fill solid background
      // (unless orbited off top-down, where the backdrop no longer lines up)
      ctx.globalAlpha = pendantAlpha;
      ctx.fillStyle = '#f5f0e6';
      if (!orbited) ctx.fillRect(-outerR, -outerR, outerR * 2, outerR * 2);
      ctx.restore();
      ctx.restore();
      return;
    }

    const dotSpacing = 6.0 / scale;
    const dotSize = 1.4 / scale;
    const t = _dotAnimTime;
    const waveSpeed = 4.0;
    const waveFreq = 0.04;
    const waveWidth = 0.5;

    for (let gx = -outerR; gx <= outerR; gx += dotSpacing) {
      for (let gy = -outerR; gy <= outerR; gy += dotSpacing) {
        if (gx * gx + gy * gy > outerR * outerR) continue;

        const phase = (gx + gy) * waveFreq - t * waveSpeed;
        const wave = Math.sin(phase);
        const smooth = (wave + 1) / 2; // remap -1..1 to 0..1
        const alpha = 0.15 + 0.85 * Math.pow(smooth, waveWidth);

        ctx.globalAlpha = pendantAlpha * alpha;
        ctx.fillStyle = '#c9a227';
        ctx.fillRect(gx - dotSize / 2, gy - dotSize / 2, dotSize, dotSize);
      }
    }
    ctx.restore();

    ctx.globalAlpha = pendantAlpha;
    ctx.strokeStyle = '#5a524a';
    ctx.lineWidth = 1.0 / scale;
    ctx.beginPath();
    ctx.arc(0, 0, outerR, 0, Math.PI * 2);
    ctx.stroke();
    for (const pts of cutouts) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
      ctx.closePath();
      ctx.stroke();
    }

    // The line being read, drawn across before its bar thickens in.
    if (growth && growth.lineT > 0) {
      const c = growth.chord;
      const px = Math.cos(c.a1) * r, py = Math.sin(c.a1) * r;
      const qx = Math.cos(c.a2) * r, qy = Math.sin(c.a2) * r;
      const e = easeOutQuartic(growth.lineT);
      ctx.globalAlpha = pendantAlpha * growth.lineAlpha;
      ctx.strokeStyle = '#2c2a26';
      ctx.lineWidth = 1.5 / scale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + (qx - px) * e, py + (qy - py) * e);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    _startDotAnim();
  }

  // ── 3D Transition ──────────────────────────────────────────

  const chart3dCanvas = canvas3d;
  let pendantViewer = null;
  let viewerPromise = null;
  let resizeObserver: ResizeObserver | null = null;

  // ── Outline style + liquidity (preview branch) ───────────────────
  // Every 3D build is a plain-JS mesh straight from the 2D outline, with
  // rolling-ball edge rounding (modules/fast-pendant-mesh.js); no
  // OpenCascade anywhere. The build runs in a Web Worker so dragging the
  // liquidity slider never blocks the page.

  let outlineStyle = urlOverrides && OUTLINE_STYLE_IDS.includes(urlParams.get('outline')) ? urlParams.get('outline') : P.outlineStyle;
  let liquidity = (() => {
    const v = urlOverrides ? parseFloat(urlParams.get('liq')) : NaN;
    return Number.isFinite(v) ? Math.min(LIQUIDITY.max, Math.max(LIQUIDITY.min, v)) : P.liquidity;
  })();

  const previewOpts = () => meshOptionsFor(P);

  function previewParams(draft = false) {
    return { ...outlineParams(pendantModelData.chords, draft), circleRadius: pendantModelData.r };
  }

  // Latest-wins scheduler: at most one build in flight. A request made while
  // one runs replaces any earlier waiting request (that one resolves null).
  let worker = null;
  let workerBroken = false;
  let jobSeq = 0;
  let runningJob = null;
  let queuedJob = null;

  function getWorker() {
    if (worker || workerBroken || typeof Worker === 'undefined') return worker;
    try {
      worker = new Worker(new URL('./pendant.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        const job = runningJob;
        if (!job || e.data.id !== job.id) return;
        finishJob(job, e.data.error ? null : e.data);
        if (e.data.error) console.warn('[pendant worker]', e.data.error);
      };
      worker.onerror = (e) => {
        console.warn('[pendant worker] failed, building on the main thread', e?.message || e);
        workerBroken = true;
        try { worker.terminate(); } catch {}
        worker = null;
        const job = runningJob;
        if (job) runOnMainThread(job);
      };
    } catch (err) {
      workerBroken = true;
      worker = null;
    }
    return worker;
  }

  function runOnMainThread(job) {
    setTimeout(() => {
      if (runningJob !== job) return;
      try {
        const t0 = performance.now();
        const res = buildPreview(job.params, job.meshOpts);
        finishJob(job, { ...res, ms: performance.now() - t0 });
      } catch (err) {
        console.error('Pendant build error:', err);
        finishJob(job, null);
      }
    }, 0);
  }

  function startJob(job) {
    runningJob = job;
    const w = getWorker();
    if (w) w.postMessage({ id: job.id, params: job.params, meshOpts: job.meshOpts });
    else runOnMainThread(job);
  }

  function finishJob(job, result) {
    if (runningJob === job) runningJob = null;
    if (urlParams.get('perf') === '1' && result) {
      console.log(`[preview] ${job.params.style}${job.params.draft ? ' (draft)' : ''} ${result.ms.toFixed(0)} ms, ${result.mesh.triangles.length / 3} tris`);
    }
    job.resolve(result);
    if (queuedJob) { const next = queuedJob; queuedJob = null; startJob(next); }
  }

  function requestPreview(params) {
    return new Promise((resolve) => {
      const job = { id: ++jobSeq, params, meshOpts: previewOpts(), resolve };
      if (runningJob) {
        if (queuedJob) queuedJob.resolve(null);
        queuedJob = job;
      } else {
        startJob(job);
      }
    });
  }

  // Which pendant a result belongs to, so a late result for an old chart or
  // old settings is dropped.
  let previewGen = 0;

  function applyPreviewLoops(loops) {
    if (!pendantModelData) return;
    pendantModelData.loops = loops;
  }

  // Reshape the pendant already on screen to the current settings.
  // `mode`: 'swap' replaces the mesh instantly (slider drag), 'fade' cross-fades.
  let lastBuildWasDraft = false;
  function refreshLivePendant(mode, draft) {
    if (!pendantModelData || !pendantViewer || !_3dModelReady) return;
    const gen = previewGen;
    lastBuildWasDraft = draft;
    requestPreview(previewParams(draft)).then((res) => {
      if (!res || gen !== previewGen || !pendantViewer || !_3dModelReady) return;
      if (mode === 'swap') pendantViewer.swapMeshFromData(res.mesh);
      else pendantViewer.crossFadeMeshFromData(res.mesh, 450);
      applyPreviewLoops(res.loops);
      if (displayState) drawChartState(displayState);
    });
  }

  // Bumped on every geometry change, so a 3D build that started before the
  // change knows to redo itself when it lands.
  let paramsVersion = 0;
  let lastViewScale = 1;

  const GEOMETRY_KEYS = ['outlineStyle', 'liquidity', 'lineThickness', 'filletRadius', 'minArea', 'minAngle',
    'borderThickness', 'rimRoundness', 'thickness', 'edgeFillet', 'diameterMm',
    'bailEnabled', 'bailInnerMm', 'bailBand', 'bailGapMm', 'bailBlend'];

  function setParams(next, { draft = false } = {}) {
    const prev = P;
    P = { ...P, ...next, aspects: [...(next.aspects || P.aspects)] };
    const changed = (k) => {
      const a = prev[k], b = P[k];
      if (Array.isArray(a)) return a.length !== b.length || a.some((v) => !b.includes(v));
      return a !== b;
    };

    if (changed('roughness') && pendantViewer) { pendantViewer.setRoughness(P.roughness); pendantViewer.renderOnce(); }
    if (changed('hdriRx') || changed('hdriRy')) applyHdri();
    if (changed('thickness') && pendantViewer) pendantViewer.setShadowPlaneY(-(P.thickness + 2));
    // A bail change can change how much the view has to zoom out.
    const scaleBefore = lastViewScale;
    lastViewScale = viewScale();
    if (Math.abs(lastViewScale - scaleBefore) > 1e-4 && pendantViewer && _3dModelReady) {
      update3DCamera(); // back to top-down at the new zoom
      emitCamera();
      if (displayState) drawChartState(displayState);
    }

    filletRadius = P.filletRadius;
    borderThickness = P.borderThickness;
    lineThickness = P.lineThickness;
    outlineStyle = P.outlineStyle;
    liquidity = P.liquidity;

    if (changed('aspects')) {
      enabledAspects = new Set(P.aspects);
      onAspectsChanged(); // rebuilds from scratch with the new settings
      return;
    }
    const geometryChanged = GEOMETRY_KEYS.some(changed);
    if (geometryChanged) {
      paramsVersion++;
      if (changed('outlineStyle') && pendantModelData) pendantModelData.loops = null;
      if (changed('outlineStyle') || changed('liquidity')) syncURL();
      refreshLivePendant(changed('outlineStyle') ? 'fade' : 'swap', draft);
    } else if (!draft && lastBuildWasDraft) {
      refreshLivePendant('swap', false);
    }
  }

  // The current design, for the bag. The React side asks with
  // `design-snapshot` and gets the answer through `detail.respond`.
  function snapshotThumbnail() {
    const src = (pendantViewer && _3dModelReady) ? chart3dCanvas : canvas;
    try {
      if (src === chart3dCanvas) pendantViewer.renderOnce();
      const size = 320;
      const out = document.createElement('canvas');
      out.width = size; out.height = size;
      const octx = out.getContext('2d');
      octx.fillStyle = '#f5f0e6';
      octx.fillRect(0, 0, size, size);
      // Crop to the pendant (outer radius + border) around the canvas centre.
      const half = src.width / 2;
      // Circle (r=100) is drawn at ASPECT_R-10; border adds 8%, plus a margin.
      const reach = Math.max(1.16, (pendantExtent(previewOpts(), borderThickness) + 6) / FIT_R);
      const r = src.width * ((ASPECT_R - 10) * viewScale() * reach / SIZE);
      octx.drawImage(src, half - r, half - r, 2 * r, 2 * r, 0, 0, size, size);
      return out.toDataURL('image/jpeg', 0.82);
    } catch {
      return null;
    }
  }

  function onDesignSnapshot(e) {
    const respond = e.detail?.respond;
    if (typeof respond !== 'function') return;
    if (!pendantModelData?.chords?.length) { respond(null); return; }
    const val = (id) => (document.getElementById(id) as HTMLSelectElement | HTMLInputElement)?.value || '';
    respond({
      design: {
        spec: {
          birth: {
            year: val('birth-year'), month: val('birth-month'), day: val('birth-day'),
            hour: val('birth-hour'), minute: val('birth-minute'),
            lat: selectedLat, lon: selectedLon, location: val('location'),
          },
          aspects: [...enabledAspects].sort(),
          outlineStyle,
          liquidity,
          borderThickness,
          lineThickness,
          filletRadius,
          thickness: P.thickness,
          edgeFillet: P.edgeFillet,
          rimRoundness: P.rimRoundness,
          diameterMm: P.diameterMm,
          bailEnabled: P.bailEnabled,
          bailInnerMm: P.bailInnerMm,
          bailBand: P.bailBand,
          bailGapMm: P.bailGapMm,
          bailBlend: P.bailBlend,
        },
        geometry: {
          chords: pendantModelData.chords.map((c) => ({ a1: c.a1, a2: c.a2 })),
          circleRadius: pendantModelData.r,
          minArea: P.minArea,
          minAngle: P.minAngle,
        },
      },
      thumbnail: snapshotThumbnail(),
    });
  }
  canvas.addEventListener('design-snapshot', onDesignSnapshot);

  function crossFadeToRing(duration) {
    if (!pendantViewer) return;
    previewGen++;
    pendantViewer.crossFadeMeshFromData(buildRingPreviewMesh(100, borderThickness, previewOpts()), duration);
  }

  // Below 1 when a bail reaches past the canvas: the pendant (2D and 3D
  // together) is drawn smaller so all of it fits.
  function viewScale() {
    const fullHalf = (SIZE / 2) / (ASPECT_R - 10) * FIT_R; // model units visible at scale 1
    const reach = pendantExtent(previewOpts(), borderThickness) + 4;
    return Math.min(1, fullHalf / reach);
  }

  function compute3DHalf() {
    const outerR = FIT_R;
    const drawR = ASPECT_R - 10;
    const canvasHalf = SIZE / 2;
    return (canvasHalf / drawR) * outerR / viewScale();
  }

  function update3DCamera() {
    if (!pendantViewer || !pendantModelData) return;
    orbited = false;
    const outerR = FIT_R;
    pendantViewer.fitToRegionExact(compute3DHalf(), outerR);
    pendantViewer.pendantGroup.scale.setScalar(scale3d);
    pendantViewer.setShadowPlaneY(-(P.thickness + 2));
  }

  function ensureViewer() {
    if (!viewerPromise) viewerPromise = createViewer();
    return viewerPromise;
  }

  async function createViewer() {
    const { PendantViewer } = await import('@/modules/three-pendant-viewer');
    const viewer = new PendantViewer(chart3dCanvas, {
      enableControls: false,
      enableEdges: false,
      enableGroundPlane: false,
      enableHDRI: true,
      // 2048x1024 downscale of softbox.hdr: 4.2 MB instead of 14.4 MB
      hdriPath: '/softbox-2k.hdr',
      enablePostProcessing: true,
      background: null,
      roughness: P.roughness,
    });
    viewer.scene.background = null;

    // The renderer pinned the canvas to its size at creation, so it stopped
    // following the 2D chart when the page resized. Let CSS size it and
    // resize the drawing buffer to match.
    chart3dCanvas.style.width = '';
    chart3dCanvas.style.height = '';
    const fit3D = () => {
      const w = chart3dCanvas.clientWidth, h = chart3dCanvas.clientHeight;
      if (!w || !h) return;
      viewer.renderer.setSize(w, h, false);
      viewer.composer?.setSize(w, h);
      viewer.camera.aspect = w / h;
      viewer.camera.updateProjectionMatrix();
      // It only renders on demand, and a resize clears the canvas.
      viewer.renderOnce();
    };
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(fit3D);
      resizeObserver.observe(chart3dCanvas);
    }

    if (viewer.scene.environmentRotation !== undefined) {
      viewer.scene.environmentRotation.set(P.hdriRx * Math.PI / 180, P.hdriRy * Math.PI / 180, 0);
    }

    if (viewer.hdriReady) await viewer.hdriReady;
    viewer.addShadowPlane(-(P.thickness + 2));
    viewer.start();
    pendantViewer = viewer;
    if (options.orbit) await setupOrbit(viewer);
  }

  // ── Orbit (lab) ────────────────────────────────────────────

  let orbitControls = null;
  let orbited = false;

  function emitCamera() {
    if (!pendantViewer) return;
    const p = pendantViewer.camera.position;
    const len = Math.hypot(p.x, p.y, p.z) || 1;
    window.dispatchEvent(new CustomEvent('pendant-camera', {
      detail: { dir: [p.x / len, p.y / len, p.z / len], orbited },
    }));
  }

  async function setupOrbit(viewer) {
    const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
    const controls = new OrbitControls(viewer.camera, chart3dCanvas);
    controls.enablePan = false;
    controls.enableDamping = false; // renders on demand, no loop needed
    controls.rotateSpeed = 0.6;
    controls.minDistance = 900;
    controls.maxDistance = 4000;
    controls.addEventListener('change', () => {
      if (!orbited) { orbited = true; if (displayState) drawChartState(displayState); }
      viewer.renderOnce();
      emitCamera();
    });
    chart3dCanvas.addEventListener('dblclick', resetView);
    orbitControls = controls;
  }

  function resetView() {
    if (!pendantViewer) return;
    if (pendantModelData) update3DCamera();
    else pendantViewer.fitToRegionExact(compute3DHalf(), FIT_R);
    orbitControls?.update(); // fires 'change', which marks the view orbited
    orbited = false;
    pendantViewer.renderOnce();
    if (displayState) drawChartState(displayState);
    emitCamera();
  }

  async function start3DTransition() {
    if (!pendantModelData?.model) return;
    _3dModelReady = false;
    const gen = ++previewGen;
    const data = pendantModelData;
    const version = paramsVersion;
    try {
      await ensureViewer();
      lastBuildWasDraft = false;
      const res = await requestPreview(previewParams(false));
      if (!res || gen !== previewGen || data !== pendantModelData) return;

      const r = data.r;
      if (!shown3d) {
        pendantViewer.updateMeshFromData(buildRingPreviewMesh(r, borderThickness, previewOpts()));
        update3DCamera();
        shown3d = true;
        apply3DFade(0.8);
      }
      pendantViewer.crossFadeMeshFromData(res.mesh, 800);
      applyPreviewLoops(res.loops);
      _3dModelReady = true;
      _stopDotAnim();
      if (displayState) drawChartState(displayState);
      // Settings moved while this was building.
      if (version !== paramsVersion) refreshLivePendant('swap', false);
    } catch (err) {
      console.error('3D transition error:', err);
    }
  }

  // ── Boot ───────────────────────────────────────────────────

  lastViewScale = viewScale();

  generateChart();

  // ── Cleanup ────────────────────────────────────────────────


  return { destroy, setParams, setFocus };

  function destroy() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (spreadAnimId) cancelAnimationFrame(spreadAnimId);
    if (aspectAnimId) cancelAnimationFrame(aspectAnimId);
    if (pendantFadeId) cancelAnimationFrame(pendantFadeId);
    if (expansionAnimId) cancelAnimationFrame(expansionAnimId);
    if (_dotAnimId) cancelAnimationFrame(_dotAnimId);

    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mouseleave', onMouseLeave);
    canvas.removeEventListener('aspect-hover', onAspectHover);
    tooltip.remove();
    hoverSvg.remove();
    hoverSvgFg.remove();
    stopGrowth(false);
    stopGrowIn();
    resizeObserver?.disconnect();
    canvas.parentElement?.style.removeProperty('transform');
    locationInput.removeEventListener('input', onLocationInput);
    locationInput.removeEventListener('blur', onLocationBlur);

    for (const [el, event, handler] of listeners) {
      el.removeEventListener(event, handler);
    }

    canvas.removeEventListener('design-snapshot', onDesignSnapshot);
    chart3dCanvas.removeEventListener('dblclick', resetView);
    orbitControls?.dispose();
    if (worker) { try { worker.terminate(); } catch {} worker = null; }

    if (pendantViewer) {
      try { pendantViewer.dispose?.(); } catch {}
    }
  }
}
