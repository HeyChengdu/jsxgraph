import JXG from "../jxg.js";
import {
    createCellGridGeometry,
    normalizeCellContent,
    omitUndefined,
    ownGeneratedLine,
    readCellGridVisualAttributes,
    validateCellRows
} from "./cellGrid.js";
const DEFAULT_PADDING = 0.18;
function createTable(board, parents, attributes) {
    const [region, rawRows] = readTableParents(parents);
    const rows = validateCellRows("table", rawRows);
    const padding = readNonNegativeNumber(attributes.padding, DEFAULT_PADDING);
    const visual = readCellGridVisualAttributes("table", attributes);
    const common = omitUndefined({
        fixed: visual.fixed,
        highlight: visual.highlight,
        layer: visual.layer,
        visible: visual.visible
    });
    const center = region.point(["center", "center"]);
    let geometry;
    const cells = rows.map((row, rowIndex) =>
        row.map((content, columnIndex) =>
            board.create(
                "text",
                [
                    () => geometry?.cellCenter(rowIndex, columnIndex)[0]() ?? center[0](),
                    () => geometry?.cellCenter(rowIndex, columnIndex)[1]() ?? center[1](),
                    normalizeCellContent(content)
                ],
                omitUndefined({
                    ...common,
                    anchorX: "middle",
                    anchorY: "middle",
                    fontSize: visual.fontSize,
                    strokeColor: visual.strokeColor,
                    useKatex: visual.useKatex
                })
            )
        )
    );
    geometry = createCellGridGeometry(region, cells, {
        columnGap: 0,
        padding,
        rowGap: 0
    });
    const rightBoundary = geometry.columnBoundaries.at(-1);
    if (!rightBoundary) {
        throw new Error("JSXGraph: table requires at least one column.");
    }
    const backgroundCorners = [
        [geometry.left, geometry.top],
        [rightBoundary, geometry.top],
        [rightBoundary, geometry.bottom],
        [geometry.left, geometry.bottom]
    ];
    const background = board.create(
        "polygon",
        backgroundCorners,
        omitUndefined({
            ...common,
            borders: { visible: false },
            fillColor: visual.fillColor,
            fillOpacity: visual.fillOpacity,
            vertices: { visible: false }
        })
    );
    const lineAttributes = omitUndefined({
        ...common,
        straightFirst: false,
        straightLast: false,
        strokeColor: visual.strokeColor,
        strokeOpacity: visual.strokeOpacity,
        strokeWidth: visual.strokeWidth
    });
    const verticalLines = geometry.columnBoundaries.map((x) =>
        board.create(
            "line",
            [
                [x, geometry.top],
                [x, geometry.bottom]
            ],
            lineAttributes
        )
    );
    const horizontalLines = geometry.rowBoundaries.map((y) =>
        board.create(
            "line",
            [
                [geometry.left, y],
                [rightBoundary, y]
            ],
            lineAttributes
        )
    );
    const lines = [...verticalLines, ...horizontalLines];
    const objects = Object.fromEntries([
        ["background", background],
        ...cells.flatMap((row, rowIndex) =>
            row.map((cell, columnIndex) => [`cell${rowIndex}_${columnIndex}`, cell])
        ),
        ...lines.map((line, index) => [`line${index}`, ownGeneratedLine(line)])
    ]);
    return Object.assign(new JXG.Composition(objects), {
        background,
        cells,
        lines,
        cell(row, column) {
            const cell = cells[row]?.[column];
            if (!cell) throw new RangeError(`table cell (${row}, ${column}) does not exist.`);
            return cell;
        }
    });
}
function readTableParents(parents) {
    if (parents.length !== 2 || !isLayoutRegion(parents[0]) || !Array.isArray(parents[1])) {
        throw new Error(
            "JSXGraph: table parents must be [LayoutRegion, rows]. Example: board.create('table', [layout.body, [['A', 'B']]])."
        );
    }
    return [parents[0], parents[1]];
}
function isLayoutRegion(value) {
    return (
        typeof value === "object" &&
        value !== null &&
        "point" in value &&
        typeof value.point === "function"
    );
}
function readNonNegativeNumber(value, fallback) {
    const number = value ?? fallback;
    if (typeof number !== "number" || !Number.isFinite(number) || number < 0) {
        throw new RangeError(
            'JSXGraph: table attribute "padding" must be a non-negative finite number.'
        );
    }
    return number;
}
JXG.registerElement("table", createTable);
