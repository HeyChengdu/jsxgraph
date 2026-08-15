import JXG from "../jxg.js";
import { projectLayoutRegion } from "./layout/layoutRegion.js";
const RANGE = [-5, 5];
const RADIUS_RANGE = [0, 5];
const PAD = 0.05;
const MAX_POLAR_GRID_ELEMENTS = 4096;
const value = (v) => (typeof v === "function" ? v() : v);
function isRegion(v) {
    const r = v;
    return !!r && typeof r.point === "function";
}
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
    if (parents.length === 1 && isRegion(parents[0])) {
        const vertical = attributes.orientation === "vertical";
        const position = typeof attributes.position === "number" ? attributes.position : 0.5;
        return vertical
            ? [
                  projectLayoutRegion(parents[0], [position, PAD]),
                  projectLayoutRegion(parents[0], [position, 1 - PAD])
              ]
            : [
                  projectLayoutRegion(parents[0], [PAD, position]),
                  projectLayoutRegion(parents[0], [1 - PAD, position])
              ];
    }
    if (parents.length === 2 && isPoint(parents[0]) && isPoint(parents[1]))
        return [coords(parents[0]), coords(parents[1])];
    throw new Error("JSXGraph: localnumberline accepts [LayoutRegion] or [point1, point2].");
}
function childAttributes(attributes) {
    const {
        orientation: _o,
        position: _p,
        range: _r,
        tickDistance: _d,
        line: _l,
        ticks: _t,
        xRange: _x,
        yRange: _y,
        xAxis: _xa,
        yAxis: _ya,
        radiusRange: _rr,
        radialAxis: _ra,
        angleStep: _as,
        circles: _c,
        radiusStep: _rs,
        rays: _rays,
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
function cartesianParts(parents, xr, yr) {
    if (parents.length === 1 && isRegion(parents[0])) {
        const r = parents[0],
            ox = PAD + 0.9 * ((0 - xr[0]) / (xr[1] - xr[0])),
            oy = PAD + 0.9 * ((0 - yr[0]) / (yr[1] - yr[0]));
        return {
            origin: projectLayoutRegion(r, [ox, oy]),
            xs: projectLayoutRegion(r, [PAD, oy]),
            xe: projectLayoutRegion(r, [1 - PAD, oy]),
            ys: projectLayoutRegion(r, [ox, PAD]),
            ye: projectLayoutRegion(r, [ox, 1 - PAD])
        };
    }
    if (parents.length === 3 && parents.every(isPoint) && xr[1] > 0 && yr[1] > 0) {
        const origin = coords(parents[0]),
            xe = coords(parents[1]),
            ye = coords(parents[2]);
        return {
            origin,
            xe,
            ye,
            xs: between(origin, xe, () => xr[0] / xr[1]),
            ys: between(origin, ye, () => yr[0] / yr[1])
        };
    }
    throw new Error(
        "JSXGraph: localcartesianplane accepts [LayoutRegion] or [origin, xPositiveEnd, yPositiveEnd]."
    );
}
function createLocalCartesianPlane(board, parents, attributes) {
    const xr = range(attributes.xRange, RANGE, "localcartesianplane", "xRange"),
        yr = range(attributes.yRange, RANGE, "localcartesianplane", "yRange"),
        p = cartesianParts(parents, xr, yr),
        shared = childAttributes(attributes);
    const { ticks: xTicks, ...xAxisAttributes } = attributes.xAxis ?? {},
        { ticks: yTicks, ...yAxisAttributes } = attributes.yAxis ?? {};
    const xAxis = board.create("localnumberline", [p.xs, p.xe], {
            ...shared,
            range: xr,
            ...xAxisAttributes,
            ticks: { drawZero: false, ...xTicks }
        }),
        yAxis = board.create("localnumberline", [p.ys, p.ye], {
            ...shared,
            range: yr,
            ...yAxisAttributes,
            ticks: { drawZero: false, ...yTicks }
        });
    const point = ([x, y]) => [
        () =>
            p.origin[0]() +
            ((p.xe[0]() - p.origin[0]()) * value(x)) / xr[1] +
            ((p.ye[0]() - p.origin[0]()) * value(y)) / yr[1],
        () =>
            p.origin[1]() +
            ((p.xe[1]() - p.origin[1]()) * value(x)) / xr[1] +
            ((p.ye[1]() - p.origin[1]()) * value(y)) / yr[1]
    ];
    return Object.assign(new JXG.Composition({ xAxis, yAxis }), {
        point,
        subs: {
            xAxis,
            xTicks: xAxis.subs.ticks,
            yAxis,
            yTicks: yAxis.subs.ticks
        }
    });
}
function createLocalPolarPlane(board, parents, attributes) {
    const rr = range(attributes.radiusRange, RADIUS_RANGE, "localpolarplane", "radiusRange");
    if (rr[0] !== 0)
        throw new RangeError("JSXGraph: localpolarplane radiusRange must start at 0.");
    let center, end;
    if (parents.length === 1 && isRegion(parents[0]))
        [center, end] = [
            parents[0].point(["center", "center"]),
            projectLayoutRegion(parents[0], [1 - PAD, 0.5])
        ];
    else if (parents.length === 2 && isPoint(parents[0]) && isPoint(parents[1]))
        [center, end] = [coords(parents[0]), coords(parents[1])];
    else
        throw new Error(
            "JSXGraph: localpolarplane accepts [LayoutRegion] or [center, radiusPoint]."
        );
    const radiusStep = positiveNumber(
        attributes.radiusStep,
        1,
        "localpolarplane",
        "radiusStep"
    );
    const angleStep = positiveNumber(attributes.angleStep, 30, "localpolarplane", "angleStep");
    const circleCount = Math.floor(rr[1] / radiusStep);
    const rayCount = Math.ceil(360 / angleStep);
    if (circleCount + rayCount > MAX_POLAR_GRID_ELEMENTS) {
        throw new RangeError(
            `JSXGraph: localpolarplane would create ${circleCount + rayCount} grid elements; maximum is ${MAX_POLAR_GRID_ELEMENTS}. Increase "radiusStep" or "angleStep".`
        );
    }
    const radialAxis = board.create("localnumberline", [center, end], {
        ...childAttributes(attributes),
        range: rr,
        ...attributes.radialAxis
    });
    const circles = [];
    for (let radius = radiusStep; radius <= rr[1]; radius += radiusStep) {
        circles.push(
            board.create("circle", [center, radialAxis.point(radius)], {
                ...childAttributes(attributes),
                withLabel: false,
                ...attributes.circles
            })
        );
    }
    const rays = [];
    for (let angle = 0; angle < 360; angle += angleStep) {
        const radians = (angle * Math.PI) / 180;
        const rayEnd = [
            () =>
                center[0]() +
                (end[0]() - center[0]()) * Math.cos(radians) -
                (end[1]() - center[1]()) * Math.sin(radians),
            () =>
                center[1]() +
                (end[0]() - center[0]()) * Math.sin(radians) +
                (end[1]() - center[1]()) * Math.cos(radians)
        ];
        rays.push(
            board.create("segment", [center, rayEnd], {
                ...childAttributes(attributes),
                withLabel: false,
                ...attributes.rays
            })
        );
    }
    const point = ([radius, angle]) => {
        const t = () => value(radius) / rr[1],
            a = () => (value(angle) * Math.PI) / 180,
            dx = () => end[0]() - center[0](),
            dy = () => end[1]() - center[1]();
        return [
            () => center[0]() + t() * (dx() * Math.cos(a()) - dy() * Math.sin(a())),
            () => center[1]() + t() * (dx() * Math.sin(a()) + dy() * Math.cos(a()))
        ];
    };
    const objects = {
        radialLine: radialAxis.subs.line,
        radialTicks: radialAxis.subs.ticks
    };
    circles.forEach((circle, index) => (objects[`circle${index}`] = circle));
    rays.forEach((ray, index) => (objects[`ray${index}`] = ray));
    return Object.assign(new JXG.Composition(objects), {
        point,
        subs: { circles, radialAxis, rays }
    });
}
JXG.registerElement("localnumberline", createLocalNumberLine);
JXG.registerElement("localcartesianplane", createLocalCartesianPlane);
JXG.registerElement("localpolarplane", createLocalPolarPlane);
