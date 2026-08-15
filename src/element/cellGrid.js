export function readCellGridVisualAttributes(elementType, attributes) {
    return {
        fillColor: readEvaluatableAttribute(
            elementType,
            attributes,
            "fillColor",
            isString,
            "string"
        ),
        fillOpacity: readEvaluatableAttribute(
            elementType,
            attributes,
            "fillOpacity",
            isNumber,
            "finite number"
        ),
        fixed:
            readEvaluatableAttribute(elementType, attributes, "fixed", isBoolean, "boolean") ??
            true,
        fontSize: readAttribute(elementType, attributes, "fontSize", isNumber, "finite number"),
        highlight:
            readAttribute(elementType, attributes, "highlight", isBoolean, "boolean") ?? false,
        layer: readAttribute(elementType, attributes, "layer", isNumber, "finite number"),
        strokeColor: readEvaluatableAttribute(
            elementType,
            attributes,
            "strokeColor",
            isString,
            "string"
        ),
        strokeOpacity: readEvaluatableAttribute(
            elementType,
            attributes,
            "strokeOpacity",
            isNumber,
            "finite number"
        ),
        strokeWidth: readEvaluatableAttribute(
            elementType,
            attributes,
            "strokeWidth",
            isNumberOrString,
            "finite number or string"
        ),
        useKatex: readAttribute(elementType, attributes, "useKatex", isBoolean, "boolean"),
        visible:
            readEvaluatableAttribute(
                elementType,
                attributes,
                "visible",
                isBooleanOrInherit,
                'boolean or "inherit"'
            ) ?? true
    };
}
export function omitUndefined(attributes) {
    return Object.fromEntries(
        Object.entries(attributes).filter(([, value]) => value !== undefined)
    );
}
function readAttribute(elementType, attributes, key, validate, expected) {
    const value = attributes[key];
    if (value === undefined) return undefined;
    if (validate(value)) return value;
    throw invalidAttribute(elementType, key, expected, value);
}
function readEvaluatableAttribute(elementType, attributes, key, validate, expected) {
    const value = attributes[key];
    if (value === undefined) return undefined;
    if (validate(value)) return value;
    if (typeof value !== "function") {
        throw invalidAttribute(elementType, key, expected, value);
    }
    return (element) => {
        const evaluated = Reflect.apply(value, undefined, [element]);
        if (validate(evaluated)) return evaluated;
        throw invalidAttribute(elementType, key, expected, evaluated);
    };
}
function invalidAttribute(elementType, key, expected, value) {
    return new TypeError(
        `JSXGraph: ${elementType} attribute "${key}" must be ${expected}, received ${String(value)}.`
    );
}
function isBoolean(value) {
    return typeof value === "boolean";
}
function isBooleanOrInherit(value) {
    return isBoolean(value) || value === "inherit";
}
function isNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
function isNumberOrString(value) {
    return isNumber(value) || isString(value);
}
function isString(value) {
    return typeof value === "string";
}
export function validateCellRows(elementType, rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error(`JSXGraph: ${elementType} requires a non-empty 2D array.`);
    }
    if (!rows.every(isCellRow) || rows[0].length === 0) {
        throw new Error(
            `JSXGraph: ${elementType} cells must be strings, numbers, or functions returning them.`
        );
    }
    const columnCount = rows[0].length;
    if (rows.some((row) => !Array.isArray(row) || row.length !== columnCount)) {
        throw new Error(
            `JSXGraph: ${elementType} requires every row to have ${columnCount} cells.`
        );
    }
    return rows;
}
function isCellRow(value) {
    return Array.isArray(value) && value.every(isCellContent);
}
function isCellContent(value) {
    return (
        typeof value === "string" || typeof value === "number" || typeof value === "function"
    );
}
export function normalizeCellContent(content) {
    return typeof content === "function" ? () => String(content()) : String(content);
}
export function createCellGridGeometry(region, cells, options) {
    const regionCenter = region.point(["center", "center"]);
    const columnCount = cells[0].length;
    const measuredColumnWidths = () =>
        Array.from({ length: columnCount }, (_, column) =>
            Math.max(...cells.map((row) => textSize(row[column])[0]))
        );
    const columnWidths = () => {
        const widths = measuredColumnWidths();
        if (!options.uniformColumns) return widths;
        const width = Math.max(...widths);
        return widths.map(() => width);
    };
    const measuredRowHeights = () =>
        cells.map((row) => Math.max(...row.map((cell) => textSize(cell)[1])));
    const rowHeights = () => {
        const heights = measuredRowHeights();
        if (!options.uniformRows) return heights;
        const height = Math.max(...heights);
        return heights.map(() => height);
    };
    const totalWidth = () =>
        columnWidths().reduce((sum, width) => sum + width, 0) +
        options.padding * 2 * columnCount +
        options.columnGap * Math.max(0, columnCount - 1);
    const totalHeight = () =>
        rowHeights().reduce((sum, height) => sum + height, 0) +
        options.padding * 2 * cells.length +
        options.rowGap * Math.max(0, cells.length - 1);
    const left = () => regionCenter[0]() - totalWidth() / 2;
    const top = () => regionCenter[1]() + totalHeight() / 2;
    const columnBoundaries = Array.from({ length: columnCount + 1 }, (_, boundary) => () => {
        const widths = columnWidths();
        return (
            left() +
            widths.slice(0, boundary).reduce((sum, width) => sum + width, 0) +
            options.padding * 2 * boundary +
            options.columnGap * Math.max(0, boundary - 1)
        );
    });
    const rowBoundaries = Array.from({ length: cells.length + 1 }, (_, boundary) => () => {
        const heights = rowHeights();
        return (
            top() -
            heights.slice(0, boundary).reduce((sum, height) => sum + height, 0) -
            options.padding * 2 * boundary -
            options.rowGap * Math.max(0, boundary - 1)
        );
    });
    return {
        left,
        top,
        bottom: rowBoundaries[rowBoundaries.length - 1],
        columnBoundaries,
        rowBoundaries,
        cellCenter: (row, column) => [
            () => {
                const widths = columnWidths();
                return (
                    left() +
                    widths.slice(0, column).reduce((sum, width) => sum + width, 0) +
                    (options.padding * 2 + options.columnGap) * column +
                    widths[column] / 2 +
                    options.padding
                );
            },
            () => {
                const heights = rowHeights();
                return (
                    top() -
                    heights.slice(0, row).reduce((sum, height) => sum + height, 0) -
                    (options.padding * 2 + options.rowGap) * row -
                    heights[row] / 2 -
                    options.padding
                );
            }
        ]
    };
}
function textSize(text) {
    const [left, top, right, bottom] = text.bounds();
    const width = right - left;
    const height = top - bottom;
    return [
        Number.isFinite(width) ? Math.max(0, width) : 0,
        Number.isFinite(height) ? Math.max(0, height) : 0
    ];
}
