/*
    Copyright 2008-2026
        Matthias Ehmann,
        Michael Gerhaeuser,
        Carsten Miller,
        Bianca Valentin,
        Alfred Wassermann,
        Peter Wilfahrt

    This file is part of JSXGraph.

    JSXGraph is free software dual licensed under the GNU LGPL or MIT License.
*/

/// <reference path="../../src/index.d.ts" />

describe("Cell presentation runtime contracts", () => {
    const containerId = "jxg-cell-presentation-box";
    let board: JXG.Board | undefined;
    let container: HTMLDivElement | undefined;

    const collectObjectIds = (object: JXG.GeometryElement | JXG.Composition): string[] =>
        "id" in object ? [object.id] : object.objectsList.flatMap(collectObjectIds);

    const createBoard = () => {
        board = JXG.JSXGraph.initBoard(containerId, {
            renderer: "svg",
            axis: false,
            grid: false,
            boundingbox: [-10, 8, 10, -8],
            resize: { enabled: false },
            showCopyright: false,
            showNavigation: false
        });
        return board;
    };

    beforeEach(() => {
        container = document.createElement("div");
        container.id = containerId;
        container.style.width = "640px";
        container.style.height = "360px";
        document.body.append(container);
    });

    afterEach(() => {
        if (board) {
            JXG.JSXGraph.freeBoard(board);
            board = undefined;
        }
        container?.remove();
        container = undefined;
    });

    it("keeps table cell indexing aligned with the supplied rows", () => {
        const currentBoard = createBoard();
        const table = currentBoard.create("table", [
            0,
            0,
            [
                ["time", "speed"],
                [1, 2]
            ]
        ]);

        expect(table.cells.length).toBe(2);
        expect(table.cell(0, 1)).toBe(table.cells[0][1]);
        expect(table.cell(1, 0).plaintext).toBe("1");
        expect(() => table.cell(2, 0)).toThrowError("table cell (2, 0) does not exist.");
    });

    it("表格网格线在高低质量更新与动态平移后仍完整连接边界", () => {
        const currentBoard = createBoard();
        let x = 0;
        const table = currentBoard.create("table", [
            () => x,
            0,
            [
                ["a", "b"],
                [1, 2]
            ]
        ]);
        const curves = currentBoard.objectsList.filter(
            (element): element is JXG.Curve => "elType" in element && element.elType === "curve"
        );
        expect(curves.length).toBe(6);
        for (const quality of [
            currentBoard.BOARD_QUALITY_HIGH,
            currentBoard.BOARD_QUALITY_LOW
        ]) {
            currentBoard.updateQuality = quality;
            x += 2;
            currentBoard.update();
            const corners = table.background.vertices;
            const [left, right] = [corners[0].X(), corners[1].X()];
            const [top, bottom] = [corners[0].Y(), corners[2].Y()];
            expect((left + right) / 2).toBeCloseTo(x, 8);
            curves.forEach((curve, index) => {
                // 两端点精确表达直线，也限定隐藏表格的采样开销。
                expect(curve.numberPoints).toBe(2);
                const start = [1, curve.X(0, true), curve.Y(0, true)];
                const end = [1, curve.X(1, true), curve.Y(1, true)];
                expect(start.every(Number.isFinite)).toBe(true);
                expect(end.every(Number.isFinite)).toBe(true);
                if (index < 3) {
                    expect(start[1]).toBeCloseTo(end[1], 8);
                    expect(start[2]).toBeCloseTo(top, 8);
                    expect(end[2]).toBeCloseTo(bottom, 8);
                } else {
                    expect(start[2]).toBeCloseTo(end[2], 8);
                    expect(start[1]).toBeCloseTo(left, 8);
                    expect(end[1]).toBeCloseTo(right, 8);
                }
            });
        }
    });

    it("hides construction points of generated table and matrix lines", () => {
        const currentBoard = createBoard();
        const table = currentBoard.create("table", [
            0,
            0,
            [
                ["time", "speed"],
                [1, 2]
            ]
        ]);
        const matrix = currentBoard.create("matrix", [
            0,
            0,
            [
                [1, 0],
                [0, 1]
            ]
        ]);

        // 生成线段可以完全不带顶点（函数式 curve），也可以由 line 补出端点；
        // 两种实现都不允许在画面上留下可见的构造点。
        const generated = [...table.lines, ...matrix.brackets];
        expect(generated.length).toBeGreaterThan(0);
        const constructionPoints = generated
            .flatMap((line) => [line.point1, line.point2])
            .filter((point): point is JXG.Point => Boolean(point));
        expect(constructionPoints.filter((point) => point.visProp.visible)).toEqual([]);
        expect(
            currentBoard.objectsList.filter((object) => {
                const element = object as {
                    elType?: string;
                    visPropCalc?: { visible: boolean };
                };
                return element.elType === "point" && element.visPropCalc?.visible === true;
            })
        ).toEqual([]);
    });

    it("updates dynamic matrix entries while preserving entry identity", () => {
        const currentBoard = createBoard();
        let value = 2;
        const matrix = currentBoard.create("matrix", [
            0,
            0,
            [
                [() => value, 0],
                [0, 1]
            ]
        ]);
        const entry = matrix.entry(0, 0);

        value = 7;
        currentBoard.update();

        expect(matrix.entry(0, 0)).toBe(entry);
        expect(entry.plaintext).toBe("7");
        expect(matrix.brackets.length).toBe(6);
    });

    it("removes table cells, grid lines, background, and polygon helpers together", () => {
        const currentBoard = createBoard();
        const table = currentBoard.create("table", [0, 0, [["A", "B"]]]);
        const childIds = table.objectsList.flatMap(collectObjectIds);

        currentBoard.removeObject(table);

        for (const id of childIds) {
            expect(currentBoard.objects[id]).toBeUndefined();
        }
    });

    it("rejects empty and non-rectangular cell collections with element-specific errors", () => {
        const currentBoard = createBoard();
        expect(() => currentBoard.create("table", [0, 0, []])).toThrowError(
            "JSXGraph: table requires a non-empty 2D array."
        );
        expect(() => currentBoard.create("matrix", [0, 0, [[1, 2], [3]]])).toThrowError(
            "JSXGraph: matrix requires every row to have 2 cells."
        );
    });
});
