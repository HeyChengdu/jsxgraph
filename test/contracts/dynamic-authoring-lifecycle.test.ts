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

describe("Dynamic authoring lifecycle contracts", () => {
    const containerId = "jxg-dynamic-authoring-lifecycle-box";
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

    it("reprojects a step flow layout after repeated board bound changes", () => {
        const currentBoard = createBoard();
        const flow = currentBoard.create("stepflowlayout", [{ steps: ["observe", "explain"] }]);
        const objectCount = Object.keys(currentBoard.objects).length;

        for (let iteration = 1; iteration <= 100; iteration += 1) {
            const halfWidth = 10 + iteration / 10;
            const halfHeight = 8 + iteration / 20;
            currentBoard.setBoundingBox([-halfWidth, halfHeight, halfWidth, -halfHeight]);

            expect(flow.body.step("observe").point(["center", "center"])[0]()).toBeLessThan(
                flow.body.step("explain").point(["center", "center"])[0]()
            );
        }

        expect(Object.keys(currentBoard.objects).length).toBe(objectCount);
    });

    it("preserves dynamic presentation identity and resource counts across frequent updates", () => {
        const currentBoard = createBoard();
        let value = "0";
        let progress = 0;
        const table = currentBoard.create("table", [[["value", () => value]]]);
        const matrix = currentBoard.create("matrix", [[[() => value]]]);
        const text = currentBoard.create("text", [0, -6, () => `frame ${value}`], {
            typewriter: () => progress
        });
        const tableCell = table.cell(0, 1);
        const matrixEntry = matrix.entry(0, 0);
        const objectCount = Object.keys(currentBoard.objects).length;
        const domCount = container?.querySelectorAll("*").length;

        for (let frame = 1; frame <= 500; frame += 1) {
            value = `${frame}-${"x".repeat(frame % 40)}`;
            progress = (frame % 101) / 100;
            currentBoard.update();

            expect(table.cell(0, 1)).toBe(tableCell);
            expect(matrix.entry(0, 0)).toBe(matrixEntry);
        }

        progress = 1;
        currentBoard.update();
        expect(tableCell.plaintext).toBe(value);
        expect(matrixEntry.plaintext).toBe(value);
        expect(text.plaintext).toBe(`frame ${value}`);
        expect(Object.keys(currentBoard.objects).length).toBe(objectCount);
        expect(container?.querySelectorAll("*").length).toBe(domCount);
    });

    it("surfaces an invalid dynamic value and resumes updates after the value is corrected", () => {
        const currentBoard = createBoard();
        let progress = 0.5;
        const text = currentBoard.create("text", [0, 0, "recoverable"], {
            typewriter: () => progress
        });
        const objectCount = Object.keys(currentBoard.objects).length;

        progress = Number.NaN;
        expect(() => currentBoard.update()).toThrowError(
            /text typewriter progress must be a finite number between 0 and 1/
        );
        expect(Object.keys(currentBoard.objects).length).toBe(objectCount);

        progress = 1;
        expect(() => currentBoard.update()).not.toThrow();
        expect(text.plaintext).toBe("recoverable");
    });

    it("cleans one segment before constructing the next segment on the same board", () => {
        const currentBoard = createBoard();
        const baselineObjects = Object.keys(currentBoard.objects).length;
        const baselineDom = container?.querySelectorAll("*").length;

        for (let segment = 0; segment < 30; segment += 1) {
            const numberLine = currentBoard.create("localnumberline", [
                [-5, 0],
                [5, 0]
            ]);
            const point = currentBoard.create("point", numberLine.point(segment % 4));
            const table = currentBoard.create("table", [[["segment", segment]]]);
            const narration = currentBoard.create("text", [0, -7, `segment ${segment}`]);
            const scene = new JXG.Composition({ numberLine, point, table, narration });

            currentBoard.update();
            currentBoard.removeObject(scene);

            expect(Object.keys(currentBoard.objects).length).toBe(baselineObjects);
            expect(container?.querySelectorAll("*").length).toBe(baselineDom);
        }
    });
});
