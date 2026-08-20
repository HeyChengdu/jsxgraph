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

describe("Adversarial authoring lifecycle contracts", () => {
    const containerId = "jxg-adversarial-lifecycle-box";
    let board: JXG.Board | undefined;
    let container: HTMLDivElement | undefined;

    const createBoard = (renderer: "no" | "svg" = "no") => {
        board = JXG.JSXGraph.initBoard(containerId, {
            renderer,
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

    it("rejects non-finite local coordinate ranges without mutating the board", () => {
        const currentBoard = createBoard();
        const objectIdsBefore = Object.keys(currentBoard.objects);

        expect(() =>
            currentBoard.create(
                "localnumberline",
                [
                    [-5, 0],
                    [5, 0]
                ],
                {
                    range: [Number.NEGATIVE_INFINITY, 5]
                }
            )
        ).toThrowError(/attribute "range" must be \[minimum, maximum\]/);
        expect(Object.keys(currentBoard.objects)).toEqual(objectIdsBefore);
    });

    it("recursively removes dependent geometry without retaining child objects", () => {
        const currentBoard = createBoard("svg");
        const first = currentBoard.create("point", [0, 0]);
        const second = currentBoard.create("point", [2, 0]);
        const segment = currentBoard.create("segment", [first, second]);
        const composition = new JXG.Composition({ first, second, segment });
        const ids = [first.id, second.id, segment.id];

        currentBoard.removeObject(composition);

        for (const id of ids) {
            expect(currentBoard.objects[id]).toBeUndefined();
        }
    });

    it("does not grow board object or DOM counts across repeated create-remove cycles", () => {
        const currentBoard = createBoard("svg");
        const objectCountBefore = Object.keys(currentBoard.objects).length;
        const domCountBefore = container?.querySelectorAll("*").length;

        for (let iteration = 0; iteration < 50; iteration += 1) {
            const numberLine = currentBoard.create("localnumberline", [
                [-5, 0],
                [5, 0]
            ]);
            const point = currentBoard.create("point", numberLine.point(iteration % 5));
            currentBoard.removeObject(new JXG.Composition({ numberLine, point }));
        }

        expect(Object.keys(currentBoard.objects).length).toBe(objectCountBefore);
        expect(container?.querySelectorAll("*").length).toBe(domCountBefore);
    });
});
