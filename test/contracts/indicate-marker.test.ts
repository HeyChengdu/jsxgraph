/// <reference path="../../src/index.d.ts" />
/**
 * [INPUT]: Public indicate API, native SVG geometry and a controlled Board clock
 * [OUTPUT]: Marker, scale, projection and restoration regression contracts
 * [POS]: Native presentation tests; no mathematical coordinates are animated
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
describe('indicate 原位荧光与空间投影', () => {
    let board: JXG.Board;
    let host: HTMLDivElement;
    let jobs: Set<JXG.AnimationJob>;
    const tick = (p: number) => {
        for (const job of [...jobs]) {
            job.update(p);
            if (p === 1) { job.finish(); jobs.delete(job); }
        }
        board.update();
    };
    beforeEach(() => {
        host = document.createElement('div');
        host.style.cssText = 'width:640px;height:480px';
        document.body.append(host);
        jobs = new Set();
        board = JXG.JSXGraph.initBoard(host, {
            renderer: 'svg', boundingbox: [-5, 5, 5, -5],
            showCopyright: false, showNavigation: false, resize: { enabled: false },
            animationScheduler: {
                schedule(job) {
                    jobs.add(job); job.start();
                    return { cancel() { jobs.delete(job); job.cancel(); } };
                },
                dispose() { for (const job of jobs) job.cancel(); jobs.clear(); }
            }
        });
    });
    afterEach(() => { JXG.JSXGraph.freeBoard(board); host.remove(); });
    it('空间角保持真实角度、投影强调和退化恢复', () => {
        const view = board.create('view3d', [[-4, -4], [8, 8], [[-3, 3], [-3, 3], [-3, 3]]], { axesPosition: 'none' });
        let end = [0, 0, 2];
        const angle = view.create('angle3d', [[2, 0, 0], [0, 0, 0], () => [end[0], end[1], end[2]]], { radius: 0.4 });
        board.update();
        expect(angle.Value()).toBeCloseTo(Math.PI / 2, 10);
        expect(angle.vertices.every(p => Number.isFinite(p.X()))).toBeTrue();
        angle.indicate(1000); tick(0.5);
        expect(host.querySelector('[data-jxg-attention="indicate-marker"]')).not.toBeNull();
        view.setView(1, 0.7); board.update();
        expect(angle.Value()).toBeCloseTo(Math.PI / 2, 10);
        tick(1);
        expect(host.querySelector('[data-jxg-attention]')).toBeNull();
        end = [1, 1, 0]; board.update();
        expect(angle.Value()).toBeCloseTo(Math.PI / 4, 10);
        end = [-1, 1, 0]; board.update();
        expect(angle.Value()).toBeCloseTo(3 * Math.PI / 4, 10);
        end = [0, 0, 0]; board.update();
        expect(Number.isNaN(angle.Value())).toBeTrue();
        end = [0, 0, 2]; board.update();
        expect(angle.vertices.every(p => Number.isFinite(p.X()))).toBeTrue();
    });
    it('倍率一仍填充角域且完整恢复作者样式', () => {
        const angle = board.create('nonreflexangle', [[3, 0], [0, 0], [1, 2]],
            { radius: 0.8, fillOpacity: 0, strokeColor: 'blue-600', withLabel: false });
        const ids = Object.keys(board.objects);
        const value = angle.Value();
        angle.indicate(1000, { scaleFactor: 1 }); tick(0.5);
        expect(angle.rendNode.style.scale).toBe('1');
        expect(host.querySelector('[data-jxg-attention="indicate-marker"]')).not.toBeNull();
        expect(angle.Value()).toBe(value);
        expect(angle.getAttribute('fillOpacity')).toBe(0);
        expect(Object.keys(board.objects)).toEqual(ids);
        tick(1);
        expect(host.querySelector('[data-jxg-attention]')).toBeNull();
        expect(angle.rendNode.style.scale).toBe('');
    });
    it('默认原位强调且显式倍率可放大，无效倍率不替换动画', () => {
        const line = board.create('segment', [[0, 0], [3, 0]], { withLabel: false });
        line.indicate(1000); tick(0.5);
        expect(line.rendNode.style.scale).toBe('1');
        expect(host.querySelector('[data-jxg-attention="indicate-marker"]')).not.toBeNull();
        tick(1);
        line.indicate(1000, {}); tick(0.5);
        expect(line.rendNode.style.scale).toBe('1');
        tick(1);
        line.indicate(1000, { scaleFactor: 1.2 }); tick(0.5);
        expect(line.rendNode.style.scale).toBe('1.2');
        for (const scaleFactor of [0, -1, NaN, Infinity])
            expect(() => line.indicate(1000, { scaleFactor })).toThrow();
        expect(jobs.size).toBe(1);
    });
    it('球的截交圆直接强调圆周且隐藏后清理', () => {
        const view = board.create('view3d', [[-4, -4], [8, 8], [[-3, 3], [-3, 3], [-3, 3]]], { axesPosition: 'none' });
        const sphere = view.create('sphere3d', [[0, 0, 0], 2], { visible: false });
        const plane = view.create('plane3d', [[0, 0, 1], [1, 0, 0], [0, 1, 0], [-2, 2], [-2, 2]], { visible: false });
        const circle = view.create('intersectioncircle3d', [sphere, plane], { strokeColor: 'blue-600' });
        board.update();
        circle.indicate(1000, { scaleFactor: 1 }); tick(0.5);
        expect(host.querySelector('[data-jxg-attention="indicate-marker"]')).not.toBeNull();
        expect(circle.Radius()).toBeCloseTo(Math.sqrt(3), 8);
        circle.setAttribute({ visible: false }); board.update();
        expect(host.querySelector('[data-jxg-attention]')).toBeNull();
        expect(jobs.size).toBe(0);
    });
    it('三维点和线直接调用并保留空间坐标', () => {
        const view = board.create('view3d', [[-4, -4], [8, 8], [[-3, 3], [-3, 3], [-3, 3]]], { axesPosition: 'none' });
        const p = view.create('point3d', [1, 1, 1], { withLabel: false });
        const q = view.create('point3d', [-1, 0, 0], { withLabel: false });
        const line = view.create('line3d', [p, q], { straightFirst: false, straightLast: false });
        const coords = [...p.coords];
        expect(() => p.indicate(1000, { scaleFactor: 1 })).not.toThrow();
        tick(0.5);
        expect(host.querySelector('[data-jxg-attention="indicate-marker"]')).not.toBeNull();
        tick(1);
        expect(() => line.indicate(1000)).not.toThrow(); tick(0.5);
        expect(p.coords).toEqual(coords);
        board.removeObject(line);
        expect(host.querySelector('[data-jxg-attention]')).toBeNull();
    });
    it('事务内先淡入三维点再强调时按已接受的逻辑可见性调度', () => {
        const view = board.create('view3d', [[-4, -4], [8, 8], [[-3, 3], [-3, 3], [-3, 3]]], { axesPosition: 'none' });
        const point = view.create('point3d', [1, 1, 1], {
            withLabel: false,
            visible: false,
        });

        expect(() => board.batch(() => {
            point.fadeIn(400);
            point.indicate(800);
        })).not.toThrow();
        expect(point.getAttribute('visible')).toBeTrue();
        const projection = (point as unknown as { element2D: JXG.Point }).element2D;
        expect(projection.getAttribute('visible')).toBeTrue();
        tick(0.5);
        expect(host.querySelector('[data-jxg-attention="indicate-marker"]')).not.toBeNull();
        tick(1);
        expect(host.querySelector('[data-jxg-attention]')).toBeNull();
    });
    it('事务内未显示的三维点仍拒绝强调且不残留任务', () => {
        const view = board.create('view3d', [[-4, -4], [8, 8], [[-3, 3], [-3, 3], [-3, 3]]], { axesPosition: 'none' });
        const point = view.create('point3d', [1, 1, 1], {
            withLabel: false,
            visible: false,
        });

        expect(() => board.batch(() => point.indicate(800))).toThrowError(
            /attention requires a visible element/
        );
        expect(jobs.size).toBe(0);
        expect(point.getAttribute('visible')).toBeFalse();
    });
    for (const kind of ['angle', 'nonreflexangle', 'reflexangle', 'sector'] as const) {
        it(`${kind} 的荧光沿当前原生路径且隐藏后清理`, () => {
            const target = board.create(kind, [[2, 0], [0, 0], [0, 2]], {
                withLabel: false, fillOpacity: 0, radius: 0.8,
            });
            target.indicate(1000, { scaleFactor: 1 }); tick(0.5);
            const marker = host.querySelector('[data-jxg-attention="indicate-marker"]');
            expect(marker?.getAttribute('d')).toBe(target.rendNode.getAttribute('d'));
            expect(marker?.getAttribute('id')).toBeNull();
            target.setAttribute({ visible: false });
            expect(host.querySelector('[data-jxg-attention]')).toBeNull();
            expect(jobs.size).toBe(0);
        });
    }
    it('动态凹多边形更新同一填充路径，不改变顶点或数学面积', () => {
        const polygon = board.create('polygon', [[-2, -2], [2, -2], [0, 0], [2, 2], [-2, 2]], {
            withLabel: false, fillOpacity: 0, vertices: { visible: false },
        });
        polygon.indicate(1000, { scaleFactor: 1 }); tick(0.5);
        polygon.vertices[2].setPosition(JXG.COORDS_BY_USER, [1, 0]);
        board.update();
        const area = polygon.Area();
        const marker = polygon.rendNode.nextElementSibling;
        expect(marker?.getAttribute('points')).toBe(polygon.rendNode.getAttribute('points'));
        tick(1);
        expect(polygon.Area()).toBe(area);
        expect(host.querySelector('[data-jxg-attention]')).toBeNull();
    });
    it('停止全部动画恢复原样且重新开始不会残留旧荧光', () => {
        const circle = board.create('circle', [[0, 0], 2], { fillOpacity: 0.15 });
        circle.indicate(1000); tick(0.5);
        circle.indicate(1000, { scaleFactor: 1 }); tick(0.5);
        expect(jobs.size).toBe(1);
        expect(host.querySelectorAll('[data-jxg-attention="indicate-marker"]').length).toBe(1);
        board.stopAllAnimation();
        expect(host.querySelector('[data-jxg-attention]')).toBeNull();
        expect(circle.getAttribute('fillOpacity')).toBe(0.15);
        expect(circle.Radius()).toBe(2);
    });
    it('空间多边形和球面支持默认原位强调及隐藏取消', () => {
        const view = board.create('view3d', [[-4, -4], [8, 8], [[-3, 3], [-3, 3], [-3, 3]]], { axesPosition: 'none' });
        const polygon = view.create('polygon3d', [[0, 0, 0], [2, 0, 0], [0, 2, 1]], { fillOpacity: 0.2 });
        const sphere = view.create('sphere3d', [[0, 0, 0], 1], { fillOpacity: 0.2 });
        for (const target of [polygon, sphere]) {
            target.indicate(1000); tick(0.5);
            expect(host.querySelector('[data-jxg-attention="indicate-marker"]')).not.toBeNull();
            target.setAttribute({ visible: false }); board.update();
            expect(host.querySelector('[data-jxg-attention]')).toBeNull();
        }
    });
    it('空间多面体按自身各面强调，不涂满外接框', () => {
        const view = board.create('view3d', [[-4, -4], [8, 8], [[-3, 3], [-3, 3], [-3, 3]]], { axesPosition: 'none' });
        const solid = view.create('polyhedron3d', [
            [[0, 0, 1], [-1, -1, -1], [1, -1, -1], [0, 1, -1]],
            [[0, 1, 2], [0, 2, 3], [0, 3, 1], [1, 3, 2]],
        ], { fillOpacity: 0.2 });
        solid.indicate(1000, { scaleFactor: 1 }); tick(0.5);
        const markers = host.querySelectorAll('[data-jxg-attention="indicate-marker"]');
        expect(markers.length).toBe(4);
        for (const marker of Array.from(markers)) expect(marker.tagName.toLowerCase()).toBe('path');
        solid.setAttribute({ visible: false }); board.update();
        expect(host.querySelector('[data-jxg-attention]')).toBeNull();
    });
});
