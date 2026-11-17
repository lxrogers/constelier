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
uniform float uTrace, uShadows, uSurface, uGobo, uAo;   // uSurface: 0 speckled stone, 1 plaster wall, 2 none (only the shadow is drawn)
uniform vec3 uCam;                                        // the camera, in rig space
// Reveal animation. uMode: 0 none, 1 outline first, 2 rise, 3 liquid, 4 pour, 5 flow in.
// With uKeepRim the rim (everything beyond radius uRimR) is there throughout and only the inside animates.
uniform float uKeepRim, uRimR;
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
float sd2v(vec2 p) {
  float d = sd2(p), r = length(p);
  if (uMode < 0.5) return gRimOnly ? max(d, uRimR - r) : d;
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
  float d = sd2v(p.xy);
  // 1 on the rim when it is being kept, so it holds its finished shape.
  float w = uKeepRim > 0.5 ? smoothstep(uRimR - 7.0, uRimR - 1.0, length(p.xy)) : 0.0;
  float rise = mix(uRise, 1.0, w), hh = uHalf * rise, z = abs(p.z + uHalf - hh);
  vec2 f = texture2D(uSdf, p.xy / (2.0 * uExtent) + 0.5).rg;
  float toOuter = max(f.r, 0.0) - f.g;                               // signed distance to the outer edge alone, ignoring the voids
  float edges = corner(d, z, hh, mix(uDome, uRound, w), min(mix(uDrop, uRound, w), hh));
  float outer = corner(toOuter, z, hh, uOutR, min(uOutZ * rise, hh));
  return 0.85 * max(edges, outer);
}

// What reflections are traced against: the reveal's shape while it is moving,
// otherwise the finished outline extruded to the pendant's thickness with
// rounded edges, which is a true distance and so safe for mirror bounces.
float sdPendant(vec3 p) {
  if (uMode > 0.5 && !gFinished) return sdField(p);
  float d = sd2(p.xy);
  if (gRimOnly) d = max(d, uRimR - length(p.xy));
  vec2 w = vec2(d + uRound, abs(p.z) - uHalf + uRound);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - uRound;
}

vec3 fieldNormal(vec3 p) {
  vec2 e = vec2(0.6, 0.0);
  return normalize(vec3(
    sdField(p + e.xyy) - sdField(p - e.xyy),
    sdField(p + e.yxy) - sdField(p - e.yxy),
    sdField(p + e.yyx) - sdField(p - e.yyx)));
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
  for (int i = 0; i < 40; i++) {
    if (t > tmax) return -1.0;
    vec3 p = ro + rd * t;
    if (outside(p)) return -1.0;
    float d = sdPendant(p);
    if (d < 0.03) return t;
    t += max(d, 0.25);
  }
  return -1.0;
}

vec3 envMap(vec3 d, float lod) {
  vec3 e = uEnvRot * d;
  vec2 uv = vec2(atan(e.z, e.x) / 6.2831853 + 0.5, acos(clamp(e.y, -1.0, 1.0)) / 3.14159265);
  return textureLod(uEnv, uv, lod).rgb * uEnvGain;
}

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

vec3 surfaceAlbedo(vec2 p) {
  if (uSurface > 0.5) return vec3(0.86, 0.845, 0.81) * (0.98 + 0.04 * vnoise(p * 1.7));   // plaster wall
  vec3 col = vec3(0.64, 0.605, 0.555) * (0.93 + 0.14 * vnoise(p * 0.03));                  // speckled stone
  col = speck(col, p, 8.0, 0.0, 0.16);
  col = speck(col, p, 3.5, 31.0, 0.08);
  return col;
}

// Soft patches of shade drifting across the scene, as if the sun came through leaves.
float gobo(vec3 p) {
  vec2 q = (p.xy - uSunDir.xy * (p.z / max(uSunDir.z, 0.05))) * 0.0042;
  float n = vnoise(q + 3.7) * 0.65 + vnoise(q * 2.3 + 11.0) * 0.35;
  return mix(1.0, smoothstep(0.34, 0.62, n), uGobo);
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
  if (d.z < -1e-4) return shadePlane(o + d * ((uPlaneZ - o.z) / d.z));
  float sun = smoothstep(uSunDisc, mix(uSunDisc, 1.0, 0.5), dot(d, uSunDir));
  return envMap(d, uRough * 7.0) + lightCard(o, d) + uSunColor * 7.0 * sun * gobo(o);
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
  // The mesh and the distance field differ slightly at rounded edges: start
  // just outside whichever is further out.
  // Mid-reveal the shape is not a true distance field, so self-reflections wait for the finished piece.
  bool still = uMode < 0.5 || gFinished;
  vec3 o = p + n * (0.35 + (still ? max(0.0, -sdPendant(p)) : 0.0));
  vec3 col;
  float t = uTrace > 0.5 && still ? traceGold(o, r) : -1.0;
  if (t >= 0.0) {
    vec3 q = o + r * t, n2 = sdNormal(q), r2 = reflect(r, n2);
    vec3 o2 = q + n2 * 0.4;
    // Second bounce; a third is approximated by dim, doubly tinted light.
    col = fresnel(dot(n2, -r)) * (traceGold(o2, r2) >= 0.0 ? uGold * uAmbient * 0.7 : radiance(o2, r2));
  } else {
    col = radiance(o, r);
  }
  // Glint: a band of light crossing the piece, strongest on its edges.
  float band = exp(-pow((dot(p.xy, vec2(0.83, -0.56)) - uGlint) / 16.0, 2.0));
  col += vec3(1.0, 0.95, 0.85) * band * (0.5 + 3.0 * (1.0 - n.z * n.z));
  return col * fresnel(dot(n, v));
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
  float a = uKeepRim > 0.5 && uMode < 0.5 ? mix(uAlpha, 1.0, smoothstep(uRimR - 1.5, uRimR + 0.5, length(vP.xy))) : uAlpha;
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
  bool hit = false;
  for (int i = 0; i < 96; i++) {
    float d = sdPendant(p);
    if (d < 0.03) { hit = true; break; }
    p += rd * max(d, 0.04);
    if (outside(p) || p.z < -uHalf - 0.4 || p.z > uTop + 0.4) break;
  }
  if (!hit) discard;
  gl_FragColor = vec4(display(goldColor(p, fieldNormal(p), -rd)), 1.0);
  #include <colorspace_fragment>
}
`;

export const PLANE_FRAG = /* glsl */ `
varying vec3 vP, vN;
${COMMON}
void main() {
  if (uSurface > 1.5) {
    // No surface of its own: just the pendant's shadow, laid over whatever is behind the canvas.
    vec2 l = planeLight(vP);
    gl_FragColor = vec4(0.2, 0.17, 0.13, min(0.5, 0.26 * (1.0 - l.x) + 0.5 * (1.0 - l.y)));
  } else {
    gl_FragColor = vec4(display(shadePlane(vP)), 1.0);
  }
  #include <colorspace_fragment>
}
`;
