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

describe("Teaching layout runtime contracts", () => {
    const containerId = "jxg-teaching-layout-box";
    let board: JXG.Board | undefined;
    let container: HTMLDivElement | undefined;

    const createBoard = () => {
        board = JXG.JSXGraph.initBoard(containerId, {
            renderer: "no",
            axis: false,
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

    it("projects default main layout regions from the live board bounds", () => {
        const currentBoard = createBoard();
        const layout = currentBoard.create("mainlayout");
        const initialCenter = layout.body.point(["center", "center"]);

        expect(initialCenter[0]()).toBeCloseTo(0, 10);
        currentBoard.setBoundingBox([-20, 12, 20, -12]);
        expect(layout.header.point(["right", "top"])[0]()).toBeCloseTo(19.7, 10);
        expect(layout.footer.point(["left", "bottom"])[1]()).toBeCloseTo(-11.7, 10);
    });

    it("preserves semantic section order and rejects an unknown section", () => {
        const currentBoard = createBoard();
        const sections: Record<string, number> = { demonstration: 0.7, conclusion: 0.3 };
        const layout = currentBoard.create("mainlayout", [{ sections }]);

        expect(layout.body.sectionNames).toEqual(["demonstration", "conclusion"]);
        expect(
            layout.body.section("demonstration").point(["center", "top"])[1]()
        ).toBeGreaterThan(layout.body.section("conclusion").point(["center", "top"])[1]());
        expect(() => layout.body.section("missing")).toThrowError(
            /Available sections: "demonstration", "conclusion"/
        );
    });

    it("keeps main and aside regions separate with independent semantic sections", () => {
        const currentBoard = createBoard();
        const layout = currentBoard.create("mainasidelayout", [
            {
                sections: {
                    leftMain: { observation: 0.6, explanation: 0.4 },
                    rightAside: { evidence: 0.5, conclusion: 0.5 }
                }
            }
        ]);

        const mainRight = layout.body.leftMain.point(["right", "center"])[0]();
        const asideLeft = layout.body.rightAside.point(["left", "center"])[0]();

        expect(mainRight).toBeLessThan(asideLeft);
        expect(layout.body.leftMain.sectionNames).toEqual(["observation", "explanation"]);
        expect(layout.body.rightAside.sectionNames).toEqual(["evidence", "conclusion"]);
    });

    it("addresses comparison panels and reports the complete panel vocabulary", () => {
        const currentBoard = createBoard();
        const definition: JXG.ComparisonLayoutDefinition = {
            panels: ["before", "during", "after"],
            sections: { model: 0.75, note: 0.25 }
        };
        const layout = currentBoard.create("comparisonlayout", [definition]);

        expect(layout.panelNames).toEqual(["before", "during", "after"]);
        expect(layout.body.panel("before").point(["right", "center"])[0]()).toBeLessThan(
            layout.body.panel("after").point(["left", "center"])[0]()
        );
        expect(() => layout.body.panel("missing")).toThrowError(
            /Available panels: "before", "during", "after"/
        );
    });

    it("connects ordered flow steps and rejects unknown step names", () => {
        const currentBoard = createBoard();
        const definition: JXG.StepFlowLayoutDefinition = {
            steps: ["observe", "predict", "explain"]
        };
        const layout = currentBoard.create("stepflowlayout", [definition]);
        const [from, to] = layout.body.between("observe", "predict");

        expect(from[0]()).toBeLessThan(to[0]());
        expect(from[1]()).toBeCloseTo(to[1](), 10);
        expect(() => layout.body.step("missing")).toThrowError(
            /Available steps: "observe", "predict", "explain"/
        );
    });

    it("rejects layout dimensions that cannot produce a valid frame", () => {
        const currentBoard = createBoard();

        expect(() => currentBoard.create("mainlayout", [], { padding: -1 })).toThrowError(
            /attribute "padding" must be a non-negative finite number/
        );
        expect(() =>
            currentBoard.create("mainasidelayout", [], { asideRatio: 0.5 })
        ).toThrowError(/attribute "asideRatio" must be greater than 0 and less than 0.5/);
    });
});
