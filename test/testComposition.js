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

    You can redistribute it and/or modify it under the terms of the

      * GNU Lesser General Public License as published by
        the Free Software Foundation, either version 3 of the License, or
        (at your option) any later version
      OR
      * MIT License: https://github.com/jsxgraph/jsxgraph/blob/master/LICENSE.MIT

    JSXGraph is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License and
    the MIT License along with JSXGraph. If not, see <https://www.gnu.org/licenses/>
    and <https://opensource.org/licenses/MIT/>.
 */

describe("Composition 与 ElementSelection", function () {

    let board, container;
    beforeEach(function () {
        container = document.createElement("div");
        container.id = "composition-contract";

    document.body.appendChild(container);
    board = JXG.JSXGraph.initBoard(container.id, {
        renderer: "svg",
        axis: false,
        grid: false,
        resize: {enabled: false},
        showCopyright: false,
        showNavigation: false
    });


    });
    afterEach(function () {
        JXG.JSXGraph.freeBoard(board);
        container.remove();
    });
    it("创建组合返回注册身份，Board 负责成员更新", function () {

        const unit = board.create("composition");
        const point = unit.create("point", [0, 0]);
        expect(board.select(unit.id)).toBe(unit);
        expect(unit.members).toEqual([point]);
        expect(() => board.fullUpdate()).not.toThrow();
        expect(unit.update).toBeUndefined();
    });
    it("别名不能覆盖 API，显式成员删除同步清理索引", function () {
        const unit = board.create("composition");
        const point = unit.create("point", [0, 0], { name: "origin" });
        expect(unit.add("anchor", point)).toBeTrue();
        expect(() => unit.add("create", point)).toThrow();
        expect(unit.select("anchor")).toBe(point);
        board.removeObject(point);
        expect(unit.anchor).toBeUndefined();
        expect(unit.members).toEqual([]);
        expect(unit.elementsByName.origin).toBeUndefined();
    });
    it("引用集合解绑不删除成员，支持成员呈现", function () {
        const point = board.create("point", [0, 0]);
        const selection = new JXG.ElementSelection({
                 point });
        selection.hide();

        expect(point.visPropCalc.visible).toBeFalse();
        selection.show();
        expect(point.visPropCalc.visible).toBeTrue();
        expect(selection.remove("point")).toBeTrue();
        expect(board.objects[point.id]).toBe(point);
    });
});
