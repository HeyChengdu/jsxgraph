/* Regression coverage for View3D ownership and projection. */
describe('View3D 清理与并列投影', function () {
    var board, view;
    beforeEach(function () {
        document.body.innerHTML = '<div id="lifecycle" style="width:800px;height:600px"></div>';
        board = JXG.JSXGraph.initBoard('lifecycle', {
            renderer: 'svg', boundingbox: [-5, 3.5, 5, -3.5],
            showCopyright: false, showNavigation: false
        });
        view = board.create('view3d', [[-3.5, -3.1], [7, 7], [[-4, 4], [-4, 4], [-4, 4]]], {
            projection: 'parallel', axesPosition: 'none',
            az: {slider: {start: Math.PI}}, el: {slider: {start: 0.4}}
        });
    });
    afterEach(function () { JXG.JSXGraph.freeBoard(board); });
    it('删除三维点时不把已注销投影重新加入深度排序', function () {
        var point = view.create('point3d', [0, 0, 0], {visible: true});
        var projection = point.element2D;
        var original = board.renderer.setLayer;
        spyOn(board.renderer, 'setLayer').and.callFake(function (element, layer) {
            expect(board.objects[element.id]).toBe(element);
            return original.call(this, element, layer);
        });
        expect(function () { view.removeObject(point); }).not.toThrow();
        board.update();
        expect(board.objects[projection.id]).toBeUndefined();
        expect(projection.rendNode.parentNode).toBeNull();
    });
    it('SVG 图层挂载脱离节点时不用原子移动，已挂载节点继续使用原子移动', function () {
        var point = board.create('point', [0, 0]);
        var node = point.rendNode;
        var layer = board.renderer.layer[point.evalVisProp('layer')];
        var atomicMove = jasmine.createSpy('moveBefore').and.callFake(function (child, before) {
            if (!child.parentNode || child.isConnected !== layer.isConnected) {
                throw new DOMException('无效原子移动', 'HierarchyRequestError');
            }
            layer.insertBefore(child, before);
        });
        layer.moveBefore = atomicMove;
        node.parentNode.removeChild(node);
        board.renderer.setLayer(point, point.evalVisProp('layer'));
        expect(node.parentNode).toBe(layer);
        expect(atomicMove).not.toHaveBeenCalled();
        board.renderer.setLayer(point, point.evalVisProp('layer'));
        expect(atomicMove).toHaveBeenCalledTimes(1);
    });
    it('重复删除多面体后不残留 SVG，也不误删后创建的球体', function () {
        for (var round = 0; round < 3; round++) {
            var vertices = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
            var faces = [[0,1,2,3],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]];
            var first = view.create('polyhedron3d', [vertices, faces], {visible: true});
            var second = view.create('polyhedron3d', [vertices, faces], {visible: true});
            var projections = first.faces.concat(second.faces).map(function (face) {return face.element2D;});
            var survivor = view.create('sphere3d', [[2,0,0], 1], {visible: true});
            view.removeObject([first, second]);
            board.update();
            projections.forEach(function (projection) {
                expect(board.objects[projection.id]).toBeUndefined();
                expect(document.getElementById(projection.rendNode.id)).toBeNull();
            });
            expect(board.objects[survivor.id]).toBe(survivor);
            board.objectsList.forEach(function (element, index) {
                expect(element._pos).toBe(index);
                expect(board.objects[element.id]).toBe(element);
            });
            view.removeObject(survivor);
        }
    });
    it('沿 X 轴摆放的对象在正向相机中水平分离并保持同高', function () {
        board.update();
        var left = view.project3DTo2D(-2,0,0), right = view.project3DTo2D(2,0,0);
        expect(right[1] - left[1]).toBeGreaterThan(3);
        expect(left[2]).toBeCloseTo(right[2], 8);
    });
    it('球体与辅助圆共享隐藏中心，揭示后没有默认中心标签', function () {
        var center = view.create('point3d', [-2,0,0], {withLabel:false,visible:false,fixed:true});
        var sphere = view.create('sphere3d', [center,1.2], {withLabel:false,visible:false});
        var ring = view.create('circle3d', [center,[0,0,1],1.2], {withLabel:false,visible:false});
        sphere.setAttribute({visible:true}); ring.setAttribute({visible:true}); board.update();
        expect(center.visPropCalc.visible).toBe(false);
        expect(center.hasLabel).toBe(false);
        view.removeObject(sphere);
        expect(view.objects[center.id]).toBe(center);
        expect(view.objects[ring.id]).toBe(ring);
        view.removeObject(ring);
        view.removeObject(center);
    });
});
