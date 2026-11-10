// pendant-geometry.js
// Consolidated MakerJS pendant geometry functions (ES module)

import makerjs from 'makerjs';
import { computeVoids } from './organic/outline-voids.js';
const m = makerjs;

export function polygonArea(pts) {
  var n = pts.length;
  if (n < 3) return 0;
  var area = 0;
  for (var i = 0; i < n; i++) {
    var j = (i + 1) % n;
    area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  return Math.abs(area) / 2;
}

export function signedPolygonArea(pts) {
  var n = pts.length;
  if (n < 3) return 0;
  var area = 0;
  for (var i = 0; i < n; i++) {
    var j = (i + 1) % n;
    area += pts[i][0] * pts[j][1];
    area -= pts[j][0] * pts[i][1];
  }
  return area / 2;
}

export function cornerAngle(linkA, linkB) {
  var pcA = linkA.walkedPath.pathContext;
  var pcB = linkB.walkedPath.pathContext;
  var dax, day;
  if (pcA.type === 'line') {
    dax = pcA.end[0] - pcA.origin[0]; day = pcA.end[1] - pcA.origin[1];
    if (linkA.reversed) { dax = -dax; day = -day; }
  } else if (pcA.type === 'arc') {
    var a = (linkA.reversed ? pcA.startAngle : pcA.endAngle) * Math.PI / 180;
    if (linkA.reversed) { dax = Math.sin(a); day = -Math.cos(a); }
    else { dax = -Math.sin(a); day = Math.cos(a); }
  } else return 90;
  var dbx, dby;
  if (pcB.type === 'line') {
    dbx = pcB.end[0] - pcB.origin[0]; dby = pcB.end[1] - pcB.origin[1];
    if (linkB.reversed) { dbx = -dbx; dby = -dby; }
  } else if (pcB.type === 'arc') {
    var a = (linkB.reversed ? pcB.endAngle : pcB.startAngle) * Math.PI / 180;
    if (linkB.reversed) { dbx = Math.sin(a); dby = -Math.cos(a); }
    else { dbx = -Math.sin(a); dby = Math.cos(a); }
  } else return 90;
  var lenA = Math.hypot(dax, day), lenB = Math.hypot(dbx, dby);
  if (lenA < 1e-10 || lenB < 1e-10) return 90;
  var dot = Math.max(-1, Math.min(1, (dax * dbx + day * dby) / (lenA * lenB)));
  return 180 - Math.acos(dot) * 180 / Math.PI;
}

export function chainMinAngle(chain) {
  var links = chain.links;
  if (!links || links.length < 2) return 180;
  var minAng = 180;
  var count = chain.endless ? links.length : links.length - 1;
  for (var i = 0; i < count; i++) {
    var k = (i + 1) % links.length;
    var interior = cornerAngle(links[i], links[k]);
    if (interior < minAng) minAng = interior;
  }
  return minAng;
}

export function manualLineFillet(linkA, linkB, radius) {
  var pcA = linkA.walkedPath.pathContext;
  var pcB = linkB.walkedPath.pathContext;
  if (pcA.type !== 'line' || pcB.type !== 'line') return null;

  var endA = linkA.reversed ? pcA.origin : pcA.end;
  var startB = linkB.reversed ? pcB.end : pcB.origin;
  var px = (endA[0] + startB[0]) / 2, py = (endA[1] + startB[1]) / 2;

  var farA = linkA.reversed ? pcA.end : pcA.origin;
  var farB = linkB.reversed ? pcB.origin : pcB.end;

  var dax = px - farA[0], day = py - farA[1];
  var la = Math.hypot(dax, day);
  if (la < 1e-10) return null;
  dax /= la; day /= la;

  var dbx = farB[0] - px, dby = farB[1] - py;
  var lb = Math.hypot(dbx, dby);
  if (lb < 1e-10) return null;
  dbx /= lb; dby /= lb;

  var cross = dax * dby - day * dbx;
  if (Math.abs(cross) < 1e-10) return null;

  var side = cross < 0 ? -1 : 1;
  var nax = side * (-day), nay = side * dax;
  var nbx = side * (-dby), nby = side * dbx;

  var oax = px + radius * nax, oay = py + radius * nay;
  var obx = px + radius * nbx, oby = py + radius * nby;

  var det = dbx * day - dby * dax;
  if (Math.abs(det) < 1e-10) return null;
  var ddx = obx - oax, ddy = oby - oay;
  var s = (ddy * dax - ddx * day) / det;
  var cx = obx + s * dbx, cy = oby + s * dby;

  var tA = (cx - farA[0]) * dax + (cy - farA[1]) * day;
  var tpAx = farA[0] + tA * dax, tpAy = farA[1] + tA * day;

  var tB = (cx - px) * dbx + (cy - py) * dby;
  var tpBx = px + tB * dbx, tpBy = py + tB * dby;

  if (tA < 0 || tA > la) return null;
  if (tB < 0 || tB > lb) return null;

  var angA = Math.atan2(tpAy - cy, tpAx - cx) * 180 / Math.PI;
  var angB = Math.atan2(tpBy - cy, tpBx - cx) * 180 / Math.PI;
  if (angA < 0) angA += 360;
  if (angB < 0) angB += 360;

  var span = angB - angA;
  if (span < 0) span += 360;
  var startAng, endAng;
  if (span <= 180) { startAng = angA; endAng = angB; }
  else { startAng = angB; endAng = angA; }

  if (linkA.reversed) pcA.origin = [tpAx, tpAy];
  else pcA.end = [tpAx, tpAy];
  if (linkB.reversed) pcB.end = [tpBx, tpBy];
  else pcB.origin = [tpBx, tpBy];

  return { type: 'arc', origin: [cx, cy], radius: radius, startAngle: startAng, endAngle: endAng };
}

export function applyFillet(result, fr) {
  if (fr <= 0) return;
  var fChains = m.model.findChains(result);
  var filletsModel = { paths: {} };
  var fi = 0;
  for (var i = 0; i < fChains.length; i++) {
    var chain = fChains[i];
    var links = chain.links;
    if (!links || links.length < 2) continue;
    var count = chain.endless ? links.length : links.length - 1;
    for (var j = 0; j < count; j++) {
      var k = (j + 1) % links.length;
      var pathA = links[j].walkedPath.pathContext;
      var pathB = links[k].walkedPath.pathContext;
      var interior = cornerAngle(links[j], links[k]);
      var span = Math.max(15, 180 - interior);
      var startR = fr * Math.pow(90 / span, 1.5);
      var arc = null;
      var tryR = startR;
      for (var attempt = 0; attempt < 12 && tryR >= 0.3; attempt++) {
        try { arc = m.path.fillet(pathA, pathB, tryR); } catch { arc = null; }
        if (arc) break;
        tryR *= 0.65;
      }
      if (!arc) {
        tryR = startR;
        for (var attempt = 0; attempt < 12 && tryR >= 0.3; attempt++) {
          arc = manualLineFillet(links[j], links[k], tryR);
          if (arc) break;
          tryR *= 0.65;
        }
      }
      if (arc) filletsModel.paths['f' + (fi++)] = arc;
    }
  }
  result.models.fillets = filletsModel;
}

export function deepCloneModel(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepCloneModel);
  var clone = {};
  for (var key in obj) {
    if (obj.hasOwnProperty(key) && key !== '_areas' && key !== '_timings') {
      clone[key] = deepCloneModel(obj[key]);
    }
  }
  return clone;
}

// Disc minus constant-width bars, as a MakerJS model of lines and rim arcs.
function voidsModel(chords, expansion, circleRadius) {
  var rimStep = 0.5; // degrees between disc polygon vertices
  var voids = computeVoids(chords, circleRadius, function () { return expansion; },
    { minArea: 0, minAngle: 0, rimSegments: Math.round(360 / rimStep) });
  var rimEdge = 2 * Math.PI * circleRadius * rimStep / 360 * 1.01;
  var model = { paths: {} };
  var id = 0;
  for (var v = 0; v < voids.length; v++) {
    var ring = voids[v];
    var n = ring.length;
    var onRim = ring.map(function (p) { return Math.abs(Math.hypot(p[0], p[1]) - circleRadius) < 0.02; });
    var pts = ring.map(function (p, i) {
      if (!onRim[i]) return p;
      var r = Math.hypot(p[0], p[1]);
      return [p[0] * circleRadius / r, p[1] * circleRadius / r];
    });
    var isRim = function (i) {
      var j = (i + 1) % n;
      return onRim[i] && onRim[j] && Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]) <= rimEdge;
    };
    // Start at a vertex where the edge type changes (or anywhere if none).
    var start = 0;
    for (var i = 0; i < n; i++) if (isRim((i - 1 + n) % n) !== isRim(i)) { start = i; break; }
    var k = 0;
    while (k < n) {
      var i0 = (start + k) % n;
      if (isRim(i0)) {
        var e = k;
        while (e < n && isRim((start + e) % n)) e++;
        var pA = pts[i0], pB = pts[(start + e) % n];
        var a0 = Math.atan2(pA[1], pA[0]) * 180 / Math.PI, a1 = Math.atan2(pB[1], pB[0]) * 180 / Math.PI;
        if (a0 < 0) a0 += 360;
        if (a1 < 0) a1 += 360;
        if (e - k === n) { model.paths['v' + id++] = new m.paths.Circle([0, 0], circleRadius); break; }
        model.paths['v' + id++] = new m.paths.Arc([0, 0], circleRadius, a0, a1);
        k = e;
      } else {
        // Straight run: skip vertices where the outline doesn't turn.
        var e2 = k + 1;
        while (e2 < n && !isRim((start + e2) % n)) {
          var a = pts[(start + e2 - 1) % n], b = pts[(start + e2) % n], c = pts[(start + e2 + 1) % n];
          var cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
          var l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
          if (Math.abs(cross) > 1e-3 * l1 * l2) break; // turns under ~0.06° are noise
          e2++;
        }
        model.paths['v' + id++] = new m.paths.Line(pts[i0], pts[(start + e2) % n]);
        k = e2;
      }
    }
  }
  return model;
}

export function buildPendantModel(chords, expansion, circleRadius, borderThickness, minArea, minAngle, fr) {
  // The voids are the disc minus the bars. This used to be MakerJS
  // expandPaths + combine, but combine decides which rim pieces to keep by
  // ray-casting, and where bar ends overlap past the rim it sometimes threw
  // away rim arcs or bar edges, so a void never closed and came out solid
  // (about 1 chart in 70). polygon-clipping does the boolean exactly; the
  // rings are turned back into lines and rim arcs for the steps below.
  var result = { models: { voids: voidsModel(chords, expansion, circleRadius) } };

  // Pre-pass: collapse short segments
  if (expansion > 0) {
    var threshold = expansion * 1.5;
    var preChains = m.model.findChains(result);
    var changed = true;
    while (changed) {
      changed = false;
      for (var i = 0; i < preChains.length; i++) {
        var chain = preChains[i];
        var links = chain.links;
        if (!links || links.length < 3) continue;
        for (var j = 0; j < links.length; j++) {
          var pc = links[j].walkedPath.pathContext;
          var segLen = 0;
          if (pc.type === 'arc') {
            var sp = pc.endAngle - pc.startAngle;
            if (sp < 0) sp += 360;
            if (sp > 360) sp -= 360;
            segLen = (sp / 360) * 2 * Math.PI * pc.radius;
          } else if (pc.type === 'line') {
            segLen = Math.hypot(pc.end[0] - pc.origin[0], pc.end[1] - pc.origin[1]);
          } else continue;
          if (segLen >= threshold) continue;

          var prevIdx = (j - 1 + links.length) % links.length;
          var nextIdx = (j + 1) % links.length;
          var prevPc = links[prevIdx].walkedPath.pathContext;
          var nextPc = links[nextIdx].walkedPath.pathContext;
          if (prevPc.type !== 'line' && nextPc.type !== 'line') continue;

          if (prevPc.type === 'line' && nextPc.type === 'line') {
            var ax1 = prevPc.origin[0], ay1 = prevPc.origin[1];
            var ax2 = prevPc.end[0], ay2 = prevPc.end[1];
            var cx1 = nextPc.origin[0], cy1 = nextPc.origin[1];
            var cx2 = nextPc.end[0], cy2 = nextPc.end[1];
            var dax = ax2 - ax1, day = ay2 - ay1;
            var dcx = cx2 - cx1, dcy = cy2 - cy1;
            var det = dax * dcy - day * dcx;
            var meet;
            if (Math.abs(det) < 1e-10) {
              if (pc.type === 'arc') {
                var sp2 = pc.endAngle - pc.startAngle;
                if (sp2 < 0) sp2 += 360;
                var midAngle = (pc.startAngle + sp2 / 2) * Math.PI / 180;
                meet = [pc.origin[0] + pc.radius * Math.cos(midAngle),
                        pc.origin[1] + pc.radius * Math.sin(midAngle)];
              } else {
                meet = [(pc.origin[0] + pc.end[0]) / 2, (pc.origin[1] + pc.end[1]) / 2];
              }
            } else {
              var t = ((cx1 - ax1) * dcy - (cy1 - ay1) * dcx) / det;
              meet = [ax1 + t * dax, ay1 + t * day];
            }
            if (links[prevIdx].reversed) prevPc.origin = meet;
            else prevPc.end = meet;
            if (links[nextIdx].reversed) nextPc.end = meet;
            else nextPc.origin = meet;
          } else if (prevPc.type === 'line' && nextPc.type === 'arc') {
            var lx1 = prevPc.origin[0], ly1 = prevPc.origin[1];
            var ldx = prevPc.end[0] - lx1, ldy = prevPc.end[1] - ly1;
            var ccx = nextPc.origin[0], ccy = nextPc.origin[1], cr = nextPc.radius;
            var exx = lx1 - ccx, eyy = ly1 - ccy;
            var qa = ldx * ldx + ldy * ldy;
            var qb = 2 * (exx * ldx + eyy * ldy);
            var qc = exx * exx + eyy * eyy - cr * cr;
            var disc = qb * qb - 4 * qa * qc;
            if (disc >= 0 && qa > 1e-10) {
              var sq = Math.sqrt(disc);
              var t1 = (-qb + sq) / (2 * qa), t2 = (-qb - sq) / (2 * qa);
              var p1 = [lx1 + t1 * ldx, ly1 + t1 * ldy];
              var p2 = [lx1 + t2 * ldx, ly1 + t2 * ldy];
              var rAng = (links[nextIdx].reversed ? nextPc.endAngle : nextPc.startAngle) * Math.PI / 180;
              var rPt = [ccx + cr * Math.cos(rAng), ccy + cr * Math.sin(rAng)];
              var d1 = (p1[0]-rPt[0])*(p1[0]-rPt[0]) + (p1[1]-rPt[1])*(p1[1]-rPt[1]);
              var d2 = (p2[0]-rPt[0])*(p2[0]-rPt[0]) + (p2[1]-rPt[1])*(p2[1]-rPt[1]);
              var meet = d1 < d2 ? p1 : p2;
              if (links[prevIdx].reversed) prevPc.origin = meet;
              else prevPc.end = meet;
              var nAng = Math.atan2(meet[1] - ccy, meet[0] - ccx) * 180 / Math.PI;
              if (nAng < 0) nAng += 360;
              if (links[nextIdx].reversed) nextPc.endAngle = nAng;
              else nextPc.startAngle = nAng;
            } else {
              var arcAng = (links[nextIdx].reversed ? nextPc.endAngle : nextPc.startAngle) * Math.PI / 180;
              var arcPt = [ccx + cr * Math.cos(arcAng), ccy + cr * Math.sin(arcAng)];
              if (links[prevIdx].reversed) prevPc.origin = arcPt;
              else prevPc.end = arcPt;
            }
          } else {
            var lx1 = nextPc.origin[0], ly1 = nextPc.origin[1];
            var ldx = nextPc.end[0] - lx1, ldy = nextPc.end[1] - ly1;
            var ccx = prevPc.origin[0], ccy = prevPc.origin[1], cr = prevPc.radius;
            var exx = lx1 - ccx, eyy = ly1 - ccy;
            var qa = ldx * ldx + ldy * ldy;
            var qb = 2 * (exx * ldx + eyy * ldy);
            var qc = exx * exx + eyy * eyy - cr * cr;
            var disc = qb * qb - 4 * qa * qc;
            if (disc >= 0 && qa > 1e-10) {
              var sq = Math.sqrt(disc);
              var t1 = (-qb + sq) / (2 * qa), t2 = (-qb - sq) / (2 * qa);
              var p1 = [lx1 + t1 * ldx, ly1 + t1 * ldy];
              var p2 = [lx1 + t2 * ldx, ly1 + t2 * ldy];
              var rAng = (links[prevIdx].reversed ? prevPc.startAngle : prevPc.endAngle) * Math.PI / 180;
              var rPt = [ccx + cr * Math.cos(rAng), ccy + cr * Math.sin(rAng)];
              var d1 = (p1[0]-rPt[0])*(p1[0]-rPt[0]) + (p1[1]-rPt[1])*(p1[1]-rPt[1]);
              var d2 = (p2[0]-rPt[0])*(p2[0]-rPt[0]) + (p2[1]-rPt[1])*(p2[1]-rPt[1]);
              var meet = d1 < d2 ? p1 : p2;
              if (links[nextIdx].reversed) nextPc.end = meet;
              else nextPc.origin = meet;
              var nAng = Math.atan2(meet[1] - ccy, meet[0] - ccx) * 180 / Math.PI;
              if (nAng < 0) nAng += 360;
              if (links[prevIdx].reversed) prevPc.startAngle = nAng;
              else prevPc.endAngle = nAng;
            } else {
              var arcAng = (links[prevIdx].reversed ? prevPc.startAngle : prevPc.endAngle) * Math.PI / 180;
              var arcPt = [ccx + cr * Math.cos(arcAng), ccy + cr * Math.sin(arcAng)];
              if (links[nextIdx].reversed) nextPc.end = arcPt;
              else nextPc.origin = arcPt;
            }
          }

          var wp = links[j].walkedPath;
          if (wp.modelContext && wp.modelContext.paths) {
            delete wp.modelContext.paths[wp.pathId];
          }
          changed = true;
          break;
        }
        if (changed) break;
      }
      if (changed) preChains = m.model.findChains(result);
    }
  }

  // When two bar edges cross the rim at (almost) the same point, combine
  // and the short-segment pass can leave a zero-length arc behind. MakerJS
  // reads an arc whose start and end angles match as a full circle, so the
  // void touching that point never closes and comes out solid. Drop those
  // arcs; the edges on either side already meet at that point.
  m.model.walk(result, {
    onPath: function (wp) {
      var p = wp.pathContext;
      if (p.type !== 'arc') return;
      var span = ((p.endAngle - p.startAngle) % 360 + 360) % 360;
      if (span < 1e-3 || 360 - span < 1e-3) delete wp.modelContext.paths[wp.pathId];
    }
  });

  // Filter small closed regions
  if (minArea > 0 || minAngle > 0) {
    var chains = m.model.findChains(result);
    for (var i = 0; i < chains.length; i++) {
      var chain = chains[i];
      if (!chain.endless) continue;
      try {
        var pts = m.chain.toKeyPoints(chain, 1);
        var area = polygonArea(pts);
        var angle = chainMinAngle(chain);
        var tooSmall = minArea > 0 && area < minArea;
        var tooNarrow = minAngle > 0 && angle < minAngle;
        if (tooSmall || tooNarrow) {
          for (var j = 0; j < chain.links.length; j++) {
            var wp = chain.links[j].walkedPath;
            if (wp && wp.modelContext && wp.modelContext.paths) {
              delete wp.modelContext.paths[wp.pathId];
            }
          }
        }
      } catch {}
    }
  }

  // Border
  if (borderThickness > 0) {
    result.models.border = {
      paths: { outer: new m.paths.Circle([0, 0], circleRadius + borderThickness) }
    };
  }

  // Fillet
  if (fr > 0) applyFillet(result, fr);

  return result;
}

export function serializeChainsFor3D(model, circleRadius, borderThickness) {
  var chains = m.model.findChains(model);
  var circleArea = Math.PI * circleRadius * circleRadius;
  var data = { circleRadius: circleRadius, borderThickness: borderThickness, voidChains: [] };
  for (var i = 0; i < chains.length; i++) {
    var ch = chains[i];
    if (!ch.endless) continue;
    try {
      var pts = m.chain.toKeyPoints(ch, 1);
      if (pts.length < 3) continue;
      var area = Math.abs(signedPolygonArea(pts));
      if (area >= circleArea * 0.95) continue;
      var needsReverse = signedPolygonArea(pts) < 0;
      var chainLinks = ch.links;
      var links = [];
      if (needsReverse) {
        for (var j = chainLinks.length - 1; j >= 0; j--) {
          var link = chainLinks[j];
          var pc = link.walkedPath.pathContext;
          var ld = { type: pc.type, reversed: !link.reversed };
          if (pc.type === 'line') {
            ld.origin = [pc.origin[0], pc.origin[1]];
            ld.end = [pc.end[0], pc.end[1]];
          } else if (pc.type === 'arc') {
            ld.origin = [pc.origin[0], pc.origin[1]];
            ld.radius = pc.radius;
            ld.startAngle = pc.startAngle;
            ld.endAngle = pc.endAngle;
          }
          links.push(ld);
        }
      } else {
        for (var j = 0; j < chainLinks.length; j++) {
          var link = chainLinks[j];
          var pc = link.walkedPath.pathContext;
          var ld = { type: pc.type, reversed: !!link.reversed };
          if (pc.type === 'line') {
            ld.origin = [pc.origin[0], pc.origin[1]];
            ld.end = [pc.end[0], pc.end[1]];
          } else if (pc.type === 'arc') {
            ld.origin = [pc.origin[0], pc.origin[1]];
            ld.radius = pc.radius;
            ld.startAngle = pc.startAngle;
            ld.endAngle = pc.endAngle;
          }
          links.push(ld);
        }
      }
      data.voidChains.push({ links: links, area: area });
    } catch(e) {}
  }
  return data;
}
