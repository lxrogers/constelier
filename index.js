var m = require('makerjs');

function ExpandIntersectingLines(angleDeg, length, expand, expansion, circleRadius) {
  // sanitize
  angleDeg = Math.max(0, Math.min(180, angleDeg));
  length = Math.max(1, length);
  expansion = Math.max(0, expansion);
  circleRadius = Math.max(1, circleRadius);

  // Build line geometry in a separate model so we can expand it
  var half = length / 2;
  var rad = angleDeg * Math.PI / 180;
  var dx = Math.cos(rad) * half;
  var dy = Math.sin(rad) * half;

  var lineModel = {
    paths: {
      a: new m.paths.Line([-half, 0], [half, 0]),
      b: new m.paths.Line([-dx, -dy], [dx, dy])
    }
  };

  if (expand && expansion > 0) {
    // Expand the thin lines into closed outlines (stroke → fill)
    var expanded = m.model.expandPaths(lineModel, expansion);

    // Circle as a model (needed for boolean combine)
    var circle = {
      paths: { circle: new m.paths.Circle([0, 0], circleRadius) }
    };

    // Boolean intersection:
    //   keep expanded parts INSIDE circle  (arg3 = true,  arg4 = false)
    //   keep circle arcs OUTSIDE expanded  (arg5 = false, arg6 = true)
    m.model.combine(expanded, circle, true, false, false, true);

    this.models = { expanded: expanded, circle: circle };
  } else {
    // No expansion — just show the raw lines + circle outline
    this.paths = {
      a: lineModel.paths.a,
      b: lineModel.paths.b,
      circle: new m.paths.Circle([0, 0], circleRadius)
    };
  }
}

ExpandIntersectingLines.metaParameters = [
  { title: "angle (degrees)", type: "range", min: 1, max: 179, step: 1, value: 45 },
  { title: "line length",     type: "range", min: 10, max: 400, step: 1, value: 200 },
  { title: "expand",          type: "bool",  value: true },
  { title: "expansion amount",type: "range", min: 0.1, max: 50, step: 0.1, value: 10 },
  { title: "circle radius",   type: "range", min: 10, max: 200, step: 1, value: 100 }
];

module.exports = ExpandIntersectingLines;
