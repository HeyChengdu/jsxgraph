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
function createResponsiveRegion({ bottom, left, right, top }) {
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
    return { point };
}
function parsePosition(position, semanticRatios, axis) {
    if (typeof position !== "string") {
        throw new TypeError(
            `ResponsiveRegion.point ${axis} accepts only semantic anchors or percentage strings; received ${String(position)}.`
        );
    }
    const semanticRatio = semanticRatios[position];
    if (semanticRatio !== undefined) return semanticRatio;
    if (!position.endsWith("%") || position.length === 1) {
        throw new RangeError(
            `ResponsiveRegion.point ${axis} position must be a semantic anchor or percentage from 0% to 100%; received "${position}".`
        );
    }
    const percentage = Number(position.slice(0, -1));
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
        throw new RangeError(
            `ResponsiveRegion.point ${axis} percentage must be from 0% to 100%; received "${position}".`
        );
    }
    return percentage / 100;
}
function assertNormalizedPosition(value, axis) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new RangeError(
            `ResponsiveRegion ${axis} projection must be a finite number from 0 to 1; received ${value}.`
        );
    }
}
export function createBoardRegion(board, padding) {
    const coordinate = (index) => () => board.getBoundingBox()[index];
    const boardLeft = coordinate(0);
    const boardTop = coordinate(1);
    const boardRight = coordinate(2);
    const boardBottom = coordinate(3);
    return createResponsiveRegion({
        left: () => boardLeft() + padding,
        right: () => boardRight() - padding,
        bottom: () => boardBottom() + padding,
        top: () => boardTop() - padding
    });
}
