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
        const layout = currentBoard.create("mainlayout");
        const table = currentBoard.create("table", [
            layout.body,
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

    it("updates dynamic matrix entries while preserving entry identity", () => {
        const currentBoard = createBoard();
        const layout = currentBoard.create("mainlayout");
        let value = 2;
        const matrix = currentBoard.create("matrix", [
            layout.body,
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
        const layout = currentBoard.create("mainlayout");
        const table = currentBoard.create("table", [layout.body, [["A", "B"]]]);
        const childIds = table.objectsList.flatMap((object) =>
            "id" in object ? [object.id] : []
        );

        currentBoard.removeObject(table);

        for (const id of childIds) {
            expect(currentBoard.objects[id]).toBeUndefined();
        }
    });

    it("rejects empty and non-rectangular cell collections with element-specific errors", () => {
        const currentBoard = createBoard();
        const layout = currentBoard.create("mainlayout");

        expect(() => currentBoard.create("table", [layout.body, []])).toThrowError(
            "JSXGraph: table requires a non-empty 2D array."
        );
        expect(() => currentBoard.create("matrix", [layout.body, [[1, 2], [3]]])).toThrowError(
            "JSXGraph: matrix requires every row to have 2 cells."
        );
    });

    it("reveals Unicode text by code point and validates the stable anchor contract", () => {
        const currentBoard = createBoard();
        let progress = 0.6;
        const text = currentBoard.create("text", [0, 0, "速度🚀变化"], {
            typewriter: () => progress
        });

        expect(text.plaintext).toBe("速度🚀");
        progress = 1;
        currentBoard.update();
        expect(text.plaintext).toBe("速度🚀变化");
        expect(() =>
            currentBoard.create("text", [0, 0, "invalid"], {
                anchorX: "middle",
                typewriter: 0.5
            })
        ).toThrowError(/typewriter requires anchorX: 'left'/);
    });
});
