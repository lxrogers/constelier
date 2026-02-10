var m = require('makerjs');
var ExpandIntersectingLines = require('./index');

// Create with default-ish params: 45°, length 200, expand on, 10 thick, 100 radius
var model = new ExpandIntersectingLines(45, 200, true, 10, 100);

var svg = m.exporter.toSVG(model, { useSvgPathOnly: false });
console.log(svg);
