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

describe("Test native layout elements", function () {
    var board;

    document.getElementsByTagName("body")[0].innerHTML =
        '<div id="jxgbox" style="width: 640px; height: 360px;"></div>';
    board = JXG.JSXGraph.initBoard("jxgbox", {
        renderer: "no",
        axis: false,
        boundingbox: [-8, 5, 8, -5],
        resize: { enabled: false },
        showCopyright: false,
        showNavigation: false
    });

    it("creates semantic layouts without explicit registration", function () {
        var main = board.create("mainlayout", [
                { sections: { demonstration: 0.7, conclusion: 0.3 } }
            ]),
            aside = board.create("mainasidelayout"),
            comparison = board.create("comparisonlayout", [{ panels: ["before", "after"] }]),
            flow = board.create("stepflowlayout", [{ steps: ["observe", "explain"] }]);

        expect(main.body.section("demonstration").point(["center", "center"]).length).toBe(2);
        expect(aside.body.leftMain.point(["center", "center"]).length).toBe(2);
        expect(comparison.body.panel("before").point(["center", "center"]).length).toBe(2);
        expect(flow.body.step("observe").point(["center", "center"]).length).toBe(2);
    });

    it("creates local coordinate systems, tables and matrices", function () {
        var layout = board.create("mainlayout"),
            numberLine = board.create("localnumberline", [layout.body]),
            plane = board.create("localcartesianplane", [layout.body]),
            polar = board.create("localpolarplane", [layout.body]),
            table = board.create("table", [layout.body, [["x", "y"]]]),
            matrix = board.create("matrix", [
                layout.body,
                [
                    [1, 0],
                    [0, 1]
                ]
            ]);

        expect(numberLine.point(1).length).toBe(2);
        expect(plane.point([1, 2]).length).toBe(2);
        expect(polar.point([1, Math.PI / 2]).length).toBe(2);
        expect(table.cell(0, 0)).toBeDefined();
        expect(matrix.entry(1, 1)).toBeDefined();
    });
});
