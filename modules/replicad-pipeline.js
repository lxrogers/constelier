// modules/replicad-pipeline.js
import { setOC, draw, drawCircle, makeCompound } from "replicad";

let ocReady = false;
let ocPromise = null;

export function isOCReady() { return ocReady; }

export function initOpenCascade() {
  if (ocPromise) return ocPromise;
  ocPromise = (async () => {
    const ocModule = await import("../node_modules/replicad-opencascadejs/src/replicad_single.js");
    const OC = await ocModule.default({
      locateFile: () => "../node_modules/replicad-opencascadejs/src/replicad_single.wasm",
    });
    setOC(OC);
    ocReady = true;
    return OC;
  })();
  return ocPromise;
}

function walkedStart(link) {
  if (link.type === 'line') {
    return link.reversed ? link.end : link.origin;
  } else if (link.type === 'arc') {
    var angle = (link.reversed ? link.endAngle : link.startAngle) * Math.PI / 180;
    return [link.origin[0] + link.radius * Math.cos(angle),
            link.origin[1] + link.radius * Math.sin(angle)];
  }
  return [0, 0];
}

function walkedEnd(link) {
  if (link.type === 'line') {
    return link.reversed ? link.origin : link.end;
  } else if (link.type === 'arc') {
    var angle = (link.reversed ? link.startAngle : link.endAngle) * Math.PI / 180;
    return [link.origin[0] + link.radius * Math.cos(angle),
            link.origin[1] + link.radius * Math.sin(angle)];
  }
  return [0, 0];
}

function arcMidpoint(link) {
  var sa = link.startAngle, ea = link.endAngle;
  var span = ea - sa;
  if (span < 0) span += 360;
  var mid = sa + span / 2;
  var midRad = mid * Math.PI / 180;
  return [link.origin[0] + link.radius * Math.cos(midRad),
          link.origin[1] + link.radius * Math.sin(midRad)];
}

function chainToDrawing(chainData) {
  var links = chainData.links;
  if (!links || links.length === 0) return null;

  var startPt = walkedStart(links[0]);
  var pen = draw(startPt);

  for (var i = 0; i < links.length; i++) {
    var link = links[i];
    var endPt = walkedEnd(link);

    var prevPt = i === 0 ? startPt : walkedEnd(links[i - 1]);
    var segDx = endPt[0] - prevPt[0], segDy = endPt[1] - prevPt[1];
    if (Math.sqrt(segDx * segDx + segDy * segDy) < 0.01) continue;

    if (link.type === 'line') {
      pen = pen.lineTo(endPt);
    } else if (link.type === 'arc') {
      var sp = walkedStart(link);
      var dx = endPt[0] - sp[0], dy = endPt[1] - sp[1];
      var chord = Math.sqrt(dx * dx + dy * dy);
      if (chord < 0.5) {
        pen = pen.lineTo(endPt);
      } else {
        var mp = arcMidpoint(link);
        try {
          pen = pen.threePointsArcTo(endPt, mp);
        } catch(arcErr) {
          pen = pen.lineTo(endPt);
        }
      }
    }
  }

  return pen.close();
}

export function buildPendant3D(data, thickness) {
  var outerRadius = data.circleRadius + data.borderThickness;

  var disc = drawCircle(outerRadius)
    .sketchOnPlane("XY")
    .extrude(thickness);

  var voidDrawings = [];
  var drawFail = 0;
  for (var i = 0; i < data.voidChains.length; i++) {
    try {
      var drawing = chainToDrawing(data.voidChains[i]);
      if (!drawing) { drawFail++; continue; }
      voidDrawings.push(drawing);
    } catch(e) {
      drawFail++;
      console.warn('Void drawing ' + i + ' failed:', e.message || e);
    }
  }

  var voidSolids = [];
  for (var i = 0; i < voidDrawings.length; i++) {
    try {
      var solid = voidDrawings[i]
        .sketchOnPlane("XY", -0.1)
        .extrude(thickness + 0.2);
      voidSolids.push(solid);
    } catch(e) {
      drawFail++;
      console.warn('Void extrude ' + i + ' failed:', e.message || e);
    }
  }

  var cutOk = 0, cutFail = 0;
  if (voidSolids.length > 0) {
    try {
      var voidCompound = makeCompound(voidSolids);
      disc = disc.cut(voidCompound);
      cutOk = voidSolids.length;
    } catch(e) {
      console.warn('Compound cut failed, falling back to sequential:', e.message || e);
      for (var i = 0; i < voidDrawings.length; i++) {
        try {
          var vs = voidDrawings[i].sketchOnPlane("XY", -0.1).extrude(thickness + 0.2);
          disc = disc.cut(vs);
          cutOk++;
        } catch(e2) {
          cutFail++;
          console.warn('Sequential cut ' + i + ' failed:', e2.message || e2);
        }
      }
    }
  }

  return { shape: disc, cutOk: cutOk, cutFail: cutFail + drawFail, thickness: thickness };
}

export function buildRing3D(circleRadius, borderThickness, thickness) {
  var outerRadius = circleRadius + borderThickness;
  var disc = drawCircle(outerRadius)
    .sketchOnPlane("XY")
    .extrude(thickness);
  var hole = drawCircle(circleRadius)
    .sketchOnPlane("XY", -0.1)
    .extrude(thickness + 0.2);
  disc = disc.cut(hole);
  return { shape: disc, thickness: thickness };
}

export function filletShape(shape, thickness, filletR) {
  var maxFillet = thickness / 2 - 0.1;
  var actualR = Math.min(filletR, maxFillet);
  if (actualR <= 0.1) return { shape: shape, filletInfo: '', filletMs: 0 };

  var filletOk = false;
  var tryR = actualR;
  var filletMs = 0;
  var filletInfo = '';
  var tFillet = performance.now();

  for (var attempt = 0; attempt < 8 && tryR >= 0.3 && !filletOk; attempt++) {
    try {
      shape = shape.fillet(tryR, (e) => e.either([
        (e2) => e2.inPlane("XY"),
        (e2) => e2.inPlane("XY", [0, 0, thickness]),
      ]));
      filletMs = performance.now() - tFillet;
      filletInfo = ', filleted ' + tryR.toFixed(1);
      filletOk = true;
    } catch(fe) {
      console.warn('Fillet r=' + tryR.toFixed(1) + ' failed, stepping down');
      tryR *= 0.65;
    }
  }

  if (!filletOk) {
    filletMs = performance.now() - tFillet;
    filletInfo = ', fillet failed';
  }

  return { shape: shape, filletInfo: filletInfo, filletMs: filletMs };
}
