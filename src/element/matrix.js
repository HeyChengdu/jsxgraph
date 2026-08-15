import JXG from "../jxg.js";
import {
    createCellGridGeometry,
    normalizeCellContent,
    omitUndefined,
    readCellGridVisualAttributes,
    validateCellRows
} from "./cellGrid.js";
const DEFAULT_COLUMN_GAP = 0.35;
const DEFAULT_PADDING = 0.22;
const DEFAULT_ROW_GAP = 0.22;
function createMatrix(board, parents, attributes) {
    const [region, rawRows] = readMatrixParents(parents);
    const rows = validateCellRows("matrix", rawRows);
    const columnGap = readNonNegativeNumber(attributes, "columnGap", DEFAULT_COLUMN_GAP);
    const padding = readNonNegativeNumber(attributes, "padding", DEFAULT_PADDING);
    const rowGap = readNonNegativeNumber(attributes, "rowGap", DEFAULT_ROW_GAP);
    const visual = readCellGridVisualAttributes("matrix", attributes);
    const common = omitUndefined({
        fixed: visual.fixed,
        highlight: visual.highlight,
        layer: visual.layer,
        strokeColor: visual.strokeColor,
        strokeOpacity: visual.strokeOpacity,
        strokeWidth: visual.strokeWidth,
        visible: visual.visible
    });
    const center = region.point(["center", "center"]);
    let geometry;
    const entries = rows.map((row, rowIndex) =>
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
                    useKatex: visual.useKatex
                })
            )
        )
    );
    geometry = createCellGridGeometry(region, entries, {
        columnGap,
        padding: 0,
        rowGap,
        uniformColumns: true,
        uniformRows: true
    });
    const rightBoundary = geometry.columnBoundaries.at(-1);
    if (!rightBoundary) {
        throw new Error("JSXGraph: matrix requires at least one column.");
    }
    const right = () => rightBoundary() + padding;
    const left = () => geometry.left() - padding;
    const cap = Math.max(0.12, padding * 0.75);
    const bracketSegments = [
        [
            [() => left() + cap, geometry.top],
            [left, geometry.top]
        ],
        [
            [left, geometry.top],
            [left, geometry.bottom]
        ],
        [
            [left, geometry.bottom],
            [() => left() + cap, geometry.bottom]
        ],
        [
            [() => right() - cap, geometry.top],
            [right, geometry.top]
        ],
        [
            [right, geometry.top],
            [right, geometry.bottom]
        ],
        [
            [right, geometry.bottom],
            [() => right() - cap, geometry.bottom]
        ]
    ];
    const brackets = bracketSegments.map((segment) =>
        board.create("line", segment, {
            ...common,
            straightFirst: false,
            straightLast: false
        })
    );
    const objects = Object.fromEntries([
        ...entries.flatMap((row, rowIndex) =>
            row.map((entry, columnIndex) => [`entry${rowIndex}_${columnIndex}`, entry])
        ),
        ...brackets.map((line, index) => [`bracket${index}`, line])
    ]);
    return Object.assign(new JXG.Composition(objects), {
        brackets,
        entries,
        entry(row, column) {
            const entry = entries[row]?.[column];
            if (!entry)
                throw new RangeError(`matrix entry (${row}, ${column}) does not exist.`);
            return entry;
        }
    });
}
function readMatrixParents(parents) {
    if (parents.length !== 2 || !isLayoutRegion(parents[0]) || !Array.isArray(parents[1])) {
        throw new Error(
            "JSXGraph: matrix parents must be [LayoutRegion, rows]. Example: board.create('matrix', [layout.body, [['a', 'b']]])."
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
function readNonNegativeNumber(attributes, key, fallback) {
    const value = attributes[key] ?? fallback;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new RangeError(
            `JSXGraph: matrix attribute "${key}" must be a non-negative finite number.`
        );
    }
    return value;
}
JXG.registerElement("matrix", createMatrix);
