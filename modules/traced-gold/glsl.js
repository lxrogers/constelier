// The traced gold: shaders for a pendant that mirrors itself and casts sun
// shadows, cheaply enough to run live. Everything is worked out in the
// pendant's own "rig" space: it lies in the XY plane, centred on the origin,
// seen from +z, with a surface just behind it at z = uPlaneZ.
//
// What they do that a stock PBR material cannot:
//  - Reflection rays are traced against the pendant's distance field, so bars
//    and edges reflect each other and the surface underneath (two bounces).
//  - The environment has a light card at a finite distance, so a flat mirror
//    face shows a gradient across it instead of one flat colour.
//  - Shadows are traced toward the sun with a penumbra that widens with
//    distance from the edge that casts it, like a real sun.
//  - The pendant can be drawn straight from the distance field while it
//    changes shape, which is how it flows in and drains out.

export const COMMON = /* glsl */ `
uniform sampler2D uSdf;
uniform float uExtent, uHalf, uRound, uPlaneZ;
uniform vec3 uSunDir, uSunColor, uAmbient, uGold;
uniform float uSunK, uSunDisc;
uniform sampler2D uEnv;
uniform mat3 uEnvRot;
uniform float uEnvGain, uRough, uExposure;
uniform vec3 uCardPos, uCardU, uCardV, uCardColor;
uniform vec2 uCardHalf;
uniform float uCardGain, uCardLo;
uniform float uTrace, uShadows, uSurface, uGobo, uAo;   // uSurface: 0 speckled stone, 1 plaster wall, 2 none (only the shadow is drawn), 3 paper with the chart drawn on it
uniform sampler2D uChart;                                 // surface 3: the 2D chart, covering the square of half-width uChartHalf
uniform float uChartHalf;
uniform vec2 uGoboDrift;                                  // slides the patches of shade, for light that moves
uniform vec4 uBar;                                        // the glazing bar's shadow: angle (radians), offset from the pendant, width, how much light is left in it
uniform float uBarSoft;                                   // and how wide its soft edge is
uniform sampler2D uGrid;                                  // pictures of other pendants on their charts, seen from above: 4 across, 3 down
uniform float uGridPitch;                                 // the distance between neighbours in that grid; 0: there is no grid
uniform float uWindow;                                    // 1: the sun comes through a distant window (one broad patch of light, one bar's shadow)
uniform vec3 uHorizon;                                    // a room's walls: light added to reflections that leave level with the surface
uniform vec3 uSky;                                        // a broad glow centred on the light card, so a rounded edge shades smoothly from lit to dark instead of dropping off the card
uniform float uRimP, uRimRise, uRimDome, uRimDrop, uRimW;   // mode 6 (ceremony): the rim forming, before the inside flows in
uniform vec3 uCam;                                        // the camera, in rig space
// Reveal animation. uMode: 0 none, 1 outline first, 2 rise, 3 liquid, 4 pour, 5 flow in, 6 ceremony.
// With uKeepRim the rim (everything beyond radius uRimR) is there throughout and only the inside animates.
uniform float uKeepRim, uRimR, uSplit;   // uSplit: a radius on the rim's flat top; beyond it the kept rim is always the real mesh
bool gRimOnly = false;
bool gFinished = false;   // set while shading the real mesh, which is always the finished shape
uniform float uMode, uP, uRise, uDome, uDrop, uOutR, uOutZ, uTop, uAlpha, uShadowGain, uGlint;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}


float sd2(vec2 p) { return texture2D(uSdf, p / (2.0 * uExtent) + 0.5).r; }

// Smooth intersection: where the two meet, the corner is a rounded bead.
float smax(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(a, b, h) + k * h * (1.0 - h);
}

// The outline as it stands part-way through a reveal: the finished outline's
// metal, limited to where the reveal has got to. A kept rim is the finished
// outline beyond uRimR, cut on that exact circle, joined to whatever has
// arrived; metal that has arrived covers the joint, so it leaves no seam.
float sd2v(vec2 p, float d) {
  float r = length(p);
  if (uMode < 0.5) return gRimOnly ? max(d, uRimR - r) : d;
  if (uMode > 5.5) {
    // Ceremony, for a pendant arriving out of nothing. The rim comes first, as
    // a loop: gold sets off as a drop at the top of the bail, runs down it and flows both ways round the ring,
    // behind the same rounded front as "flow in", to meet at the bottom. Then
    // the inside flows in from it.
    float mid = uRimR + 0.5 * uRimW;
    float top = uExtent / 1.2, edge = uRimR + uRimW;                      // the top of the bail, and the rim's outer edge
    float round_ = abs(atan(p.x, p.y)) * mid + top - max(r, edge);        // how far along that path from the top of the bail
    float lead = uRimP * (3.35 * mid + top - edge) - 3.0 + 6.0 * uRimP * (1.0 - uRimP) * (vnoise(vec2(r * 0.11, 2.0)) - 0.5);
    float rim = smax(max(d, uRimR - r), round_ - lead, 6.0);
    float front = mix(uRimR + uRimW + 8.0, -18.0, uP) + 14.0 * min(1.0, uP * 5.0) * (vnoise(normalize(p + 1e-3) * 2.6 + 4.0) - 0.5) - r;
    return min(rim, smax(max(d, r - edge), front, 7.0));                  // the bail belongs to the loop, not to the inside
  }
  float shape;
  if (uMode < 1.5) shape = max(d, -d - mix(1.2, 46.0, uP * uP));                      // outline first: a ribbon along every edge, widening inward
  else if (uMode < 2.5) shape = d;                                                     // rise: only the height changes
  else if (uMode < 3.5) shape = d + (1.0 - uP) * (1.0 + 3.5 * vnoise(p * 0.06 + 3.0));  // liquid: edges pull in, unevenly
  else {
    float front = uMode < 4.5
      ? mix(uExtent, -uExtent, uP) + 16.0 * (vnoise(vec2(p.x * 0.035, 1.7)) - 0.5) - p.y                                   // pour: a wavy front moving down
      : mix(uRimR + 2.0, -18.0, uP) + 14.0 * min(1.0, uP * 5.0) * (vnoise(normalize(p + 1e-3) * 2.6 + 4.0) - 0.5) - r;    // flow in: closing from the rim
    shape = smax(d, front, 7.0);
  }
  return uKeepRim > 0.5 ? min(max(d, uRimR - r), shape) : shape;
}
float sd2v(vec2 p) { return sd2v(p, sd2(p)); }

// Distance to a slab whose edge is rounded by a quarter ellipse a wide and b
// tall. x: signed distance to the edge in plan (negative inside). z: height
// above the middle of the slab. hh: half its thickness. Measured in the
// ellipse's own stretched space and scaled back by its smaller radius, so it
// never overstates the distance and a ray marching on it cannot skip through.
float corner(float x, float z, float hh, float a, float b) {
  vec2 w = vec2(x + a, z - hh + b) / vec2(a, b);
  return (min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - 1.0) * min(a, b);
}

// The pendant as a solid standing on its bottom face, rounded top and bottom:
// void edges get the small rounding and the outer rim its wider one, the same
// profiles as the mesh, so a reveal ends on the finished pendant's shape.
// Shadows are always traced against this one shape, during a reveal and after
// it, so they do not shift when the reveal hands over to the mesh. Its
// thickness and rounding are what let the metal swell, bead and settle.
float sdField(vec3 p) {
  vec2 f = texture2D(uSdf, p.xy / (2.0 * uExtent) + 0.5).rg;
  float d = sd2v(p.xy, f.r);
  // 1 on the rim when it is being kept, so it holds its finished shape.
  bool forming = uMode > 5.5;   // the rim is animating too, with a thickness and rounding of its own
  float w = uKeepRim > 0.5 || forming ? smoothstep(uRimR - 7.0, uRimR - 1.0, length(p.xy)) : 0.0;
  float rise = mix(uRise, forming ? uRimRise : 1.0, w), hh = uHalf * rise, z = abs(p.z + uHalf - hh);
  float toOuter = max(f.r, 0.0) - f.g;                               // signed distance to the outer edge alone, ignoring the voids
  float edges = corner(d, z, hh, mix(uDome, forming ? uRimDome : uRound, w), min(mix(uDrop, forming ? uRimDrop : uRound, w), hh));
  float outer = corner(toOuter, z, hh, uOutR, min(uOutZ * rise, hh));
  return 0.85 * max(edges, outer);
}

// What reflections are traced against: the reveal's shape while it is moving,
// otherwise the finished pendant. That is the same solid as sdField at rest,
// with the mesh's own edge profiles. (It used to be a simpler slab with one
// small rounding everywhere. The real rim is rounded much further in, so the
// mesh sat inside that slab's squarer shoulder, and rays leaving the rim
// caught it: the rim was drawn with the bands of a stepped, two-tier edge.)
float sdPendant(vec3 p) {
  if (uMode > 0.5 && !gFinished) return sdField(p);
  vec2 f = texture2D(uSdf, p.xy / (2.0 * uExtent) + 0.5).rg;
  float d = gRimOnly ? max(f.r, uRimR - length(p.xy)) : f.r, z = abs(p.z);
  return 0.85 * max(corner(d, z, uHalf, uRound, uRound), corner(max(f.r, 0.0) - f.g, z, uHalf, uOutR, uOutZ));
}

// Across the surface the taps are wide, to average out the grain of the
// distance map, which otherwise shows as facets on the moving metal. Up and
// down the shape is exact, so that tap stays tight.
vec3 fieldNormal(vec3 p) {
  vec2 e = vec2(1.5, 0.0);
  float ez = 0.3;
  return normalize(vec3(
    sdField(p + e.xyy) - sdField(p - e.xyy),
    sdField(p + e.yxy) - sdField(p - e.yxy),
    (sdField(p + vec3(0.0, 0.0, ez)) - sdField(p - vec3(0.0, 0.0, ez))) * e.x / ez));
}

vec3 sdNormal(vec3 p) {
  vec2 e = vec2(0.7, 0.0);
  return normalize(vec3(
    sdPendant(p + e.xyy) - sdPendant(p - e.xyy),
    sdPendant(p + e.yxy) - sdPendant(p - e.yxy),
    sdPendant(p + e.yyx) - sdPendant(p - e.yyx)));
}

bool outside(vec3 p) { return max(abs(p.x), abs(p.y)) > uExtent; }

// 0 in full shadow, 1 in full sun. Only the stretch of the ray that is still
// below the pendant's top face can be blocked, so the march is short.
float softShadow(vec3 ro, vec3 rd) {
  float tmax = rd.z > 1e-4 ? min(600.0, (uTop - ro.z) / rd.z) : 600.0;
  float res = 1.0, t = 0.5;
  for (int i = 0; i < 48; i++) {
    if (t > tmax) break;
    vec3 p = ro + rd * t;
    if (outside(p)) break;
    float d = sdField(p);
    if (d < 0.02) return 0.0;
    res = min(res, uSunK * d / t);
    t += clamp(d, 0.35, 16.0);
  }
  return res * res * (3.0 - 2.0 * res);
}

// Distance along the ray to the pendant, or -1.
float traceGold(vec3 ro, vec3 rd) {
  float tmax = 400.0;
  if (rd.z > 1e-4) tmax = min(tmax, (uTop - ro.z) / rd.z);
  else if (rd.z < -1e-4) tmax = min(tmax, (-uHalf - ro.z) / rd.z);
  float t = 0.0;
  // Small steps near a surface: with coarse ones a ray skimming a bar's side
  // lands inside it at a ragged depth, and the side is drawn as jagged
  // patches of the wrong reflection. A ray that creeps along a surface until
  // the steps run out counts as a miss, which shades cleanly.
  for (int i = 0; i < 56; i++) {
    if (t > tmax) return -1.0;
    vec3 p = ro + rd * t;
    if (outside(p)) return -1.0;
    float d = sdPendant(p);
    if (d < 0.02) return t > 1.0 ? t : -1.0;   // a hit right where the ray set off is the surface it left
    t += max(d, 0.07);
  }
  return -1.0;
}

vec3 envMap(vec3 d, float lod) {
  vec3 e = uEnvRot * d;
  vec2 uv = vec2(atan(e.z, e.x) / 6.2831853 + 0.5, acos(clamp(e.y, -1.0, 1.0)) / 3.14159265);
  vec3 c = textureLod(uEnv, uv, lod).rgb;
  // Straight up or down, an equirectangular map pinches to a point: next-door
  // directions land on opposite sides of it, and a flat face mirroring that
  // spot gets a hard line across it. Near the poles, blend into the average
  // of the ring around them.
  float pole = smoothstep(0.78, 0.97, abs(e.y));
  if (pole > 0.0) {
    vec3 ring = vec3(0.0);
    for (int i = 0; i < 6; i++) ring += textureLod(uEnv, vec2(uv.x + float(i) / 6.0, uv.y), lod + 3.0).rgb;
    c = mix(c, ring / 6.0, pole);
  }
  return c * uEnvGain;
}

// A studio environment is dark level with the surface; a rounded edge mirrors
// that as a dark band through its middle, between the light above and the lit
// surface below, and reads as hollow. A room has walls there.
vec3 room(vec3 d) { return uHorizon * (1.0 - smoothstep(0.0, 0.5, abs(d.z))); }

// A soft-edged light card at a real position in the scene.
vec3 lightCard(vec3 o, vec3 d) {
  vec3 n = cross(uCardU, uCardV);
  float dn = dot(d, n);
  if (abs(dn) < 1e-4) return vec3(0.0);
  float t = dot(uCardPos - o, n) / dn;
  if (t <= 0.0) return vec3(0.0);
  vec3 q = o + d * t - uCardPos;
  vec2 l = vec2(dot(q, uCardU), dot(q, uCardV)) / uCardHalf;
  float edge = smoothstep(1.0, 0.6, abs(l.x)) * smoothstep(1.0, 0.6, abs(l.y));
  return uCardColor * uCardGain * edge * mix(uCardLo, 1.0, smoothstep(-1.0, 1.0, l.x));
}


vec3 speck(vec3 col, vec2 p, float cell, float seed, float chance) {
  vec2 g = p / cell, id = floor(g) + seed, f = fract(g) - 0.5;
  if (hash(id) > chance) return col;
  vec2 off = (vec2(hash(id + 1.7), hash(id + 9.2)) - 0.5) * 0.6;
  float r = mix(0.05, 0.2, hash(id + 3.1));
  vec2 q = (f - off) * vec2(1.0, mix(1.0, 2.2, hash(id + 5.3)));   // some are flecks, not dots
  return mix(col, vec3(0.16, 0.15, 0.135), 0.75 * smoothstep(r, r * 0.5, length(q)));
}

// The other pendants of a grid, of which this one is the third in the second
// row. They are flat pictures on the paper (rgb as displayed; a: how much of
// the picture shows here, fading out at its edge), not metal.
vec4 gridTile(vec2 p) {
  if (uGridPitch <= 0.0) return vec4(0.0);
  vec2 cell = floor(p / uGridPitch + 0.5);
  float col = cell.x + 2.0, row = 1.0 - cell.y;
  if (cell == vec2(0.0) || col < 0.0 || col > 3.0 || row < 0.0 || row > 2.0) return vec4(0.0);
  vec2 uv = (p - cell * uGridPitch) / (2.0 * uChartHalf) + 0.5;
  vec2 e = min(uv, 1.0 - uv);
  float a = smoothstep(0.0, 0.05, min(e.x, e.y));
  if (a <= 0.0) return vec4(0.0);
  return vec4(texture2D(uGrid, vec2((col + uv.x) / 4.0, 1.0 - (row + 1.0 - uv.y) / 3.0)).rgb, a);
}

vec3 surfaceAlbedo(vec2 p) {
  if (uSurface > 2.5) {                                                                   // paper, with the chart's ink on it
    vec3 paper = vec3(0.913, 0.871, 0.791) * (0.985 + 0.03 * vnoise(p * 1.3));
    vec2 uv = p / (2.0 * uChartHalf) + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return paper;
    vec4 ink = texture2D(uChart, uv);
    return mix(paper, ink.rgb, ink.a);
  }
  if (uSurface > 0.5) return vec3(0.86, 0.845, 0.81) * (0.98 + 0.04 * vnoise(p * 1.7));   // plaster wall
  vec3 col = vec3(0.64, 0.605, 0.555) * (0.93 + 0.14 * vnoise(p * 0.03));                  // speckled stone
  col = speck(col, p, 8.0, 0.0, 0.16);
  col = speck(col, p, 3.5, 31.0, 0.08);
  return col;
}

// Soft patches of shade drifting across the scene, as if the sun came through leaves.
float gobo(vec3 p) {
  vec2 s = p.xy - uSunDir.xy * (p.z / max(uSunDir.z, 0.05));   // where this point's sun ray lands on the surface
  vec2 q = s * 0.0042 + uGoboDrift;
  float n = vnoise(q + 3.7) * 0.65 + vnoise(q * 2.3 + 11.0) * 0.35;
  float light = mix(1.0, smoothstep(0.34, 0.62, n), uGobo);
  if (uWindow > 0.0) {
    // Light from a window some way off: one broad, slanted patch of sun whose
    // edges are very soft, with the wide shadow of a single glazing bar
    // falling across it beside the pendant.
    vec2 w = mat2(0.906, 0.423, -0.423, 0.906) * (s - vec2(40.0, 10.0));
    vec2 q2 = abs(w) - vec2(1500.0, 1000.0);
    float sunlit = 1.0 - smoothstep(-70.0, 70.0, max(q2.x, q2.y));
    float across = dot(s, vec2(cos(uBar.x), sin(uBar.x))) - uBar.y;
    float bar = mix(uBar.w, 1.0, smoothstep(0.5 * uBar.z, 0.5 * uBar.z + uBarSoft, abs(across)));
    light *= mix(1.0, mix(0.2, 1.0, sunlit * bar), uWindow);
  }
  return light;
}

// What reaches a point on the surface. x: direct sun, 0 in the pendant's
// shadow. y: skylight, lower close to the metal.
vec2 planeLight(vec3 s) {
  float shadow = 1.0;
  if (uShadows > 0.5) {
    vec3 o = s + vec3(0, 0, 0.05);
    float before = 1.0;            // the shadow before the metal arrives: none, or the rim's alone
    if (uKeepRim > 0.5 && uShadowGain < 1.0) { gRimOnly = true; before = softShadow(o, uSunDir); gRimOnly = false; }
    shadow = uShadowGain > 0.0 ? mix(before, softShadow(o, uSunDir), uShadowGain) : before;
  }
  float ao = outside(s) ? 1.0 : 1.0 - uAo * uShadowGain * exp(-max(sd2v(s.xy), 0.0) / (1.3 * uHalf));
  return vec2(shadow, ao);
}

vec3 shadePlane(vec3 s) {
  vec2 l = planeLight(s);
  // What skylight does arrive close to the metal is tinted by it.
  vec3 sky = uAmbient * l.y * mix(uGold, vec3(1.0), l.y);
  return surfaceAlbedo(s.xy) * (uSunColor * max(uSunDir.z, 0.0) * gobo(s) * l.x + sky);
}

// What a ray that missed the pendant sees: the surface behind, or the lights.
vec3 radiance(vec3 o, vec3 d) {
  vec3 toCard = normalize(uCardPos);
  if (d.z < -1e-4) {
    // The surface, giving way far off to what the environment shows at its
    // edge. Without that, a rounded edge mirrors a hard line where its
    // reflection passes from the room to the surface, a line that reads as a
    // groove and makes the edge look hollow.
    float t = (uPlaneZ - o.z) / d.z;
    vec3 level = normalize(vec3(d.xy, 1e-4));
    vec3 edge = envMap(level, uRough * 7.0) + room(level) + uSky * max(dot(level, toCard), 0.0);
    return mix(shadePlane(o + d * t), edge, smoothstep(350.0, 3500.0, t));
  }
  float sun = smoothstep(uSunDisc, mix(uSunDisc, 1.0, 0.5), dot(d, uSunDir));
  vec3 glow = uSky * max(dot(d, toCard), 0.0);
  return envMap(d, uRough * 7.0) + room(d) + glow + lightCard(o, d) + uSunColor * 7.0 * sun * gobo(o);
}

vec3 fresnel(float c) { return uGold + (1.0 - uGold) * pow(1.0 - clamp(c, 0.0, 1.0), 5.0); }

// Linear light to display. Highlights roll off by brightness, not per channel,
// so bright gold stays gold instead of bleaching to lemon; only the very
// brightest glints are let go to white.
vec3 display(vec3 c) {
  c *= uExposure;
  float m = max(c.r, max(c.g, c.b));
  if (m <= 0.72) return c;
  float k = (0.72 + 0.28 * tanh((m - 0.72) / 0.28)) / m;
  return mix(c * k, vec3(m * k), 0.85 * smoothstep(1.6, 6.0, m));
}
`;

// Positions and normals are handed on in rig space, whatever the object's own
// place in the scene.
export const VERT = /* glsl */ `
uniform mat4 uRigInv;
varying vec3 vP, vN;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = (uRigInv * w).xyz;
  vN = normalize(mat3(uRigInv) * mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

// Gold at point p with normal n, seen from direction v.
const SHADE = /* glsl */ `
vec3 goldColor(vec3 p, vec3 n, vec3 v) {
  vec3 r = reflect(-v, n);
#ifdef STUDIO_RING
  // A broad reflection of the matte table, fading into the softbox at the
  // horizon. Directional lighting stays continuous as the settings rotate.
  // Filter over a cone as well as across mip levels. A single equirectangular
  // lookup keeps long, high-contrast softbox edges even at coarse mip levels.
  vec3 tangent = normalize(cross(r, abs(r.z) < 0.9 ? vec3(0,0,1) : vec3(0,1,0)));
  vec3 bitangent = cross(r, tangent);
  float lod = uRough * 9.0 + 1.0;
  vec3 studio = 0.4 * envMap(r, lod);
  for (int i = 0; i < 6; i++) {
    float angle = float(i) * 1.04719755;
    vec3 offset = cos(angle) * tangent + sin(angle) * bitangent;
    studio += 0.1 * envMap(normalize(r + 0.45 * uRough * offset), lod);
  }
  studio += 0.30 * uAmbient;
  float key = smoothstep(-0.15, 0.98, dot(r, normalize(uCardPos)));
  studio += uCardGain * uCardColor * key * key;
  vec3 table = vec3(0.68, 0.66, 0.63) * (0.8 - 0.2 * r.z);
  return mix(table, studio, smoothstep(-0.45, 0.22, r.z)) * fresnel(dot(n, v));
#else
  // The mesh and the distance field differ slightly at rounded edges: start
  // just outside whichever is further out.
  // (Self-reflections are traced while the metal is moving too, so its sides
  // look the same mid-flow as they do once it has set.)
  vec3 o = p + n * (0.35 + max(0.0, -sdPendant(p)));
  vec3 col;
  float t = uTrace > 0.5 ? traceGold(o, r) : -1.0;
  if (t >= 0.0) {
    vec3 q = o + r * t, n2 = sdNormal(q), r2 = reflect(r, n2);
    vec3 o2 = q + n2 * 0.4;
    // The visible surface supplies the full alloy color below. Keep a little
    // warmth on the reflected surface while preserving its Fresnel luminance.
    vec3 secondary = fresnel(dot(n2, -r));
    float brightness = dot(secondary, vec3(0.2126, 0.7152, 0.0722));
    col = radiance(o2, r2) * mix(vec3(brightness), secondary, 0.30);
    // An unresolved further hit attenuates the light by a neutral factor.
    if (traceGold(o2, r2) >= 0.0) col *= 0.6;
  } else {
    col = radiance(o, r);
  }
  // Glint: a band of light crossing the piece, strongest on its edges.
  float band = exp(-pow((dot(p.xy, vec2(0.83, -0.56)) - uGlint) / 16.0, 2.0));
  col += vec3(1.0, 0.95, 0.85) * band * (0.5 + 3.0 * (1.0 - n.z * n.z));
  // Polished metal mirrors the room, which the window's shade does not change;
  // left at that, the piece ignores a shadow lying right across it. So the
  // metal gives up most of what the paper beside it loses.
  if (uWindow > 0.0) {
    float sun = dot(uSunColor, vec3(0.333)) * max(uSunDir.z, 0.0), sky = dot(uAmbient, vec3(0.333));
    col *= mix(1.0, (sun * gobo(p) + sky) / (sun + sky), 0.75 * uWindow);
  }
  return col * fresnel(dot(n, v));
#endif
}
`;

export const GOLD_FRAG = /* glsl */ `
varying vec3 vP, vN;
${COMMON}
${SHADE}
void main() {
  vec3 n = normalize(vN), v = normalize(uCam - vP);
  if (dot(n, v) < 0.0) n = -n;
  gFinished = true;
  // A kept rim is always drawn from the mesh, out from uSplit, so its outline never changes hands; only the inside fades.
  float a = uKeepRim > 0.5 ? mix(uAlpha, 1.0, step(uSplit, length(vP.xy))) : uAlpha;
  if (a < 0.002) discard;   // mid-reveal most of the mesh is not showing: do not trace reflections for it
  gl_FragColor = vec4(display(goldColor(vP, n, v)), a);
  #include <colorspace_fragment>
}
`;

// During a reveal the pendant is not the mesh: this is drawn on a box around
// the pendant's slab, and each pixel marches from where its ray enters the
// box into the animated solid, so it is whole from every angle.
export const REVEAL_FRAG = /* glsl */ `
varying vec3 vP, vN;
${COMMON}
${SHADE}
void main() {
  vec3 rd = normalize(vP - uCam), p = vP;
  float px = 0.75 * length(fwidth(vP));   // about a pixel, in the pendant's units
  // A ray that enters over the kept rim and cannot get back inside uSplit
  // before it leaves the slab would be discarded below: skip its march.
  if (uKeepRim > 0.5 && length(vP.xy) - (uTop + uHalf + 0.8) * length(rd.xy) / max(abs(rd.z), 1e-3) > uSplit + 0.5) discard;
  bool hit = false;
  float nearest = 1e3;
  vec3 at = p;
  for (int i = 0; i < 96; i++) {
    float d = sdPendant(p);
    if (d < nearest) { nearest = d; at = p; }
    if (d < 0.03) { hit = true; break; }
    p += rd * max(d, 0.04);
    if (outside(p) || p.z < -uHalf - 0.4 || p.z > uTop + 0.4) break;
  }
  // A ray that only just misses is a pixel on the outline: it is drawn partly
  // covered, from where it passed closest, so the moving metal has the same
  // soft edge as the mesh rather than a stair-stepped one.
  float cover = 1.0;
  if (!hit) {
    if (nearest > px) discard;
    cover = 1.0 - nearest / px;
    p = at;
  }
  // Beyond uSplit a kept rim is the mesh's to draw (see GOLD_FRAG); the two overlap slightly on the rim's flat top, where they match.
  if (uKeepRim > 0.5 && length(p.xy) > uSplit + 0.5) discard;
  gl_FragColor = vec4(display(goldColor(p, fieldNormal(p), -rd)), cover);
  #include <colorspace_fragment>
}
`;

export const PLANE_FRAG = /* glsl */ `
varying vec3 vP, vN;
${COMMON}
void main() {
  if (uSurface > 1.5 && uSurface < 2.5) {
    // No surface of its own: just the pendant's shadow, laid over whatever is behind the canvas.
    vec2 l = planeLight(vP);
    gl_FragColor = vec4(0.2, 0.17, 0.13, min(0.5, 0.26 * (1.0 - l.x) + 0.5 * (1.0 - l.y)));
  } else {
    vec3 col = display(shadePlane(vP));
    vec4 tile = gridTile(vP.xy);
    if (tile.a > 0.0) {
      // A neighbour's picture was taken in full sun; here it takes whatever the window gives this spot.
      vec3 full = uSunColor * max(uSunDir.z, 0.0) + uAmbient;
      // The picture is screen colour: take it back to light (display() the other way), relight it, and show it again.
      float m = max(tile.r, max(tile.g, tile.b)), x = min((m - 0.72) / 0.28, 0.999);
      vec3 lit = (m <= 0.72 ? tile.rgb : tile.rgb * (0.72 + 0.14 * log((1.0 + x) / (1.0 - x))) / m) / uExposure;
      col = mix(col, display(lit * (uSunColor * max(uSunDir.z, 0.0) * gobo(vP) + uAmbient) / full), tile.a);
    }
    gl_FragColor = vec4(col, 1.0);
  }
  #include <colorspace_fragment>
}
`;
