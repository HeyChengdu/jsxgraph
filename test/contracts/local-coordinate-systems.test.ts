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

describe("Local coordinate system runtime contracts", () => {
    const containerId = "jxg-local-coordinate-box";
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

    it("projects local number line values across a layout region", () => {
        const currentBoard = createBoard();
        const layout = currentBoard.create("mainlayout");
        const numberLine = currentBoard.create("localnumberline", [layout.body], {
            range: [-2, 8]
        });

        expect(numberLine.point(-2)[0]()).toBeLessThan(numberLine.point(8)[0]());
        expect(numberLine.point(3)[0]()).toBeCloseTo(
            (numberLine.point(-2)[0]() + numberLine.point(8)[0]()) / 2,
            10
        );
    });

    it("responds to dynamic Cartesian coordinates without rebuilding the plane", () => {
        const currentBoard = createBoard();
        const layout = currentBoard.create("mainlayout");
        const plane = currentBoard.create("localcartesianplane", [layout.body], {
            xRange: [-5, 5],
            yRange: [-5, 5]
        });
        let x = 1;
        const point = plane.point([() => x, 2]);
        const before = point[0]();

        x = 4;

        expect(point[0]()).toBeGreaterThan(before);
        expect(point[1]()).toBeCloseTo(plane.point([0, 2])[1](), 10);
    });

    it("creates deterministic polar circles and rays", () => {
        const currentBoard = createBoard();
        const layout = currentBoard.create("mainlayout");
        const polar = currentBoard.create("localpolarplane", [layout.body], {
            radiusRange: [0, 4],
            radiusStep: 2,
            angleStep: 90
        });

        expect(polar.subs.circles.length).toBe(2);
        expect(polar.subs.rays.length).toBe(4);
        expect(polar.point([4, 0])[0]()).toBeGreaterThan(polar.point([0, 0])[0]());
    });

    it("removes every child created by a Cartesian plane composition", () => {
        const currentBoard = createBoard("svg");
        const layout = currentBoard.create("mainlayout");
        const plane = currentBoard.create("localcartesianplane", [layout.body]);
        const childIds = plane.objectsList.flatMap((object) =>
            "id" in object ? [object.id] : []
        );

        currentBoard.removeObject(plane);

        expect(childIds.length).toBe(4);
        for (const id of childIds) {
            expect(currentBoard.objects[id]).toBeUndefined();
        }
    });

    it("reports invalid ranges and non-progressing polar steps before creating children", () => {
        const currentBoard = createBoard();
        const layout = currentBoard.create("mainlayout");

        expect(() =>
            currentBoard.create("localcartesianplane", [layout.body], {
                xRange: [Number.NaN, 5]
            })
        ).toThrowError(/attribute "xRange" must be \[minimum, maximum\]/);
        expect(() =>
            currentBoard.create("localpolarplane", [layout.body], { radiusStep: 0 })
        ).toThrowError(/attribute "radiusStep" must be a positive finite number/);
        expect(() =>
            currentBoard.create("localpolarplane", [layout.body], { angleStep: 0 })
        ).toThrowError(/attribute "angleStep" must be a positive finite number/);
    });
});
