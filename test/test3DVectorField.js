/*
    Copyright 2008-2026
        Matthias Ehmann,
        Carsten Miller,
        Andreas Walter,
        Alfred Wassermann

    This file is part of JSXGraph.

    JSXGraph is free software dual licensed under the GNU LGPL or MIT License.
*/
describe("Test 3D vector fields", function () {
    var board,
        view;

    document.getElementsByTagName("body")[0].innerHTML =
        '<div id="jxgbox" style="width: 500px; height: 500px;"></div>';

    board = JXG.JSXGraph.initBoard("jxgbox", {
        renderer: "svg",
        axis: false,
        grid: false,
        boundingbox: [-8, 8, 8, -8],
        showCopyright: false,
        showNavigation: false
    });

    view = board.create("view3d", [
        [-6, -3],
        [8, 8],
        [
            [-5, 5],
            [-5, 5],
            [-5, 5]
        ]
    ]);

    it("injects the view for mixed-case 3D element names", function () {
        var field = view.create("vectorfield3D", [
            [
                function (x) {
                    return x;
                },
                function (_x, y) {
                    return y;
                },
                function (_x, _y, z) {
                    return z;
                }
            ],
            [-2, 3, 2],
            [-2, 3, 2],
            [-2, 3, 2]
        ]);

        expect(field.view).toBe(view);
        expect(typeof field.setF).toBe("function");
    });
});
