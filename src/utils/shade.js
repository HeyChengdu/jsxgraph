/**
 * [INPUT]: Closed native geometry and the Board-owned attention scheduler
 * [OUTPUT]: Transient region fills for existing elements and ordered Point rings
 * [POS]: Presentation-only native overlays; source coordinates and styles stay untouched
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import Const from "../base/constants.js";
import { scheduleAttention } from "./attention.js";

const fail = () => {
    throw new Error("JSXGraph: shade requires a nondegenerate simple closed 2D region.");
};
const live = (board, element) =>
    element &&
    !element.is3D &&
    element.board === board &&
    board.objects[element.id] === element;

function ringPoints(board, vertices) {
    if (!Array.isArray(vertices)) fail();
    const ring = [...vertices];
    if (ring.length > 1 && ring[0] === ring[ring.length - 1]) ring.pop();
    if (
        ring.length < 3 ||
        new Set(ring).size !== ring.length ||
        ring.some(
            (point) => !live(board, point) || point.elementClass !== Const.OBJECT_CLASS_POINT
        )
    )
        fail();
    return ring;
}

/** Normalize before predicates so a small valid classroom figure is not treated as zero. */
function simpleRing(ring) {
    const raw = ring.map((point) => [point.X(), point.Y()]);
    if (raw.some((point) => point.some((value) => !Number.isFinite(value)))) return false;
    const origin = raw[0];
    const scale = Math.max(
        ...raw.flatMap((p) => [Math.abs(p[0] - origin[0]), Math.abs(p[1] - origin[1])])
    );
    if (!Number.isFinite(scale) || scale === 0) return false;
    const points = raw.map((p) => [(p[0] - origin[0]) / scale, (p[1] - origin[1]) / scale]);
    const epsilon = 64 * Number.EPSILON;
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const on = (a, b, p) =>
        Math.abs(cross(a, b, p)) <= epsilon &&
        p.every(
            (v, k) => v >= Math.min(a[k], b[k]) - epsilon && v <= Math.max(a[k], b[k]) + epsilon
        );
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i],
            b = points[(i + 1) % points.length],
            c = points[(i + 2) % points.length];
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= epsilon) return false;
        if (
            Math.abs(cross(a, b, c)) <= epsilon &&
            (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0
        )
            return false;
        area += a[0] * b[1] - a[1] * b[0];
        for (let j = i + 2; j < points.length; j++) {
            if (i === 0 && j === points.length - 1) continue;
            const d = points[j],
                e = points[(j + 1) % points.length];
            if (
                on(a, b, d) ||
                on(a, b, e) ||
                on(d, e, a) ||
                on(d, e, b) ||
                (cross(a, b, d) * cross(a, b, e) < 0 && cross(d, e, a) * cross(d, e, b) < 0)
            )
                return false;
        }
    }
    return Math.abs(area) > epsilon;
}

function closedCurve(element) {
    const points = element.points.slice(0, element.numberPoints);
    if (points.length < 3 || points.some((p) => !p.usrCoords.every(Number.isFinite)))
        return false;
    const first = points[0].usrCoords,
        last = points[points.length - 1].usrCoords;
    const scale = Math.max(
        ...points.map((p) => Math.hypot(p.usrCoords[1] - first[1], p.usrCoords[2] - first[2]))
    );
    if (!(scale > 0) || Math.hypot(first[1] - last[1], first[2] - last[2]) > scale * 1e-8)
        return false;
    let area = 0;
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1].usrCoords,
            b = points[i].usrCoords;
        area +=
            ((a[1] - first[1]) / scale) * ((b[2] - first[2]) / scale) -
            ((b[1] - first[1]) / scale) * ((a[2] - first[2]) / scale);
    }
    return Math.abs(area) > 64 * Number.EPSILON;
}

function ringKey(ring) {
    const ids = ring.map((point) => point.id);
    const variants = [ids, [...ids].reverse()].flatMap((order) =>
        order.map((_, i) => JSON.stringify([...order.slice(i), ...order.slice(0, i)]))
    );
    return variants.sort()[0];
}

function scheduleRegion(board, source, ring, valid, create, duration) {
    if (!Number.isFinite(duration) || duration < 0)
        throw new Error("JSXGraph: shade duration must be finite and nonnegative.");
    if (!valid()) fail();
    let overlay;
    const key = source ?? ringKey(ring);
    const state = {
        element: source ?? ring[0],
        kind: "shade",
        target: key,
        dependencies: source ? [source] : ring,
        progress: 0,
        isCurrent: valid,
        // Geometry stays native; inline presentation bypasses SVG's deferred attribute writes.
        render() {
            if (overlay?.rendNode) overlay.rendNode.style.fillOpacity = String(opacity());
        },
        prepare() {
            overlay = create({
                name: "",
                withLabel: false,
                fixed: true,
                highlight: false,
                visible: valid,
                fillColor: "amber-600",
                transitionDuration: 0,
                fillOpacity: () => opacity(),
                strokeOpacity: 0,
                strokeWidth: 0,
                withLines: false,
                layer: source ? source.evalVisProp("layer") : 3
            });
            overlay.dump = false;
            overlay.hasPoint = () => false;
            overlay.rendNode?.setAttribute("pointer-events", "none");
            if (overlay.rendNode) overlay.rendNode.style.pointerEvents = "none";
            overlay.rendNode?.setAttribute("data-jxg-attention", "shade");
        },
        dispose() {
            const owned = overlay;
            overlay = undefined;
            if (owned && board.objects[owned.id]) board.removeObject(owned);
        }
    };
    const opacity = () =>
        0.22 * Math.max(0, Math.min(1, state.progress * 5, (1 - state.progress) * 5));
    scheduleAttention(
        state,
        duration,
        (previous) => previous.kind === "shade" && previous.target === key
    );
}

export function shadePolygon(board, vertices, duration = 1000) {
    const ring = ringPoints(board, vertices);
    const valid = () => ring.every((point) => live(board, point)) && simpleRing(ring);
    scheduleRegion(
        board,
        null,
        ring,
        valid,
        (attrs) => board.create("polygon", ring, attrs),
        duration
    );
    return board;
}

export function shadeElement(element, duration = 1000) {
    const board = element.board;
    if (!live(board, element) || element.elType === "polygonalchain") fail();
    const visible = () => live(board, element) && element.evalVisProp("visible");
    let valid, create;
    if (element.elementClass === Const.OBJECT_CLASS_AREA && element.vertices) {
        const ring = ringPoints(board, element.vertices);
        // Coordinate motion preserves the region; topology edits invalidate this invocation.
        valid = () =>
            visible() &&
            element.vertices.length === ring.length + 1 &&
            ring.every((p, i) => element.vertices[i] === p && live(board, p)) &&
            element.vertices[ring.length] === ring[0] &&
            simpleRing(ring);
        create = (attrs) => board.create("polygon", ring, attrs);
    } else if (element.elementClass === Const.OBJECT_CLASS_CIRCLE) {
        valid = () =>
            visible() &&
            Number.isFinite(element.Radius()) &&
            element.Radius() > 0 &&
            Number.isFinite(element.center.X()) &&
            Number.isFinite(element.center.Y());
        create = (attrs) =>
            board.create("circle", [element.center, () => element.Radius()], attrs);
    } else if (
        element.elType === "ellipse" ||
        element.elType === "sector" ||
        element.elType === "circumcirclesector"
    ) {
        valid = () => visible() && closedCurve(element);
        create = (attrs) => {
            const curve = board.create("curve", [[], []], attrs);
            curve.updateDataArray = function () {
                const points = element.points.slice(0, element.numberPoints);
                this.dataX = points.map((point) => point.usrCoords[1]);
                this.dataY = points.map((point) => point.usrCoords[2]);
                this.bezierDegree = element.bezierDegree;
            };
            element.addChild(curve);
            curve.fullUpdate();
            return curve;
        };
    } else fail();
    scheduleRegion(board, element, null, valid, create, duration);
    return element;
}
