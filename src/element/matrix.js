import JXG from "../jxg.js";
import {
    createCellGridGeometry,
    readCellAnchor,
    normalizeCellContent,
    omitUndefined,
    ownGeneratedLine,
    readCellGridVisualAttributes,
    validateCellRows
} from "./cellGrid.js";
import { createBoardRegion, createPointRegion } from "./responsiveRegion.js";
const DEFAULT_COLUMN_GAP = 0.35;
const DEFAULT_PADDING = 0.22;
const DEFAULT_ROW_GAP = 0.22;

/**
 * Horizontal gap between entries in board user coordinates.
 * @name Matrix#columnGap
 * @type Number
 * @default 0.35
 * @visprop
 */

/**
 * Vertical gap between entries in board user coordinates.
 * @name Matrix#rowGap
 * @type Number
 * @default 0.22
 * @visprop
 */

/**
 * Gap between the entries and brackets in board user coordinates.
 * @name Matrix#padding
 * @type Number
 * @default 0.22
 * @visprop
 */

/**
 * Font size shared by generated entry texts.
 * @name Matrix#fontSize
 * @type Number
 * @visprop
 */

/**
 * Whether generated entry texts render mathematical content with KaTeX.
 * @name Matrix#useKatex
 * @type Boolean
 * @default false
 * @visprop
 */

/**
 * Return the generated text element at a zero-based row and column.
 * @name Matrix#entry
 * @function
 * @param {Number} row Zero-based row index.
 * @param {Number} column Zero-based column index.
 * @returns {JXG.Text} Generated matrix entry text.
 */

/**
 * @class Create a responsive bracketed matrix from rows of text or numeric entries.
 * @pseudo
 * @name Matrix
 * @augments JXG.Composition
 * @constructor
 * @type JXG.Composition
 * @param {Array|Number} parents Either `[rows]` (legacy, anchored at the board center) or `[x, y, rows]`.
 * @example
 * var matrix = board.create('matrix', [[['a', 'b'], ['c', 'd']]], {
 *     columnGap: 0.4,
 *     rowGap: 0.25,
 *     useKatex: true
 * });
 * @example
 * var anchored = board.create('matrix', [0, 0, [[['a', 'b'], ['c', 'd']]]], {
 *     columnGap: 0.4
 * });
 */
/**
 * 用函数式 curve 画直线段：不产生任何顶点 Point。
 * line/polygon 由坐标数组创建时会自动补端点，而这些端点在构造瞬间就被画一次，
 * 之后即便可见性变成 false 也不会被清除，画面上因此留下永久圆点。
 */
function gridSegment(board, from, to, attributes) {
    const at = (value) => (typeof value === "function" ? value : () => value);
    const x1 = at(from[0]);
    const y1 = at(from[1]);
    const x2 = at(to[0]);
    const y2 = at(to[1]);
    return board.create(
        "curve",
        [
            (t) => x1() + t * (x2() - x1()),
            (t) => y1() + t * (y2() - y1()),
            0,
            1
        ],
        attributes
    );
}

function createMatrix(board, parents, attributes) {
    const { region, rows: rawRows } = readMatrixParents(board, parents);
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
        anchor: readCellAnchor(attributes),
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
        gridSegment(board, segment[0], segment[1], {
            ...common,
            straightFirst: false,
            straightLast: false
        })
    );
    const objects = Object.fromEntries([
        ...entries.flatMap((row, rowIndex) =>
            row.map((entry, columnIndex) => [`entry${rowIndex}_${columnIndex}`, entry])
        ),
        ...brackets.map((line, index) => [`bracket${index}`, ownGeneratedLine(line)])
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
/**
 * 兼容两种 parents 形状：[rows] 沿用板面区域中心（随包围盒变化），[x, y, rows] 落在用户坐标点上。
 */
function readMatrixParents(board, parents) {
    if (parents.length === 1 && Array.isArray(parents[0])) {
        return { region: createBoardRegion(board, 0), rows: parents[0] };
    }
    if (parents.length !== 3 || !Array.isArray(parents[2])) {
        throw new Error(
            "JSXGraph: matrix parents must be [rows] or [x, y, rows]. Example: board.create('matrix', [[['a'], ['b']]]) or board.create('matrix', [0, 0, [[['a'], ['b']]]])."
        );
    }
    return { region: createPointRegion(parents[0], parents[1]), rows: parents[2] };
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
