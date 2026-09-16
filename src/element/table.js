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
const DEFAULT_PADDING = 0.18;

/**
 * Inner cell padding in board user coordinates.
 * @name Table#padding
 * @type Number
 * @default 0.18
 * @visprop
 */

/**
 * Font size shared by generated cell texts.
 * @name Table#fontSize
 * @type Number
 * @visprop
 */

/**
 * Whether generated cell texts render mathematical content with KaTeX.
 * @name Table#useKatex
 * @type Boolean
 * @default false
 * @visprop
 */

/**
 * Return the generated text element at a zero-based row and column.
 * @name Table#cell
 * @function
 * @param {Number} row Zero-based row index.
 * @param {Number} column Zero-based column index.
 * @returns {JXG.Text} Generated cell text.
 */

/**
 * @class Create a responsive table from rows of text or numeric cell content.
 * @pseudo
 * @name Table
 * @augments JXG.Composition
 * @constructor
 * @type JXG.Composition
 * @param {Array|Number} parents Either `[rows]` (legacy, anchored at the board center) or `[x, y, rows]`.
 * @example
 * var table = board.create('table', [[['Time', 'Speed'], [0, 0], [1, 9.8]]], {
 *     padding: 0.2,
 *     useKatex: true
 * });
 * @example
 * var anchored = board.create('table', [0, 0, [[['Time', 'Speed'], [0, 0]]]], {
 *     padding: 0.2
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

function createTable(board, parents, attributes) {
    const { region, rows: rawRows } = readTableParents(board, parents);
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
        anchor: readCellAnchor(attributes),
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
        strokeColor: visual.strokeColor,
        strokeOpacity: visual.strokeOpacity,
        strokeWidth: visual.strokeWidth
    });
    const verticalLines = geometry.columnBoundaries.map((x) =>
        gridSegment(board, [x, geometry.top], [x, geometry.bottom], lineAttributes)
    );
    const horizontalLines = geometry.rowBoundaries.map((y) =>
        gridSegment(board, [geometry.left, y], [rightBoundary, y], lineAttributes)
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
/**
 * 兼容两种 parents 形状：[rows] 沿用板面区域中心（随包围盒变化），[x, y, rows] 落在用户坐标点上。
 */
function readTableParents(board, parents) {
    if (parents.length === 1 && Array.isArray(parents[0])) {
        return { region: createBoardRegion(board, 0), rows: parents[0] };
    }
    if (parents.length !== 3 || !Array.isArray(parents[2])) {
        throw new Error(
            "JSXGraph: table parents must be [rows] or [x, y, rows]. Example: board.create('table', [[['A', 'B']]]) or board.create('table', [0, 0, [[['A', 'B']]]])."
        );
    }
    return { region: createPointRegion(parents[0], parents[1]), rows: parents[2] };
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
