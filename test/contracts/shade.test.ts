/// <reference path="../../src/index.d.ts" />
/**
 * [INPUT]: Public JSXGraph region API, native SVG and an injected animation clock
 * [OUTPUT]: Region validation, geometry preservation and lifecycle regression contracts
 * [POS]: Browser contract suite; can also run against a Node DOM host
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */

describe("区域填充强调", () => {
    let board: JXG.Board;
    let container: HTMLDivElement;
    let jobs: Set<JXG.AnimationJob>;
    const points = () => [
        board.create("point", [0, 0], { withLabel: false }),
        board.create("point", [3, 0], { withLabel: false }),
        board.create("point", [0, 2], { withLabel: false })
    ];
    const ids = () => Object.keys(board.objects).sort();
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
    beforeEach(() => {
        container = document.createElement("div");
        container.style.width = "640px";
        container.style.height = "360px";
        document.body.append(container);
        jobs = new Set();
        board = JXG.JSXGraph.initBoard(container, {
            renderer: "svg",
            boundingbox: [-5, 5, 5, -5],
            theme: "light",
            showCopyright: false,
            showNavigation: false,
            resize: { enabled: false },
            animationScheduler: {
                schedule(job) {
                    jobs.add(job);
                    job.start();
                    if (job.duration === 0) {
                        job.update(1);
                        job.finish();
                        jobs.delete(job);
                    }
                    return {
                        cancel() {
                            jobs.delete(job);
                            job.cancel();
                        }
                    };
                },
                dispose() {
                    for (const job of jobs) job.cancel();
                    jobs.clear();
                }
            }
        });
    });
    afterEach(() => {
        JXG.JSXGraph.freeBoard(board);
        container.remove();
    });

    it("顶点快捷调用不改变坐标或遗留辅助对象", () => {
        const vertices = points(),
            before = ids();
        expect(board.shade(vertices, 1800)).toBe(board);
        tick(0.5);
        expect(ids().length).toBe(before.length + 1);
        expect(vertices.map((p) => [p.X(), p.Y()])).toEqual([
            [0, 0],
            [3, 0],
            [0, 2]
        ]);
        tick(1);
        expect(ids()).toEqual(before);
    });

    it("源多边形填充样式不变且取消清理覆盖层", () => {
        const polygon = board.create("polygon", points(), {
            fillColor: "blue",
            fillOpacity: 0.4
        });
        const before = ids();
        expect(polygon.shade(1000)).toBe(polygon);
        tick(0.5);
        expect(polygon.getAttribute("fillColor")).toBe("blue");
        expect(polygon.getAttribute("fillOpacity")).toBe(0.4);
        board.animationScheduler.cancelAll();
        expect(ids()).toEqual(before);
    });

    it("支持凹多边形及反向顶点，但拒绝自交与退化", () => {
        const ring = [
            [0, 0],
            [3, 0],
            [1, 1],
            [3, 3],
            [0, 3]
        ].map((p) => board.create("point", [p[0], p[1]], { withLabel: false }));
        expect(() => board.shade(ring, 0)).not.toThrow();
        expect(() => board.shade([...ring].reverse(), 0)).not.toThrow();
        const before = ids();
        expect(() => board.shade([ring[0], ring[3], ring[1], ring[4]])).toThrow();
        expect(() => board.shade([ring[0], ring[0], ring[1]])).toThrow();
        expect(ids()).toEqual(before);
    });

    it("连续重复调用同一区域只保留一次填充，删除依赖会取消", () => {
        const vertices = points(),
            before = ids();
        board.shade(vertices);
        board.shade([...vertices].reverse());
        expect(ids().length).toBe(before.length + 1);
        board.removeObject(vertices[1]);
        expect(jobs.size).toBe(0);
        expect(ids().length).toBe(before.length - 1);
    });

    it("圆、椭圆、扇形复用封闭边界；线段与开放曲线拒绝填充", () => {
        const [a, b, c] = points();
        for (const shape of [
            board.create("circle", [a, b]),
            board.create("ellipse", [a, b, 5]),
            board.create("sector", [a, b, c])
        ]) {
            const before = ids();
            expect(() => shape.shade(800)).not.toThrow();
            tick(0.5);
            expect(ids().length).toBe(before.length + 1);
            tick(1);
            expect(ids()).toEqual(before);
        }
        expect(() => board.create("segment", [a, b]).shade()).toThrow();
        expect(() => board.create("polygonalchain", [a, b, c]).shade()).toThrow();
        expect(() => board.create("functiongraph", [(x: number) => x * x]).shade()).toThrow();
    });

    it("非有限时长不创建对象", () => {
        const vertices = points(),
            before = ids();
        for (const duration of [-1, NaN, Infinity])
            expect(() => board.shade(vertices, duration)).toThrow();
        expect(ids()).toEqual(before);
    });

    it("填充真实可见、不可命中，顶点移动后边界同步且退化时清除", () => {
        const vertices = points(),
            before = ids();
        board.shade(vertices);
        tick(0.5);
        const overlay = Object.entries(board.objects).find(([id]) => !before.includes(id));
        if (!overlay) throw new Error("没有填充区域");
        const node = container.querySelector('[data-jxg-attention="shade"]');
        expect(node && getComputedStyle(node).fillOpacity).toBe("0.22");
        expect(node && getComputedStyle(node).pointerEvents).toBe("none");
        const path = node?.getAttribute("points");
        vertices[1].setPosition(JXG.COORDS_BY_USER, [4, 0]);
        board.update();
        expect(node?.getAttribute("points")).not.toBe(path);
        vertices[2].setPosition(JXG.COORDS_BY_USER, [2, 0]);
        board.update();
        expect(ids()).toEqual(before);
        expect(jobs.size).toBe(0);
    });

    it("扇形填充保留曲线指令而不是三点直线闭合", () => {
        const [a, b, c] = points();
        const sector = board.create("sector", [a, b, c]);
        sector.shade();
        tick(0.5);
        const node = container.querySelector('[data-jxg-attention="shade"]');
        expect(node?.getAttribute("d")).toMatch(/C/);
        sector.setAttribute({ visible: false });
        expect(container.querySelector('[data-jxg-attention="shade"]')).toBeNull();
    });

    it("退化扇形与部分椭圆不被当成封闭区域", () => {
        const [a, b] = points();
        expect(() => board.create("sector", [a, b, b]).shade()).toThrow();
        expect(() => board.create("ellipse", [a, b, 5, 0, Math.PI]).shade()).toThrow();
    });

    it("完成、隐藏、重复回放不会积累对象或删除原始顶点", () => {
        const vertices = points();
        const circle = board.create("circle", [vertices[0], vertices[1]]);
        const before = ids();
        for (let i = 0; i < 20; i++) {
            circle.shade(0);
            expect(ids()).toEqual(before);
        }
        circle.shade();
        tick(0.5);
        circle.setAttribute({ visible: false });
        expect(ids()).toEqual(before);
        expect(jobs.size).toBe(0);
        expect(() => circle.shade()).toThrow();
        expect(vertices.every((point) => board.objects[point.id] === point)).toBeTrue();
    });

    it("隐藏的构造点仍可定义区域；非有限坐标不能填充", () => {
        const vertices = points();
        vertices.forEach((point) => point.setAttribute({ visible: false }));
        expect(() => board.shade(vertices, 0)).not.toThrow();
        vertices[1].setPosition(JXG.COORDS_BY_USER, [Infinity, 0]);
        expect(() => board.shade(vertices)).toThrow();
    });

    it("扇形源移动后填充与源曲线保持相同路径", () => {
        const [a, b, c] = points();
        const sector = board.create("sector", [a, b, c]);
        sector.shade();
        tick(0.5);
        const node = container.querySelector('[data-jxg-attention="shade"]');
        const source = container.querySelector('[id$="_' + sector.id + '"]');
        const oldPath = node?.getAttribute("d");
        c.setPosition(JXG.COORDS_BY_USER, [-2, 1]);
        board.update();
        expect(node?.getAttribute("d")).not.toBe(oldPath);
        expect(node?.getAttribute("d")).toBe(source?.getAttribute("d"));
    });

    it("默认时长一致，切换主题不覆写源元素的固定颜色", () => {
        const polygon = board.create("polygon", points(), {
            fillColor: "#123456",
            fillOpacity: 0.1
        });
        polygon.shade();
        expect([...jobs][0].duration).toBe(1000);
        tick(0.5);
        const node = container.querySelector('[data-jxg-attention="shade"]');
        board.setTheme("dark");
        expect(node && getComputedStyle(node).fillOpacity).toBe("0.22");
        expect(polygon.getAttribute("fillColor")).toBe("#123456");
        tick(1);
        expect(polygon.getAttribute("fillOpacity")).toBe(0.1);
    });

    it("不接受另一个画板的点", () => {
        const host = document.createElement("div");
        host.style.width = "640px";
        host.style.height = "360px";
        document.body.append(host);
        const other = JXG.JSXGraph.initBoard(host, {
            renderer: "no",
            showNavigation: false,
            showCopyright: false
        });
        try {
            const vertices = points(),
                before = ids();
            const foreign = other.create("point", [1, 1], { withLabel: false });
            expect(() => board.shade([vertices[0], vertices[1], foreign])).toThrow();
            expect(ids()).toEqual(before);
        } finally {
            JXG.JSXGraph.freeBoard(other);
            host.remove();
        }
    });
});
