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

describe("TypeScript runtime contracts", () => {
    const containerId = "jxg-contract-box";
    let board: JXG.Board | undefined;
    let container: HTMLDivElement | undefined;

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

    it("creates mixed-case 3D elements with the declared public shape", () => {
        const currentBoard = JXG.JSXGraph.initBoard(containerId, {
            renderer: "svg",
            axis: false,
            grid: false,
            boundingbox: [-8, 8, 8, -8],
            resize: { enabled: false },
            showCopyright: false,
            showNavigation: false
        });
        board = currentBoard;
        const view = currentBoard.create("view3d", [
            [-6, -3],
            [8, 8],
            [
                [-5, 5],
                [-5, 5],
                [-5, 5]
            ]
        ]);
        const field = view.create("vectorfield3D", [
            [(x) => x, (_x, y) => y, (_x, _y, z) => z],
            [-2, 3, 2],
            [-2, 3, 2],
            [-2, 3, 2]
        ]);

        expect(field.view).toBe(view);
        expect(typeof field.setF).toBe("function");
    });

    it("creates a typed step flow, number line, table, and matrix", () => {
        const currentBoard = JXG.JSXGraph.initBoard(containerId, {
            renderer: "no",
            axis: false,
            boundingbox: [-8, 5, 8, -5],
            resize: { enabled: false },
            showCopyright: false,
            showNavigation: false
        });
        board = currentBoard;
        const flow = currentBoard.create("stepflowlayout", [{ steps: ["observe", "explain"] }]);
        const numberLine = currentBoard.create("localnumberline", [
            [-5, 0],
            [5, 0]
        ]);
        const table = currentBoard.create("table", [[["x", "y"]]]);
        const matrix = currentBoard.create("matrix", [
            [
                [1, 0],
                [0, 1]
            ]
        ]);

        expect(flow.body.step("observe").point(["center", "center"]).length).toBe(2);
        expect(numberLine.point(1).length).toBe(2);
        expect(table.cell(0, 0)).toBeDefined();
        expect(matrix.entry(1, 1)).toBeDefined();
    });

    it("removes every typed composition member from its board", () => {
        const currentBoard = JXG.JSXGraph.initBoard(containerId, {
            renderer: "no",
            axis: false,
            boundingbox: [-5, 5, 5, -5],
            resize: { enabled: false },
            showCopyright: false,
            showNavigation: false
        });
        board = currentBoard;
        const point = currentBoard.create("point", [0, 0]);
        const text = currentBoard.create("text", [1, 1, "note"]);
        const composition = new JXG.Composition({ point, text });

        currentBoard.removeObject(composition);

        expect(currentBoard.objects[point.id]).toBeUndefined();
        expect(currentBoard.objects[text.id]).toBeUndefined();
    });
});
