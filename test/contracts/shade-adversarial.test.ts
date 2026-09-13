/// <reference path="../../src/index.d.ts" />
/**
 * [INPUT]: Public shade, geometry editing, export and animation clock APIs
 * [OUTPUT]: Adversarial regressions for transient region ownership and live geometry
 * [POS]: Contract tests independent of shade's internal state and implementation
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
describe("shade 对抗性契约", () => {
    let board: JXG.Board;
    let host: HTMLDivElement;
    let jobs: Set<JXG.AnimationJob>;
    let afterStart: (() => void) | undefined;
    const ids = () => Object.keys(board.objects).sort();
    const point = (x: number, y: number) => board.create("point", [x, y], { withLabel: false });
    const ring = () => [point(0, 0), point(3, 0), point(0, 3)];
    const tick = (progress: number) => {
        for (const job of [...jobs]) {
            job.update(progress);
            if (progress === 1) {
                job.finish();
                jobs.delete(job);
            }
        }
        board.update();
    };
    const shadeNode = () => host.querySelector('[data-jxg-attention="shade"]');
    beforeEach(() => {
        host = document.createElement("div");
        host.style.width = "640px";
        host.style.height = "360px";
        document.body.append(host);
        jobs = new Set();
        afterStart = undefined;
        board = JXG.JSXGraph.initBoard(host, {
            renderer: "svg",
            theme: "light",
            boundingbox: [-5, 5, 5, -5],
            showNavigation: false,
            showCopyright: false,
            resize: { enabled: false },
            animationScheduler: {
                schedule(job) {
                    jobs.add(job);
                    job.start();
                    afterStart?.();
                    return {
                        cancel() {
                            jobs.delete(job);
                            job.cancel();
                        }
                    };
                },
                dispose() {
                    for (const job of [...jobs]) job.cancel();
                    jobs.clear();
                }
            }
        });
    });
    afterEach(() => {
        JXG.JSXGraph.freeBoard(board);
        host.remove();
    });

    it("填充期间插入顶点后不得继续强调旧三角形", () => {
        const vertices = ring();
        const polygon = board.create("polygon", vertices);
        const added = point(3, 3);
        polygon.shade();
        tick(0.5);
        polygon.insertPoints(1, added);
        board.update();
        const source = host.querySelector('[id$="_' + polygon.id + '"]');
        const overlay = shadeNode();
        // Updating to the new region or cancelling is safe; retaining the old region is not.
        expect(
            !overlay || overlay.getAttribute("points") === source?.getAttribute("points")
        ).toBeTrue();
    });

    it("临时填充不得进入可重建画板的导出源码", () => {
        const vertices = ring();
        const before = JXG.Dump.toJavaScript(board);
        board.shade(vertices);
        tick(0.5);
        expect(JXG.Dump.toJavaScript(board)).toBe(before);
    });

    it("隐藏的构造点不会被填充修改可见性", () => {
        const vertices = ring();
        vertices.forEach((p) => p.setAttribute({ visible: false }));
        board.shade(vertices);
        tick(0.5);
        expect(vertices.map((p) => p.getAttribute("visible"))).toEqual([false, false, false]);
        board.animationScheduler.cancelAll();
        expect(shadeNode()).toBeNull();
    });

    it("调度启动后立即取消不遗留对象和任务", () => {
        const vertices = ring(),
            before = ids();
        afterStart = () => board.animationScheduler.cancelAll();
        board.shade(vertices);
        expect(ids()).toEqual(before);
        expect(jobs.size).toBe(0);
    });

    it("调度启动后源对象被移除不遗留填充", () => {
        const polygon = board.create("polygon", ring());
        afterStart = () => {
            board.removeObject(polygon);
        };
        polygon.shade();
        expect(shadeNode()).toBeNull();
        expect(jobs.size).toBe(0);
    });

    it("反复填充椭圆不遗留额外画板对象", () => {
        const ellipse = board.create("ellipse", [point(-1, 0), point(1, 0), 4]);
        const before = ids();
        for (let i = 0; i < 25; i++) {
            ellipse.shade();
            tick(0.5);
            tick(1);
            expect(ids()).toEqual(before);
        }
        expect(jobs.size).toBe(0);
    });

    it("同一区域循环换起点不重复叠加，不同区域可共存", () => {
        const [a, b, c] = ring(),
            d = point(3, 3),
            before = ids();
        board.shade([a, b, c]);
        board.shade([b, c, a]);
        expect(ids().length).toBe(before.length + 1);
        board.shade([b, d, c]);
        expect(ids().length).toBe(before.length + 2);
        board.animationScheduler.cancelAll();
        expect(ids()).toEqual(before);
    });

    it("移动形成自交时清除区域，不留下错误填充", () => {
        const a = point(0, 0),
            b = point(3, 0),
            c = point(3, 3),
            d = point(0, 3);
        const before = ids();
        board.shade([a, b, c, d]);
        tick(0.5);
        b.setPosition(JXG.COORDS_BY_USER, [1, 4]);
        board.update();
        expect(ids()).toEqual(before);
        expect(jobs.size).toBe(0);
    });

    it("不同尺寸的有效三角形不会被绝对误差阈值误判", () => {
        for (const scale of [1e-8, 1, 1e8]) {
            const vertices = [point(0, 0), point(scale, 0), point(0, scale)];
            expect(() => board.shade(vertices)).not.toThrow();
            board.animationScheduler.cancelAll();
        }
    });

    it("淡入淡出端点和中段严格使用注入时钟", () => {
        board.shade(ring());
        for (const [progress, opacity] of [
            [0, 0],
            [0.1, 0.11],
            [0.5, 0.22],
            [0.9, 0.11]
        ]) {
            tick(progress);
            const node = shadeNode();
            expect(node).not.toBeNull();
            if (node)
                expect(Number(getComputedStyle(node).fillOpacity)).toBeCloseTo(opacity, 10);
        }
        tick(1);
        expect(shadeNode()).toBeNull();
    });

    it("默认调度器首帧 update 回调移除源对象也必须即时清理", () => {
        JXG.JSXGraph.freeBoard(board);
        board = JXG.JSXGraph.initBoard(host, {
            renderer: "svg",
            showNavigation: false,
            showCopyright: false,
            resize: { enabled: false },
            boundingbox: [-5, 5, 5, -5]
        });
        const vertices = ring(),
            polygon = board.create("polygon", vertices);
        let removed = false;
        board.on("update", () => {
            if (!removed) {
                removed = true;
                board.removeObject(polygon);
            }
        });
        polygon.shade();
        expect(removed).toBeTrue();
        expect(shadeNode()).toBeNull();
    });

    it("源多边形变成退化区域后不得仍填充原区域", () => {
        const [a, b, c] = ring(),
            d = point(3, 3);
        const polygon = board.create("polygon", [a, b, d, c]);
        polygon.shade();
        tick(0.5);
        polygon.removePoints(d);
        polygon.removePoints(c);
        board.update();
        expect(shadeNode()).toBeNull();
    });

    it("多种强调同时运行时取消 shade 不残留任何临时 DOM", () => {
        const vertices = ring(),
            polygon = board.create("polygon", vertices);
        const before = ids();
        polygon.circumscribe(1000);
        polygon.shade(1000);
        tick(0.5);
        expect(host.querySelector('[data-jxg-attention="circumscribe"]')).not.toBeNull();
        expect(shadeNode()).not.toBeNull();
        board.animationScheduler.cancelAll();
        board.update();
        expect(host.querySelector("[data-jxg-attention]")).toBeNull();
        expect(ids()).toEqual(before);
    });
});
