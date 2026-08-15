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

describe("Composition lifecycle runtime contracts", () => {
    const containerId = "jxg-composition-lifecycle-box";
    let board: JXG.Board | undefined;
    let container: HTMLDivElement | undefined;

    const createBoard = () => {
        board = JXG.JSXGraph.initBoard(containerId, {
            renderer: "svg",
            axis: false,
            grid: false,
            boundingbox: [-5, 5, 5, -5],
            resize: { enabled: false },
            showCopyright: false,
            showNavigation: false
        });
        return board;
    };

    beforeEach(() => {
        container = document.createElement("div");
        container.id = containerId;
        container.style.width = "320px";
        container.style.height = "240px";
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

    it("removes all members of a nested composition from the board", () => {
        const currentBoard = createBoard();
        const first = currentBoard.create("point", [0, 0]);
        const second = currentBoard.create("point", [1, 1]);
        const note = currentBoard.create("text", [2, 2, "evidence"]);
        const nested = new JXG.Composition({ second, note });
        const root = new JXG.Composition({ first, nested });

        currentBoard.removeObject(root);

        expect(currentBoard.objects[first.id]).toBeUndefined();
        expect(currentBoard.objects[second.id]).toBeUndefined();
        expect(currentBoard.objects[note.id]).toBeUndefined();
    });

    it("removes the same composition repeatedly without affecting unrelated elements", () => {
        const currentBoard = createBoard();
        const member = currentBoard.create("point", [0, 0]);
        const survivor = currentBoard.create("point", [3, 3]);
        const composition = new JXG.Composition({ member });

        currentBoard.removeObject(composition);
        currentBoard.removeObject(composition);

        expect(currentBoard.objects[member.id]).toBeUndefined();
        expect(currentBoard.objects[survivor.id]).toBe(survivor);
    });

    it("keeps composition indexes consistent when a named member is removed", () => {
        const currentBoard = createBoard();
        const point = currentBoard.create("point", [0, 0], { name: "origin" });
        const composition = new JXG.Composition({ anchor: point });

        expect(composition.remove("anchor")).toBeTrue();
        expect(composition.objectsList).toEqual([]);
        expect(composition.elementsByName.origin).toBeUndefined();
        expect(currentBoard.objects[point.id]).toBe(point);
    });

    it("frees a board and recreates a clean board in the same container", () => {
        const firstBoard = createBoard();
        const oldPoint = firstBoard.create("point", [1, 2]);

        JXG.JSXGraph.freeBoard(firstBoard);
        board = undefined;
        const secondBoard = createBoard();
        const newPoint = secondBoard.create("point", [3, 4]);

        expect(secondBoard.objects[oldPoint.id]).not.toBe(oldPoint);
        expect(secondBoard.objects[newPoint.id]).toBe(newPoint);
        expect(newPoint.X()).toBe(3);
        expect(newPoint.Y()).toBe(4);
    });
});
