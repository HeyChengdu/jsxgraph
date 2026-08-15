const horizontalRatios = {
    center: 0.5,
    left: 0,
    right: 1
};
const verticalRatios = {
    bottom: 0,
    center: 0.5,
    top: 1
};
const regionProjections = new WeakMap();
export function projectLayoutRegion(region, position) {
    const project = regionProjections.get(region);
    if (!project) throw new TypeError("LayoutRegion was not created by JSXGraph.");
    return project(position);
}
export function createLayoutRegion({ bottom, left, right, top }) {
    const points = new Map();
    const project = ([xRatio, yRatio]) => {
        assertNormalizedPosition(xRatio, "horizontal");
        assertNormalizedPosition(yRatio, "vertical");
        const key = `${xRatio}:${yRatio}`;
        const cached = points.get(key);
        if (cached) return cached;
        const projected = [
            () => left() + (right() - left()) * xRatio,
            () => bottom() + (top() - bottom()) * yRatio
        ];
        points.set(key, projected);
        return projected;
    };
    const point = ([horizontal, vertical]) => {
        const xRatio = parsePosition(horizontal, horizontalRatios, "horizontal");
        const yRatio = parsePosition(vertical, verticalRatios, "vertical");
        return project([xRatio, yRatio]);
    };
    const region = {
        point
    };
    regionProjections.set(region, project);
    return region;
}
function parsePosition(position, semanticRatios, axis) {
    if (typeof position !== "string") {
        throw new TypeError(
            `LayoutRegion.point ${axis} accepts only semantic anchors or percentage strings; received ${String(position)}.`
        );
    }
    const semanticRatio = semanticRatios[position];
    if (semanticRatio !== undefined) return semanticRatio;
    if (!position.endsWith("%") || position.length === 1) {
        throw new RangeError(
            `LayoutRegion.point ${axis} position must be a semantic anchor or percentage from 0% to 100%; received "${position}".`
        );
    }
    const percentage = Number(position.slice(0, -1));
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
        throw new RangeError(
            `LayoutRegion.point ${axis} percentage must be from 0% to 100%; received "${position}".`
        );
    }
    return percentage / 100;
}
function assertNormalizedPosition(value, axis) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new RangeError(
            `LayoutRegion ${axis} projection must be a finite number from 0 to 1; received ${value}.`
        );
    }
}
export function createBoardRegion(board, padding) {
    const coordinate = (index) => () => board.getBoundingBox()[index];
    const boardLeft = coordinate(0);
    const boardTop = coordinate(1);
    const boardRight = coordinate(2);
    const boardBottom = coordinate(3);
    return createLayoutRegion({
        left: () => boardLeft() + padding,
        right: () => boardRight() - padding,
        bottom: () => boardBottom() + padding,
        top: () => boardTop() - padding
    });
}
export function createLayoutFrame(board, { footerRatio, gap, headerRatio, padding }) {
    const inner = createBoardRegion(board, padding);
    const innerLeft = inner.point(["left", "center"])[0];
    const innerRight = inner.point(["right", "center"])[0];
    const innerTop = inner.point(["center", "top"])[1];
    const innerBottom = inner.point(["center", "bottom"])[1];
    const footerTop = () => innerBottom() + (innerTop() - innerBottom()) * footerRatio;
    const headerBottom = () => innerTop() - (innerTop() - innerBottom()) * headerRatio;
    return {
        header: createLayoutRegion({
            left: innerLeft,
            right: innerRight,
            bottom: headerBottom,
            top: innerTop
        }),
        body: createLayoutRegion({
            left: innerLeft,
            right: innerRight,
            bottom: () => footerTop() + gap * 0.5,
            top: () => headerBottom() - gap * 0.5
        }),
        footer: createLayoutRegion({
            left: innerLeft,
            right: innerRight,
            bottom: innerBottom,
            top: footerTop
        })
    };
}
export function readNonNegativeLayoutNumber(attributes, elementType, key, fallback) {
    const value = attributes[key] ?? fallback;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new RangeError(
            `JSXGraph: ${elementType} attribute "${key}" must be a non-negative finite number.`
        );
    }
    return value;
}
export function readLayoutRatio(attributes, elementType, key, fallback) {
    const value = attributes[key] ?? fallback;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value >= 0.5) {
        throw new RangeError(
            `JSXGraph: ${elementType} attribute "${key}" must be greater than 0 and less than 0.5.`
        );
    }
    return value;
}
