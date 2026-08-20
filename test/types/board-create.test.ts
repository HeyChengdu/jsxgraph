import JXG from "jsxgraph";

declare const board: JXG.Board;
declare const composition: JXG.Composition;

composition.setAttribute({ visible: true }).update();
// @ts-expect-error Composition attributes use the same typed visual properties as geometry elements.
composition.setAttribute({ visible: "yes" });

const a = board.create("point", [0, 0]);
const b = board.create("point", [2, 0]);
const c = board.create("point", [0, 2]);
const d = board.create("point", [-1, 1]);
const e = board.create("point", [1, -1]);
board.create("point", [() => [0, 1, 2]]);
// @ts-expect-error A coordinate constraint returns affine or homogeneous coordinates.
board.create("point", [() => [1]]);
a.hasPoint(10, 20).valueOf();
// @ts-expect-error Hit testing uses two numeric screen coordinates.
a.hasPoint("10", 20);
const line = board.create("line", [a, b]);
const circle = board.create("circle", [a, b]);
const curve = board.create("functiongraph", [(x) => x * x]);
board.create("curve", [[], []], { lineCap: "square" });
// @ts-expect-error Curve line caps follow the renderer's supported values.
board.create("curve", [[], []], { lineCap: "flat" });
const compiledFunction = board.jc.snippet("x * x", true, "x", false);
compiledFunction(2).toFixed();
board.create("functiongraph", [compiledFunction]);
const glider = board.create("glider", [1, 0, line]);
const defaultXAxis = board.defaultAxes.x;
if (defaultXAxis) {
    board.create("glider", [1, 0, defaultXAxis]);
}
const targetValues = [20, 40, 10, 35, 5] as const;
const guide = board.create("segment", [
    [1, 0],
    [1, 100]
]);
const gliderAttributes = {
    name: "bar-a-handle",
    withLabel: false,
    snapToGrid: true,
    face: "minus",
    size: 15,
    strokeWidth: 4,
    strokeColor: "#22c55e",
    fillColor: "#22c55e",
    showInfobox: false,
    visible: false
} satisfies JXG.GliderAttributes;
board.create("glider", [1, targetValues[0], guide], gliderAttributes);
board.create("point", [0, 0], { face: "divide" });
board.create("point", [0, 0], { face: "triangleup" });
board.create("point", [0, 0], { size: () => 5 });
board.create("point", [0, 0], { highlightFillColor: () => "#fff" });
// @ts-expect-error Point size evaluators must return a number.
board.create("point", [0, 0], { size: () => "5" });
// @ts-expect-error Point face names follow the exact values accepted by normalizePointFace.
board.create("point", [0, 0], { face: "triangleUp" });
const tangent = board.create("tangent", [glider]);
const polygon = board.create("polygon", [a, b, c]);

glider.position.toFixed();
polygon.borders[0].setAttribute({ strokeWidth: 2 });
curve.bezierDegree.toFixed();
curve.clearTrace();
board.sketches[0]?.clearTrace();

board.create("segment", [[0, 0], [1, 1], () => 2]);
board.create(
    "arrow",
    [
        [0, 0],
        [1, 1]
    ],
    { straightFirst: false, straightLast: false }
);
board.create("segment", [
    [1, 0, 0],
    [1, 1, 1]
]);
board.create("segment", [() => [1, 0, 0] as const, () => [1, 1, 1] as const]);
board.create("arrow", [a, [2, 1]]);
board.create("text", [0, 0, () => "text"]);
board.create("text", [0, 0, "x^2"], {
    fontUnit: "rem",
    useKatex: true,
    katexMacros: { "\\RR": "\\mathbb{R}" }
});
board.create("polygon", [a, b, c]);
board.create("circle", [a, () => 2]);
board.create("arc", [a, b, c]);
board.create("ellipse", [[-1, 0], [1, 0], [0, 2], 0, Math.PI]);
board.create("curve", [
    [0, 1, 2],
    [0, 1, 4]
]);
board.create("curve", [(t) => Math.cos(t), (t) => Math.sin(t), 0, Math.PI * 2]);
board.create("spline", [a, b, c]);
board.create("intersection", [line, circle, 0]);
board.create("midpoint", [a, b]);
board.create("parallel", [line, c]);
board.create("tangent", [glider]);
board.create("angle", [a, b, c]);
board.create(
    "axis",
    [
        [0, 0],
        [1, 0]
    ],
    { firstArrow: true, lastArrow: true }
);
board.create(
    "line",
    [
        [0, 0],
        [1, 1]
    ],
    {
        shadow: {
            enabled: true,
            color: "#000",
            blend: 0.5,
            opacity: 0.5,
            blur: 6,
            offset: [0, 18]
        }
    }
);
board.create(
    // @ts-expect-error Shadow offsets contain exactly two numeric coordinates.
    "line",
    [
        [0, 0],
        [1, 1]
    ],
    { shadow: { offset: [0, 1, 2] } }
);
board.create("slider", [
    [-2, -1],
    [2, -1],
    [-1, 0, 1]
]);
board.create(
    "slider",
    [
        [-2, -1],
        [2, -1],
        [0, 0, Math.PI]
    ],
    {
        snapValues: [0, Math.PI / 2, Math.PI],
        snapValueDistance: 0.1
    }
);
board.create(
    "slider",
    [
        [-2, -1],
        [2, -1],
        [-1, 0, 1]
    ],
    { size: () => 4 }
);
board.create("transform", [1, () => 2], { type: "translate" });
board.create("transform", [line], { type: "reflect" });
board.create("transform", [Math.PI / 2, a], { type: "rotate" });
board.create(
    "transform",
    [
        [1, 0],
        [0, 1]
    ],
    { type: "affinematrix" }
);
board.create(
    "transform",
    [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ],
    { type: "matrix" }
);
board.create("perpendicular", [line, c]);
board.create("circumcircle", [a, b, c]);
board.create("regularpolygon", [a, b, 5]);
board.create("hyperbola", [a, b, c, -Math.PI, Math.PI]);
board.create("parabola", [c, line, 0, Math.PI * 2]);
board.create("inequality", [curve]);
board.create("reflection", [c, line]);
board.create("semicircle", [a, b]);
board.create("circumcirclearc", [a, b, c]);
board.create("circumcirclesector", [a, b, c]);
board.create("minorarc", [a, b, c]);
board.create("majorarc", [a, b, c]);
board.create("sector", [a, b, c]);
board.create("minorsector", [a, b, c]);
board.create("majorsector", [a, b, c]);
board.create("perpendicularpoint", [c, line]);
board.create("bisector", [a, b, c]);
board.create("normal", [line, c]);
board.create("mirrorelement", [c, a]);
board.create("polygonalchain", [a, b, c]);
board.create("conic", [a, b, c, d, e]);
board.create("conic", [1, 1, -1, 0, 0, 0]);
board.create("button", [0, 2, "continue", () => undefined]);
board.create("checkbox", [0, 1, "show"]);
board.create("input", [0, 0, "initial", "answer:"]);
board.create("image", ["data:image/svg+xml,<svg/>", [-2, -2], [4, 4]]);
board.create("fo", ["<div>note</div>", [-2, -1], [4, 2]]);
board.create("foreignobject", ["<div>note</div>", [-2, -1], [4, 2]]);
board.create("group", [a]);
board.create("grid", [
    board.create("axis", [
        [0, 0],
        [1, 0]
    ])
]);
board.create("boxplot", [[0, 1, 2, 3, 4], 0, 1]);
board.create("boxplot", [[0, 1, 2, 3, 4, [-1, 5]], 0, 1], {
    outlier: { face: "x", size: 6, strokeColor: "#f00", opacity: () => 0.5 }
});
board.create("cardinalspline", [[a, b, c], 0.5, "centripetal"]);
const chartResult: JXG.ChartResult = board.create("chart", [
    [1, 2, 3],
    [3, 2, 1]
]);
const tableChartResult: JXG.ChartResult[] = board.create("chart", ["chart-table"]);
// @ts-expect-error Board chart creation returns the generated chart elements, not the helper object.
const chartHelper: JXG.Chart = chartResult;
void tableChartResult;
void chartHelper;
const pointChartAttributes = {
    name: "samples",
    withLabel: false,
    chartStyle: "point",
    size: 2,
    fixed: true,
    fillColor: "#2563eb",
    strokeColor: "none",
    visible: false
} satisfies JXG.ChartAttributes;
board.create(
    "chart",
    [
        [0.1, 0.2],
        [0.3, 0.4]
    ],
    pointChartAttributes
);
const chartData = [1, 4, 2, 7, 3] as const;
board.create("chart", chartData, {
    chartStyle: "spline",
    opacity: () => 0.5
});
board.create("chart", [[() => 1, () => 2]], {
    chartStyle: "bar",
    labels: [1, () => 2, "three"]
});
board.create("comb", [a, b]);
board.create("curvedifference", [polygon, circle]);
board.create("curveintersection", [polygon, circle]);
board.create("curveintersection", [polygon, circle], { hasInnerPoints: true });
board.create("curveunion", [polygon, circle]);
board.create("ticks", [line, 1]);
board.create("hatch", [line, 3]);
board.create("hash", [line, 3]);
board.create("integral", [[-1, 1], curve]);
board.create("metapostspline", [[a, b, c], { tension: 1, isClosed: false }]);
board.create("riemannsum", [(x) => x * x, 8, "middle", -1, 1]);
board.create("slopetriangle", [tangent]);
board.create("stepfunction", [
    [0, 1, 2],
    [1, 3, 2]
]);
board.create("tapemeasure", [
    [0, 0],
    [2, 1]
]);
board.create("tracecurve", [glider, c]);
board.create("turtle", [[0, 0], 90]);
board.create(
    "view3d",
    [
        [-6, -3],
        [8, 8],
        [
            [-5, 5],
            [-5, 5],
            [-5, 5]
        ]
    ],
    {
        projection: "central",
        axesPosition: "none",
        az: {
            pointer: { enabled: true, button: -1, key: "none" },
            keyboard: { enabled: true, step: 10, key: "ctrl" },
            continuous: true,
            slider: {
                visible: false,
                min: 0,
                start: Math.PI / 4,
                max: Math.PI * 2,
                point1: { pos: "auto" },
                point2: { pos: () => [5, 4] }
            }
        },
        el: { slider: { visible: false, start: 0.3 } },
        bank: { slider: { visible: false, start: 0 } },
        trackball: { enabled: true, outside: true, button: 0, key: "shift" }
    }
);
board.create(
    // @ts-expect-error View3D axes use one of the three runtime-supported placements.
    "view3d",
    [
        [-6, -3],
        [8, 8],
        [
            [-5, 5],
            [-5, 5],
            [-5, 5]
        ]
    ],
    {
        axesPosition: "outside"
    }
);
board.create(
    // @ts-expect-error View3D navigation keys are limited to the runtime-supported modifiers.
    "view3d",
    [
        [-6, -3],
        [8, 8],
        [
            [-5, 5],
            [-5, 5],
            [-5, 5]
        ]
    ],
    {
        az: { pointer: { key: "alt" } }
    }
);
board.create("implicitcurve", [(x, y) => x * x + y * y - 1], {
    resolution_outer: 1,
    resolution_inner: () => 2,
    loop_detection: true
});
// @ts-expect-error Implicit curve resolutions are numeric or numeric evaluators.
board.create("implicitcurve", [(x, y) => x * x + y * y - 1], { resolution_outer: "fine" });
board.create("plot", [(x) => x * x]);
board.create("sketchcurve", []);
board.create("nonreflexangle", [a, b, c], {
    hasInnerPoints: true,
    highlightOnSector: true
});
// @ts-expect-error Sector hit-testing flags are boolean.
board.create("nonreflexangle", [a, b, c], { hasInnerPoints: "inside" });
board.create("reflexangle", [a, b, c]);
board.create("arrowparallel", [line, c]);
board.create("bisectorlines", [line, board.create("line", [c, d])]);
board.create("circumcenter", [a, b, c]);
board.create("circumcirclemidpoint", [a, b, c]);
board.create("incenter", [a, b, c]);
board.create("incircle", [a, b, c]);
board.create("orthogonalprojection", [c, line]);
board.create("mirrorpoint", [a, b]);
board.create("parallelpoint", [a, b, c]);
board.create("perpendicularsegment", [line, c]);
board.create("otherintersection", [circle, line, [a]]);
board.create("parallelogram", [a, b, c]);
board.create("polarline", [circle, c]);
board.create("polar", [circle, c]);
board.create("polepoint", [circle, line]);
board.create("radicalaxis", [circle, board.create("circle", [c, d])]);
board.create("tangentto", [circle, c, 0]);
board.create("derivative", [curve]);
board.create("legend", [0, 2]);
board.create("htmlslider", [
    [0, 0],
    [0, 5, 10]
]);
board.create("measurement", [0, 0, ["V", a]]);
board.create("smartlabel", [circle, () => "radius"]);
board.create("vectorfield", [
    [(x: number, y: number) => y, (x: number, y: number) => -x],
    [-5, 10, 5],
    [-5, 10, 5]
]);
board.create("slopefield", [(x, y) => x - y, [-5, 10, 5], [-5, 10, 5]]);

const view = board.create("view3d", [
    [-6, -3],
    [8, 8],
    [
        [-5, 5],
        [-5, 5],
        [-5, 5]
    ]
]);
view.az_slide.Value().toFixed();
view.el_slide.Value().toFixed();
view.bank_slide.Value().toFixed();
const p3a = view.create("point3d", [0, 0, 0]);
const p3b = view.create("point3d", [[1, 0, 0]]);
const p3c = view.create("point3d", [0, 1, 0]);
view.create("transform3d", [() => Math.PI / 2, [1, 0, 0], p3a], {
    type: "rotate"
});
view.create("transform3d", [1, 2, 3], { type: "translate" });
// @ts-expect-error A 3D translation requires exactly three components.
view.create("transform3d", [1, 2], { type: "translate" });
// @ts-expect-error A 3D rotation requires an angle and a normal vector.
view.create("transform3d", [Math.PI / 2], { type: "rotate" });
const line3 = view.create("line3d", [p3a, p3b]);
const plane3 = view.create("plane3d", [p3a, [1, 0, 0], [0, 1, 0]]);
const sphere3 = view.create("sphere3d", [p3a, p3b]);
view.create("circle3d", [p3a, [0, 0, 1], 2]);
view.create("curve3d", [(u) => Math.cos(u), (u) => Math.sin(u), (u) => u, [0, 1]]);
view.create("functiongraph3d", [(x, y) => x + y, [-2, 2], [-2, 2]]);
view.create("functiongraph3d", [(x, y) => x + y, [-2, 2], [-2, 2]], {
    type: "colormap",
    colormap: { min: [-2, 240], max: [2, 0], s: 0.7, v: 0.9 }
});
// @ts-expect-error Surface rendering modes follow the runtime options.
view.create("functiongraph3d", [(x, y) => x + y, [-2, 2], [-2, 2]], { type: "heatmap" });
view.create("parametricsurface3d", [(u, v) => [u, v, u * v], [-2, 2], [-2, 2]]);
view.create("polygon3d", [p3a, p3b, p3c]);
view.create("polyhedron3d", [
    { a: p3a, b: "point-b", c: [0, 1, 0], d: () => [0, 0, 1] },
    [
        ["a", "b", "c"],
        [["a", "c", "d"], { fillColor: "#fff" }]
    ]
]);
// @ts-expect-error Polyhedron vertices are 3D points, ids, or dynamic 3D coordinates.
view.create("polyhedron3d", [{ a: [0, 1] }, [["a"]]]);
view.create("axes3d", []);
view.create("axis3d", [
    [0, 0, 0],
    [1, 0, 0]
]);
const polyhedron3 = view.create("polyhedron3d", [
    [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ],
    [
        [0, 1, 2],
        [0, 1, 3],
        [0, 2, 3],
        [1, 2, 3]
    ]
]);
view.create("face3d", [polyhedron3, 0]);
view.create("intersectioncircle3d", [sphere3, plane3]);
view.create("intersectionline3d", [
    plane3,
    view.create("plane3d", [p3a, [1, 0, 0], [0, 0, 1]])
]);
view.create("mesh3d", [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [-2, 2],
    [-2, 2]
]);
view.create("text3d", [[0, 0, 0], "origin"]);
view.create("ticks3d", [[0, 0, 0], [1, 0, 0], 5, [0, 1, 0]]);
view.create("transform3d", [1, 2, 3], { type: "translate" });
view.create("vectorfield3D", [
    [(x, y, z) => x, (x, y, z) => y, (x, y, z) => z],
    [-2, 5, 2],
    [-2, 5, 2],
    [-2, 5, 2]
]);
view.create(
    "vectorfield3d",
    [
        [(x, y, z) => x, (x, y, z) => y, (x, y, z) => z],
        [-2, 5, 2],
        [-2, 5, 2],
        [-2, 5, 2]
    ],
    { scale: () => 0.5 }
);
view.removeObject(p3a);

board.create("point", [0, 0], {
    aria: { enabled: true, label: (point) => point.name, live: "polite" },
    tabIndex: 0
});
board.create(
    "slider",
    [
        [-2, 0],
        [2, 0],
        [0, 1, 2]
    ],
    { face: "circle" }
);

// @ts-expect-error Point parents cannot contain two nested coordinates.
board.create("point", [
    [0, 0],
    [1, 1]
]);
// @ts-expect-error A line requires valid endpoints.
board.create("line", [{}, {}]);
// @ts-expect-error A fixed segment length must be numeric.
board.create("segment", [[0, 0], [1, 1], "length"]);
// @ts-expect-error Text requires content.
board.create("text", [0, 0]);
// @ts-expect-error Polygon vertices cannot be wrapped in another array.
board.create("polygon", [[a, b, c]]);
// @ts-expect-error A circle boundary cannot be an arbitrary object.
board.create("circle", [[0, 0], { radius: 1 }]);
// @ts-expect-error An arc requires three defining points.
board.create("arc", [
    [0, 0],
    [1, 0]
]);
// @ts-expect-error A box plot needs five quantiles, an axis position, and a width.
board.create("boxplot", [[0, 1, 2, 3], 0, 1]);
// @ts-expect-error Cardinal spline tension is numeric, not textual.
board.create("cardinalspline", [[a, b, c], "loose"]);
// @ts-expect-error A chart cannot be created from an arbitrary object.
board.create("chart", [{}]);
// @ts-expect-error A comb requires two constructible points.
board.create("comb", [a]);
// @ts-expect-error Curve boolean operations require two closed paths.
board.create("curveunion", [circle]);
// @ts-expect-error Hatch count must be numeric.
board.create("hatch", [line, "three"]);
// @ts-expect-error Integral bounds must be a numeric interval.
board.create("integral", [["left", "right"], curve]);
// @ts-expect-error Metapost controls are an object, not a number.
board.create("metapostspline", [[a, b, c], 1]);
// @ts-expect-error Riemann type is a fixed algorithm name.
board.create("riemannsum", [(x) => x, 8, "approximate"]);
// @ts-expect-error A slope triangle cannot use an unrelated circle.
board.create("slopetriangle", [circle]);
// @ts-expect-error A step function needs x and y data.
board.create("stepfunction", [[0, 1, 2]]);
// @ts-expect-error A tape measure needs two positions.
board.create("tapemeasure", [[0, 0]]);
// @ts-expect-error Tracecurve starts from a glider, not an arbitrary point.
board.create("tracecurve", [a, c]);
// @ts-expect-error Turtle coordinates are numeric.
board.create("turtle", ["origin"]);
// @ts-expect-error View3D requires viewport coordinates, size, and three ranges.
board.create("view3d", [
    [-6, -3],
    [8, 8]
]);
// @ts-expect-error An implicit curve requires a two-variable expression.
board.create("implicitcurve", [42]);
// @ts-expect-error A non-reflex angle requires valid angle parents.
board.create("nonreflexangle", [a, b]);
// @ts-expect-error A radical axis needs two circles.
board.create("radicalaxis", [circle, line]);
// @ts-expect-error A parallelogram needs three points.
board.create("parallelogram", [a, b]);
// @ts-expect-error A vector field needs two mesh definitions.
board.create("vectorfield", [
    [(x: number, y: number) => y, (x: number, y: number) => -x],
    [-5, 10, 5]
]);
// @ts-expect-error A 3D point needs three or four coordinates.
view.create("point3d", [0, 0]);
// @ts-expect-error A 3D circle normal is a vector, not a scalar.
view.create("circle3d", [p3a, 1, 2]);
// @ts-expect-error A 3D line needs two points or point/direction/range.
view.create("line3d", [p3a]);
// @ts-expect-error A parametric surface needs both parameter ranges.
view.create("parametricsurface3d", [(u, v) => [u, v, 0], [-2, 2]]);
// @ts-expect-error A function graph requires an evaluator.
board.create("functiongraph", [42]);
// @ts-expect-error A glider requires its slide object.
board.create("glider", [0, 0]);
// @ts-expect-error An intersection requires two geometry elements.
board.create("intersection", [a]);
// @ts-expect-error A midpoint requires two points or one line.
board.create("midpoint", [a]);
// @ts-expect-error A parallel requires a line and point or three points.
board.create("parallel", [a]);
// @ts-expect-error Two points do not define a tangent.
board.create("tangent", [a, b]);
// @ts-expect-error An angle cannot be constructed from two coordinate pairs.
board.create("angle", [
    [0, 0],
    [1, 0]
]);
// @ts-expect-error An axis needs a valid line definition.
board.create("axis", [[0, 0]]);
// @ts-expect-error A slider range requires minimum, initial and maximum.
board.create("slider", [
    [-2, 0],
    [2, 0],
    [0, 1]
]);
// @ts-expect-error Translation requires two scalars.
board.create("transform", [1], { type: "translate" });
board.create(
    // @ts-expect-error A 3x3 matrix is required for matrix transformation.
    "transform",
    [
        [1, 0],
        [0, 1]
    ],
    { type: "matrix" }
);
// @ts-expect-error Perpendicular parents require one line and one point.
board.create("perpendicular", [
    [0, 0],
    [1, 1]
]);
// @ts-expect-error A circumcircle requires three points.
board.create("circumcircle", [
    [0, 0],
    [1, 0]
]);
// @ts-expect-error A regular polygon has at least three sides.
board.create("regularpolygon", [[0, 0], [1, 0], 2]);
// @ts-expect-error A parabola directrix must be a line.
board.create("parabola", [
    [0, 1],
    [0, 0]
]);
// @ts-expect-error An inequality requires a line or curve.
board.create("inequality", [a]);
// @ts-expect-error Reflection requires a line as its mirror.
board.create("reflection", [a, b]);
// @ts-expect-error A semicircle requires two points.
board.create("semicircle", [a]);
// @ts-expect-error A sector requires three points or two lines with directions and radius.
board.create("sector", [a, b]);
// @ts-expect-error A conic requires five points or six coefficients.
board.create("conic", [1, 2, 3, 4]);
// @ts-expect-error A button requires a handler.
board.create("button", [0, 0, "missing handler"]);
// @ts-expect-error An image requires a size.
board.create("image", ["image.png", [0, 0]]);
// @ts-expect-error A group contains geometry elements.
board.create("group", [[0, 0]]);
// @ts-expect-error A grid only accepts axes.
board.create("grid", [a]);

const stepFlowLayout = board.create("stepflowlayout", [{ steps: ["observe", "explain"] }]);
const localNumberLine = board.create("localnumberline", [
    [-5, 0],
    [5, 0]
]);
const table = board.create("table", [[["x", "y"]]]);
const matrix = board.create("matrix", [
    [
        [1, 0],
        [0, 1]
    ]
]);

const nativeTable: JXG.TableComposition = table;
const nativeMatrix: JXG.MatrixComposition = matrix;
void nativeTable;
void nativeMatrix;

stepFlowLayout.body.step("observe").point(["center", "center"]);
localNumberLine.point(1);
table.cell(0, 0).setAttribute({ visible: true });
matrix.entry(0, 0).setAttribute({ visible: true });
board.create("text", [0, 0, "native reveal"], { typewriter: () => 0.5 });

// @ts-expect-error A table accepts only cell rows.
board.create("table", [a, [["x"]]]);
// @ts-expect-error A local number line requires a region or two points.
board.create("localnumberline", [a]);
