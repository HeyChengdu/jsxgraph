/*
    Copyright 2008-2026
    SPDX-License-Identifier: LGPL-3.0-or-later OR MIT
 */

describe("Adaptive color themes", function () {
    var board, container;

    beforeEach(function () {
        container = document.createElement("div");
        container.id = "theme-box";
        container.style.width = "100px";
        container.style.height = "100px";
        document.body.appendChild(container);
        board = JXG.JSXGraph.initBoard("theme-box", {
            renderer: "no",
            theme: "light",
            resize: { enabled: false },
            showCopyright: false,
            showNavigation: false
        });
    });

    afterEach(function () {
        JXG.JSXGraph.freeBoard(board);
        container.remove();
    });

    it("resolves Tailwind tokens through the active theme", function () {
        var point = board.create("point", [0, 0], { strokeColor: "blue-400" }),
            lightColor = point.evalVisProp("strokeColor");

        board.setTheme("dark");

        expect(point.visProp.strokecolor).toEqual("blue-400");
        expect(point.evalVisProp("strokeColor")).not.toEqual(lightColor);
    });

    it("keeps explicit CSS colors unchanged", function () {
        var point = board.create("point", [0, 0], { strokeColor: "#123456" });

        board.setTheme("dark");

        expect(point.evalVisProp("strokeColor")).toEqual("#123456");
    });

    it("rejects runtime switching for legacy themes", function () {
        JXG.JSXGraph.freeBoard(board);
        board = JXG.JSXGraph.initBoard("theme-box", {
            renderer: "no",
            resize: { enabled: false },
            showCopyright: false,
            showNavigation: false
        });

        expect(function () {
            board.setTheme("dark");
        }).toThrowError();
    });
});
