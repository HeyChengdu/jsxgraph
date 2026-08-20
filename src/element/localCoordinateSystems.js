import JXG from "../jxg.js";
const RANGE = [-5, 5];
const value = (v) => (typeof v === "function" ? v() : v);
function isPoint(v) {
    if (Array.isArray(v))
        return (
            v.length === 2 && v.every((x) => typeof x === "number" || typeof x === "function")
        );
    const p = v;
    return !!p && typeof p.X === "function" && typeof p.Y === "function";
}
function coords(p) {
    return Array.isArray(p)
        ? [() => value(p[0]), () => value(p[1])]
        : [() => p.X(), () => p.Y()];
}
function range(v, fallback, type, key) {
    if (v === undefined) return fallback;
    if (
        !Array.isArray(v) ||
        v.length !== 2 ||
        typeof v[0] !== "number" ||
        typeof v[1] !== "number" ||
        !Number.isFinite(v[0]) ||
        !Number.isFinite(v[1]) ||
        v[0] >= v[1]
    )
        throw new RangeError(
            `JSXGraph: ${type} attribute "${key}" must be [minimum, maximum].`
        );
    return [v[0], v[1]];
}
function positiveNumber(value, fallback, type, key) {
    const number = value ?? fallback;
    if (typeof number !== "number" || !Number.isFinite(number) || number <= 0) {
        throw new RangeError(
            `JSXGraph: ${type} attribute "${key}" must be a positive finite number.`
        );
    }
    return number;
}
function between(a, b, ratio) {
    return [
        () => a[0]() + (b[0]() - a[0]()) * ratio(),
        () => a[1]() + (b[1]() - a[1]()) * ratio()
    ];
}
function endpoints(parents, attributes) {
    if (parents.length === 2 && isPoint(parents[0]) && isPoint(parents[1]))
        return [coords(parents[0]), coords(parents[1])];
    throw new Error("JSXGraph: localnumberline accepts [point1, point2].");
}
function childAttributes(attributes) {
    const {
        orientation: _o,
        position: _p,
        range: _r,
        tickDistance: _d,
        line: _l,
        ticks: _t,
        ...rest
    } = attributes;
    return rest;
}
function createLocalNumberLine(board, parents, attributes) {
    const logicalRange = range(attributes.range, RANGE, "localnumberline", "range");
    const [start, end] = endpoints(parents, attributes);
    const span = logicalRange[1] - logicalRange[0];
    const tickDistance = positiveNumber(
        attributes.tickDistance,
        1,
        "localnumberline",
        "tickDistance"
    );
    const shared = childAttributes(attributes);
    const line = board.create("segment", [start, end], {
        ...shared,
        ...attributes.line
    });
    const length = () => Math.hypot(end[0]() - start[0](), end[1]() - start[1]());
    const ticks = board.create("ticks", [line, 1], {
        anchor: "left",
        drawLabels: true,
        drawZero: true,
        insertTicks: false,
        ticksDistance: () => (length() * tickDistance) / span,
        generateLabelText: (tick) => {
            const dx = end[0]() - start[0]();
            const dy = end[1]() - start[1]();
            const ratio =
                ((tick.usrCoords[1] - start[0]()) * dx +
                    (tick.usrCoords[2] - start[1]()) * dy) /
                (dx * dx + dy * dy);
            return Number((logicalRange[0] + ratio * span).toFixed(10)).toString();
        },
        visible: attributes.visible,
        ...attributes.ticks
    });
    const point = (v) => between(start, end, () => (value(v) - logicalRange[0]) / span);
    return Object.assign(
        new JXG.Composition({
            ticks,
            line,
            startPoint: line.point1,
            endPoint: line.point2
        }),
        {
            point,
            range: logicalRange,
            subs: { line, ticks }
        }
    );
}
JXG.registerElement("localnumberline", createLocalNumberLine);
