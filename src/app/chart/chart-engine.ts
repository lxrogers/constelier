// @ts-nocheck
// Chart engine — extracted from natal-chart.html inline <script>
// Imperative canvas/animation logic, called from React useEffect

import { Horoscope, Origin } from '@/lib/horoscope';
import { easeInOutCubic, easeOutQuartic } from '@/modules/easing';
import { polygonArea, buildPendantModel } from '@/modules/pendant-geometry';
import { preloadWASM, buildPendant3DFromModel, buildRing3DShape } from '@/modules/pendant-builder';
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

export function initChartEngine(canvas: HTMLCanvasElement, canvas3d: HTMLCanvasElement) {
  // ── URL Params ────────────────────────────────────────────────

  const urlParams = new URLSearchParams(window.location.search);

  // ── Aspect Filter Checkboxes ────────────────────────────────

  const defaultAspects = Object.keys(ASPECT_STYLES).filter(k => k !== 'conjunction');
  const urlAspects = urlParams.get('a');
  const enabledAspects = new Set(
    urlAspects ? urlAspects.split(',').filter(a => ASPECT_STYLES[a]) : defaultAspects
  );

  {
    const container = document.getElementById('aspect-filters');
    for (const [key, style] of Object.entries(ASPECT_STYLES)) {
      if (key === 'conjunction') continue;
      const label = document.createElement('label');
      label.className = 'aspect-filter';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = enabledAspects.has(key);
      cb.dataset.aspect = key;
      cb.addEventListener('change', () => {
        if (cb.checked) enabledAspects.add(key);
        else enabledAspects.delete(key);
        // Cancel any in-progress animations
        if (aspectAnimId) { cancelAnimationFrame(aspectAnimId); aspectAnimId = null; }
        if (expansionAnimId) { cancelAnimationFrame(expansionAnimId); expansionAnimId = null; }
        if (pendantFadeId) { cancelAnimationFrame(pendantFadeId); pendantFadeId = null; }
        // Fade out old pendant + crossfade 3D back to ring
        pendantAlpha = 0;
        pendantModelData = null;
        aspectAnimLines = [];
        aspectAnimDone = false;
        if (pendantViewer && chart3dCanvas.style.opacity === '1') {
          buildRing3DShape(100, borderThickness, { thickness: 5, filletR: 2 }).then(ring => {
            if (pendantViewer) pendantViewer.crossFadeMesh(ring.shape, 'high', 400);
          }).catch(() => {});
        }
        if (displayState) drawChartState(displayState);
        startAspectAnim();
        syncURL();
      });
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = style.color;
      const name = key.charAt(0).toUpperCase() + key.slice(1);
      label.append(cb, swatch, document.createTextNode(name));
      container.appendChild(label);
    }
  }

  // ── Canvas Setup ───────────────────────────────────────────

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const SIZE = 700;
  canvas.width = SIZE * dpr;
  canvas.height = SIZE * dpr;
  canvas.style.width = SIZE + 'px';
  canvas.style.height = SIZE + 'px';
  ctx.scale(dpr, dpr);

  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const OUTER_R = 310;
  const ZODIAC_INNER_R = 265;
  const ASPECT_R = 265;
  const PLANET_R = (OUTER_R + ASPECT_R) / 2;
  const PLANET_INNER_R = 205;
  const INNER_R = 145;
  const PENDANT_R = 100 * (ASPECT_R - 10) / 108;

  // ── State ──────────────────────────────────────────────────

  let selectedLat = urlParams.has('lat') ? parseFloat(urlParams.get('lat')!) : 38.0464;
  let selectedLon = urlParams.has('lon') ? parseFloat(urlParams.get('lon')!) : -84.4970;
  let chartOpacity = 0.6;
  let filletRadius = 5;
  let borderThickness = 8;
  let lineThickness = 3;
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
  hoverLine.setAttribute('stroke', 'rgba(0,0,0,0.4)');
  hoverLine.setAttribute('stroke-width', '30');
  hoverLine.setAttribute('stroke-linecap', 'round');
  hoverSvg.appendChild(hoverLine);
  canvas.parentElement!.appendChild(hoverSvg);

  // Thin foreground line on top of 3D model
  const hoverSvgFg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  hoverSvgFg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;' +
    'pointer-events:none;z-index:3;display:none;';
  const hoverLineFg = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  hoverLineFg.setAttribute('stroke', 'rgba(255,255,255,0.8)');
  hoverLineFg.setAttribute('stroke-width', '1');
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

  function updateHoverOverlays() {
    if (hoveredAspect && aspectAnimDone) {
      const ha = hoveredAspect;
      const name1 = PLANET_NAMES[ha.point1Key] || ha.point1Key;
      const name2 = PLANET_NAMES[ha.point2Key] || ha.point2Key;
      tooltip.textContent = `Your ${name1} and ${name2} are in ${ha.aspectKey}`;
      const rect = canvas.getBoundingClientRect();
      const scale = rect.width / SIZE;
      const mx = ((ha.x1 + ha.x2) / 2) * scale;
      const my = ((ha.y1 + ha.y2) / 2) * scale;
      const dx = ha.x2 - ha.x1, dy = ha.y2 - ha.y1;
      const len = Math.hypot(dx, dy) || 1;
      let nx = -dy / len, ny = dx / len;
      const cx = SIZE / 2 * scale, cy = SIZE / 2 * scale;
      if ((mx + nx * 50 - cx) * (mx + nx * 50 - cx) + (my + ny * 50 - cy) * (my + ny * 50 - cy) <
          (mx - nx * 50 - cx) * (mx - nx * 50 - cx) + (my - ny * 50 - cy) * (my - ny * 50 - cy)) {
        nx = -nx; ny = -ny;
      }
      const absNx = Math.abs(nx);
      const offset = 30 + 50 * absNx;
      const px = mx + nx * offset;
      const py = my + ny * offset;
      tooltip.style.display = '';
      tooltip.style.left = px + 'px';
      tooltip.style.top = (py - 16) + 'px';
      tooltip.style.transform = 'translateX(-50%)';
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
      chart3dCanvas.style.transition = 'opacity 0.15s ease';
      chart3dCanvas.style.opacity = hoveredAspect ? '0.3' : '1';
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

    const year = parseInt((document.getElementById('birth-year') as HTMLInputElement).value);
    const month = parseInt((document.getElementById('birth-month') as HTMLInputElement).value);
    const date = parseInt((document.getElementById('birth-day') as HTMLInputElement).value);
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
    if (pendantViewer && chart3dCanvas.style.opacity === '1') {
      buildRing3DShape(100, borderThickness, { thickness: 5, filletR: 2 }).then(ring => {
        if (pendantViewer) pendantViewer.crossFadeMesh(ring.shape, 'high', 400);
      }).catch(() => {});
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

    // Dispatch aspects to React UI
    canvas.dispatchEvent(new CustomEvent('aspects-updated', {
      detail: collected.map(a => ({
        aspectKey: a.aspectKey,
        point1Key: a.point1Key,
        point2Key: a.point2Key,
        enabled: a.enabled,
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
    }
  }

  // ── Input Setup & Listeners ─────────────────────────────────

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function updateDayMax() {
    const year = parseInt((document.getElementById('birth-year') as HTMLInputElement).value);
    const month = parseInt((document.getElementById('birth-month') as HTMLInputElement).value);
    const max = daysInMonth(year, month);
    const daySlider = document.getElementById('birth-day') as HTMLInputElement;
    daySlider.max = String(max);
    if (parseInt(daySlider.value) > max) daySlider.value = String(max);
    document.getElementById('birth-day-val').textContent = daySlider.value;
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
      (document.getElementById('birth-year') as HTMLInputElement).value = urlParams.get('y')!;
      document.getElementById('birth-year-val')!.textContent = urlParams.get('y')!;
    }
    if (urlParams.has('m')) {
      (document.getElementById('birth-month') as HTMLInputElement).value = urlParams.get('m')!;
      const mv = parseInt(urlParams.get('m')!);
      document.getElementById('birth-month-val')!.textContent = MONTH_ABBR[mv - 1] || 'Jan';
    }
    if (urlParams.has('d')) {
      (document.getElementById('birth-day') as HTMLInputElement).value = urlParams.get('d')!;
      document.getElementById('birth-day-val')!.textContent = urlParams.get('d')!;
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
    p.set('y', (document.getElementById('birth-year') as HTMLInputElement).value);
    p.set('m', (document.getElementById('birth-month') as HTMLInputElement).value);
    p.set('d', (document.getElementById('birth-day') as HTMLInputElement).value);
    p.set('h', (document.getElementById('birth-hour') as HTMLSelectElement).value);
    p.set('mi', (document.getElementById('birth-minute') as HTMLSelectElement).value);
    p.set('lat', String(selectedLat));
    p.set('lon', String(selectedLon));
    p.set('loc', (document.getElementById('location') as HTMLInputElement).value);
    const aspects = [...enabledAspects].sort().join(',');
    p.set('a', aspects);
    history.replaceState(null, '', '?' + p.toString());
  }

  const listeners: Array<[Element, string, EventListener]> = [];
  function addListener(id: string, event: string, handler: EventListener) {
    const el = document.getElementById(id);
    if (el) { el.addEventListener(event, handler); listeners.push([el, event, handler]); }
  }

  addListener('birth-year', 'input', () => {
    document.getElementById('birth-year-val').textContent = (document.getElementById('birth-year') as HTMLInputElement).value;
    updateDayMax();
    generateChart();
    syncURL();
  });
  addListener('birth-month', 'input', () => {
    const v = parseInt((document.getElementById('birth-month') as HTMLInputElement).value);
    document.getElementById('birth-month-val').textContent = MONTH_ABBR[v - 1];
    updateDayMax();
    generateChart();
    syncURL();
  });
  addListener('birth-day', 'input', () => {
    document.getElementById('birth-day-val').textContent = (document.getElementById('birth-day') as HTMLInputElement).value;
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
  let settings3dTimer: ReturnType<typeof setTimeout> | null = null;

  function rebuildPendantFromSettings() {
    if (displayState && pendantChords) {
      const r = 100;
      pendantExpansion = lineThickness;
      const model = buildPendantModel(pendantChords, lineThickness, r, borderThickness, 185, 5, filletRadius);
      pendantModelData = { model, r, chords: pendantChords };
      pendantAlpha = 1;
      drawChartState(displayState);

      if (settings3dTimer) clearTimeout(settings3dTimer);
      settings3dTimer = setTimeout(() => {
        settings3dTimer = null;
        start3DTransition();
      }, 400);
    }
  }

  addListener('fillet-radius', 'input', () => {
    filletRadius = parseFloat((document.getElementById('fillet-radius') as HTMLInputElement).value);
    rebuildPendantFromSettings();
  });
  addListener('border-thickness', 'input', () => {
    borderThickness = parseFloat((document.getElementById('border-thickness') as HTMLInputElement).value);
    rebuildPendantFromSettings();
  });
  addListener('line-thickness', 'input', () => {
    lineThickness = parseFloat((document.getElementById('line-thickness') as HTMLInputElement).value);
    rebuildPendantFromSettings();
  });
  addListener('scale-3d', 'input', () => {
    const v = parseInt((document.getElementById('scale-3d') as HTMLInputElement).value);
    document.getElementById('scale-3d-val').textContent = v + '%';
    scale3d = v / 100;
    if (pendantViewer && pendantModelData) {
      update3DCamera();
    }
  });

  function updateHdriRotation() {
    if (!pendantViewer) return;
    const rx = parseInt((document.getElementById('hdri-rx') as HTMLInputElement).value) * Math.PI / 180;
    const ry = parseInt((document.getElementById('hdri-ry') as HTMLInputElement).value) * Math.PI / 180;
    document.getElementById('hdri-rx-val').textContent = (document.getElementById('hdri-rx') as HTMLInputElement).value + '°';
    document.getElementById('hdri-ry-val').textContent = (document.getElementById('hdri-ry') as HTMLInputElement).value + '°';
    if (pendantViewer.scene.environmentRotation !== undefined) {
      pendantViewer.scene.environmentRotation.set(rx, ry, 0);
    }
    pendantViewer.renderOnce();
  }
  addListener('hdri-rx', 'input', updateHdriRotation);
  addListener('hdri-ry', 'input', updateHdriRotation);

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
      const outerR = ASPECT_R - 10;
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
      ctx.font = '11px Graphik Web, system-ui, sans-serif';
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
      const isHighlighted = hoveredAspect &&
        (p.key === hoveredAspect.point1Key || p.key === hoveredAspect.point2Key);
      const fontSize = p.key === 'sun' ? 28 : 22;
      const weight = isHighlighted ? 600 : 400;
      ctx.font = weight + ' ' + fontSize + 'px Graphik Web, system-ui, sans-serif';
      ctx.fillStyle = isHighlighted ? '#000000' : '#2c2c2c';
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

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = style.color;
        ctx.lineWidth = isHovered ? style.width + 2.5 : style.width;
        ctx.setLineDash(style.dash);
        ctx.globalAlpha = isHovered ? 0.95 : style.opacity * chartOpacity;
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
    const planetAngles = {};
    for (const key of PLANET_KEYS) {
      const body = horoscope.CelestialBodies[key] || (horoscope.CelestialPoints && horoscope.CelestialPoints[key]);
      if (body?.ChartPosition?.Ecliptic) {
        const ecl = body.ChartPosition.Ecliptic.DecimalDegrees;
        planetAngles[key] = normDeg(180 - ecl + ascDeg) * Math.PI / 180;
      }
    }

    let aspects = [];
    try {
      if (horoscope.Aspects?.all) aspects = horoscope.Aspects.all;
      else if (Array.isArray(horoscope.Aspects)) aspects = horoscope.Aspects;
    } catch {}

    const chords = [];
    for (const asp of aspects) {
      const key = asp.aspectKey || asp.key || '';
      if (!enabledAspects.has(key)) continue;
      const a1 = planetAngles[asp.point1Key];
      const a2 = planetAngles[asp.point2Key];
      if (a1 === undefined || a2 === undefined) continue;
      chords.push({ a1, a2 });
    }
    if (chords.length === 0) return null;

    const r = 100;
    const model = buildPendantModel(chords, expansion, r, borderThickness, 185, 5, filletRadius);
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
      startExpansionAnim();
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
        const model = buildPendantModel(pendantChords, pendantExpansion, r, borderThickness, 185, 5, filletRadius);
        pendantModelData = { model, r, chords: pendantChords };
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

  function drawPendant() {
    if (!pendantModelData || pendantAlpha <= 0) { _stopDotAnim(); return; }
    const { model, r } = pendantModelData;
    const b = 8;
    const outerR = r + b;

    const drawR = ASPECT_R - 10;
    const scale = drawR / outerR;

    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, ASPECT_R - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = pendantAlpha;
    ctx.translate(CX, CY);
    ctx.scale(scale, scale);

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

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, outerR, 0, Math.PI * 2);
    for (const pts of cutouts) {
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
      ctx.closePath();
    }
    ctx.clip('evenodd');

    if (_3dModelReady) {
      // 3D model is visible — skip dot grid, just fill solid background
      ctx.globalAlpha = pendantAlpha;
      ctx.fillStyle = '#f5f0e6';
      ctx.fillRect(-outerR, -outerR, outerR * 2, outerR * 2);
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
    ctx.globalAlpha = 1;
    ctx.restore();

    _startDotAnim();
  }

  // ── 3D Transition ──────────────────────────────────────────

  const chart3dCanvas = canvas3d;
  let pendantViewer = null;
  let wasmPromise = null;

  try { wasmPromise = preloadWASM(); } catch(e) { console.warn('WASM preload failed:', e); }

  function compute3DHalf() {
    const outerR = (pendantModelData?.r || 100) + 8;
    const drawR = ASPECT_R - 10;
    const canvasHalf = SIZE / 2;
    return (canvasHalf / drawR) * outerR;
  }

  function update3DCamera() {
    if (!pendantViewer || !pendantModelData) return;
    const outerR = pendantModelData.r + 8;
    pendantViewer.fitToRegionExact(compute3DHalf(), outerR);
    pendantViewer.pendantGroup.scale.setScalar(scale3d);
    pendantViewer.setShadowPlaneY(-7);
  }

  async function ensureViewer() {
    if (pendantViewer) return;
    const THREE = await import("three");
    const { PendantViewer } = await import('@/modules/three-pendant-viewer');
    pendantViewer = new PendantViewer(chart3dCanvas, {
      enableControls: false,
      enableEdges: false,
      enableGroundPlane: false,
      enableHDRI: true,
      hdriPath: '/softbox.hdr',
      enablePostProcessing: true,
      background: null,
      roughness: 0,
    });
    pendantViewer.scene.background = null;

    if (pendantViewer.scene.environmentRotation !== undefined) {
      pendantViewer.scene.environmentRotation.set(344 * Math.PI / 180, 308 * Math.PI / 180, 0);
    }

    if (pendantViewer.hdriReady) await pendantViewer.hdriReady;
    pendantViewer.addShadowPlane(-7);
    pendantViewer.start();
  }

  async function start3DTransition() {
    if (!pendantModelData?.model) return;
    _3dModelReady = false;
    try {
      if (wasmPromise) await wasmPromise;
      await ensureViewer();

      const r = pendantModelData.r;
      const opts = { thickness: 5, filletR: 2 };

      if (chart3dCanvas.style.opacity !== '1') {
        const ring = await buildRing3DShape(r, borderThickness, opts);
        pendantViewer.updateMesh(ring.shape, 'high');
        update3DCamera();
        chart3dCanvas.style.opacity = '1';
      }

      const full = await buildPendant3DFromModel(pendantModelData.model, r, borderThickness, opts);
      pendantViewer.crossFadeMesh(full.shape, 'high', 800);
      _3dModelReady = true;
      _stopDotAnim();
      if (displayState) drawChartState(displayState);
    } catch (err) {
      console.error('3D transition error:', err);
    }
  }

  // ── Boot ───────────────────────────────────────────────────

  generateChart();

  // ── Cleanup ────────────────────────────────────────────────

  return function destroy() {
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
    locationInput.removeEventListener('input', onLocationInput);
    locationInput.removeEventListener('blur', onLocationBlur);

    for (const [el, event, handler] of listeners) {
      el.removeEventListener(event, handler);
    }

    if (pendantViewer) {
      try { pendantViewer.dispose?.(); } catch {}
    }
  };
}
