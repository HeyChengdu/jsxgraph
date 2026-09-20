/// <reference path="../../src/index.d.ts" />
/**
 * [INPUT]: Native Canvas rendering and a controlled animation scheduler
 * [OUTPUT]: Pixel-level marker and restoration contracts
 * [POS]: Renderer parity regression coverage for teaching emphasis
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
describe('Canvas 原位荧光', () => {
    let board: JXG.Board;
    let host: HTMLDivElement;
    let jobs: Set<JXG.AnimationJob>;
    const advance = (progress: number) => {
        for (const job of Array.from(jobs)) {
            job.update(progress);
            if (progress === 1) { job.finish(); jobs.delete(job); }
        }
        board.update();
    };
    const pixels = () => {
        const canvas = host.querySelector('canvas');
        if (!canvas) throw new Error('缺少 Canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('缺少实际二维渲染上下文');
        return Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data);
    };
    const painted = (values: number[]) => values.filter((value, index) => index % 4 === 3 && value > 0).length;
    beforeEach(() => {
        host = document.createElement('div');
        host.style.cssText = 'width:320px;height:240px';
        document.body.append(host);
        jobs = new Set();
        board = JXG.JSXGraph.initBoard(host, {
            renderer: 'canvas', boundingbox: [-4, 3, 4, -3],
            showCopyright: false, showNavigation: false, resize: { enabled: false },
            animationScheduler: {
                schedule(job) {
                    jobs.add(job); job.start();
                    return { cancel() { jobs.delete(job); job.cancel(); } };
                },
                dispose() { for (const job of jobs) job.cancel(); jobs.clear(); },
            },
        });
    });
    afterEach(() => { JXG.JSXGraph.freeBoard(board); host.remove(); });
    it('空心圆内部出现荧光，结束后逐像素恢复', () => {
        const circle = board.create('circle', [[0, 0], 1.5], { fillOpacity: 0, strokeWidth: 2, withLabel: false });
        board.update();
        const before = pixels();
        circle.indicate(1000, { scaleFactor: 1 }); advance(0.5);
        expect(painted(pixels())).toBeGreaterThan(painted(before) * 2);
        expect(circle.Radius()).toBe(1.5);
        advance(1);
        expect(pixels()).toEqual(before);
    });
    it('完全透明的区域仍能强调，并恢复透明', () => {
        const polygon = board.create('polygon', [[-1, -1], [1, -1], [0, 1]], {
            fillOpacity: 0, withLines: false, withLabel: false,
            vertices: { visible: false },
        });
        board.update();
        const before = pixels();
        polygon.indicate(1000, { scaleFactor: 1 }); advance(0.5);
        expect(painted(pixels())).toBeGreaterThan(painted(before));
        advance(1);
        expect(pixels()).toEqual(before);
    });
    it('开放线段只加宽路径，不生成三角形区域', () => {
        const line = board.create('segment', [[-2, -1], [2, 1]], { strokeWidth: 2, withLabel: false });
        board.update();
        const before = pixels();
        line.indicate(1000, { scaleFactor: 1 }); advance(0.5);
        expect(painted(pixels())).toBeGreaterThan(painted(before));
        advance(1);
        expect(pixels()).toEqual(before);
    });
    it('直角在原路径中填充且取消后恢复', () => {
        const angle = board.create('angle', [[2, 0], [0, 0], [0, 2]], { radius: 1.5, fillOpacity: 0, withLabel: false });
        board.update();
        const before = pixels();
        angle.indicate(1000, { scaleFactor: 1 }); advance(0.5);
        expect(painted(pixels())).toBeGreaterThan(painted(before));
        board.stopAllAnimation(); board.update();
        expect(pixels()).toEqual(before);
    });
    it('事务内淡入三维点后可在同一动作中渲染强调', () => {
        const view = board.create('view3d', [[-3, -2], [6, 4], [[-3, 3], [-3, 3], [-3, 3]]], {
            axesPosition: 'none',
        });
        const point = view.create('point3d', [1, 1, 1], {
            withLabel: false,
            visible: false,
            size: 4,
        });
        board.update();
        const before = pixels();

        expect(() => board.batch(() => {
            point.fadeIn(400);
            point.indicate(800);
        })).not.toThrow();
        advance(0.5);
        expect(pixels()).not.toEqual(before);
        advance(1);
        expect(point.getAttribute('visible')).toBeTrue();
    });
});
