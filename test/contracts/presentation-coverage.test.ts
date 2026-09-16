/// <reference path="../../src/index.d.ts" />
/**
 * [INPUT]: 公开呈现 API（write、fadeIn、fadeOut、show、hide）、原生 SVG 节点与受控 Board 时钟
 * [OUTPUT]: 二维、三维、刻度、组与组合的呈现覆盖契约与结构对象边界
 * [POS]: 原生呈现能力矩阵的浏览器契约测试；不依赖 Mideo 运行时
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
describe('呈现能力覆盖', () => {
    let board: JXG.Board;
    let host: HTMLDivElement;
    let jobs: Set<JXG.AnimationJob>;

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
    const nodeOf = (element: { id: string }) =>
        document.getElementById(`${board.container}_${element.id}`) as unknown as {
            getAttribute(name: string): string | null;
            style: CSSStyleDeclaration;
        };
    const projected = (element: unknown) =>
        element as unknown as {
            element2D: { id: string; visPropCalc: { visible: boolean } };
            write(duration?: number): unknown;
            fadeIn(duration?: number): unknown;
            fadeOut(duration?: number): unknown;
            visPropCalc: { visible: boolean };
        };

    beforeEach(() => {
        host = document.createElement('div');
        host.id = `coverage-${Math.random().toString(36).slice(2)}`;
        host.style.cssText = 'width:640px;height:480px';
        document.body.append(host);
        jobs = new Set();
        board = JXG.JSXGraph.initBoard(host, {
            renderer: 'svg',
            boundingbox: [-5, 5, 5, -5],
            showCopyright: false,
            showNavigation: false,
            resize: { enabled: false },
            animationScheduler: {
                schedule(job: JXG.AnimationJob) {
                    jobs.add(job);
                    job.start();
                    return {
                        cancel() {
                            jobs.delete(job);
                            job.cancel();
                        },
                    };
                },
                dispose() {
                    for (const job of jobs) job.cancel();
                    jobs.clear();
                },
            },
        });
    });

    afterEach(() => {
        JXG.JSXGraph.freeBoard(board);
        host.remove();
    });

    function makeView() {
        return board.create(
            'view3d',
            [
                [-3, -3],
                [6, 6],
                [
                    [-3, 3],
                    [-3, 3],
                    [-3, 3],
                ],
            ],
            { axesPosition: 'none' }
        ) as unknown as {
            create(type: string, parents: unknown[], attributes?: unknown): unknown;
            hide(): unknown;
            fadeIn(duration?: number): unknown;
            write(duration?: number): unknown;
        };
    }

    it('三维元素书写按投影前缀推进并让隐藏对象出现', () => {
        const view = makeView();
        const line3 = projected(
            view.create('line3d', [
                [0, 0, 0],
                [2, 2, 2],
            ], { visible: false })
        );
        board.update();
        const node = nodeOf(line3.element2D);
        const idle = node.getAttribute('d');
        expect(line3.element2D.visPropCalc.visible).toBe(false);

        line3.write(400);
        board.update();
        expect(line3.element2D.visPropCalc.visible).toBe(true);
        const opening = node.getAttribute('d');
        expect(opening).not.toBe(idle);
        tick(0.5);
        expect(node.getAttribute('d')).toContain('L');
        tick(1);
        expect((node.getAttribute('d') || '').length).toBeGreaterThan(
            (opening || '').length
        );
    });

    it('三维元素淡入淡出由二维投影承担，隐藏后不改变投影坐标', () => {
        const view = makeView();
        const point3 = projected(
            view.create('point3d', [[1, 1, 1]], {
                visible: false,
                withLabel: false,
            })
        );
        board.update();
        const node = nodeOf(point3.element2D);

        point3.fadeIn(400);
        board.update();
        expect(point3.element2D.visPropCalc.visible).toBe(true);
        expect(node.style.opacity).toBe('0');
        tick(0.5);
        expect(Number(node.style.opacity)).toBeCloseTo(0.5, 5);
        tick(1);
        expect(node.style.opacity).toBe('');

        point3.fadeOut(400);
        board.update();
        tick(1);
        expect(point3.element2D.visPropCalc.visible).toBe(false);
    });

    it('无路径对象书写退化为淡入，刻度随自身节点淡入', () => {
        const image = board.create(
            'image',
            ['', [-2, -4], [-1, -3]],
            { visible: false }
        ) as unknown as { write(duration?: number): unknown; id: string };
        board.update();
        const imageNode = nodeOf(image);

        image.write(200);
        board.update();
        expect(imageNode.style.opacity).toBe('0');
        tick(0.5);
        expect(Number(imageNode.style.opacity)).toBeCloseTo(0.5, 5);

        const line = board.create('line', [
            [-3, 3],
            [3, 3],
        ]);
        const ticks = board.create('ticks', [line, 1], {
            drawLabels: false,
        }) as unknown as {
            rendNode: { style: CSSStyleDeclaration };
            write(duration?: number): unknown;
            visPropCalc: { visible: boolean };
        };
        board.update();
        ticks.write(200);
        board.update();
        expect(ticks.rendNode.style.opacity).toBe('0');
        tick(1);
        expect(ticks.visPropCalc.visible).toBe(true);
    });

    it('组与组合把五类呈现操作转发给成员', () => {
        const first = board.create('point', [-1, 0], {
            visible: false,
            withLabel: false,
        });
        const second = board.create('point', [1, 0], {
            visible: false,
            withLabel: false,
        });
        const firstNode = nodeOf(first);
        const group = board.create('group', [first, second]) as unknown as {
            show(): unknown;
            hide(): unknown;
            fadeIn(duration?: number): unknown;
            write(duration?: number): unknown;
        };

        group.show();
        expect([first.visPropCalc.visible, second.visPropCalc.visible]).toEqual([
            true,
            true,
        ]);
        group.hide();
        expect([first.visPropCalc.visible, second.visPropCalc.visible]).toEqual([
            false,
            false,
        ]);
        group.fadeIn(200);
        board.update();
        expect(firstNode.style.opacity).toBe('0');
        tick(1);
        expect(firstNode.style.opacity).toBe('');

        const composition = new JXG.Composition({ first, second });
        composition.hide();
        expect([first.visPropCalc.visible, second.visPropCalc.visible]).toEqual([
            false,
            false,
        ]);
        composition.show();
        expect([first.visPropCalc.visible, second.visPropCalc.visible]).toEqual([
            true,
            true,
        ]);
    });

    it('没有呈现载体的结构对象不参与淡入淡出', () => {
        const view = makeView();
        expect(() => view.fadeIn(200)).toThrowError(/view3d/);
        const transform = board.create('transform', [2, 2], { type: 'scale' });
        expect(
            (transform as unknown as { fadeIn?: unknown }).fadeIn
        ).toBeUndefined();
    });

    it('三维坐标轴容器转发呈现操作并保留具名成员', () => {
        const view = board.create(
            'view3d',
            [
                [-3, -3],
                [6, 6],
                [
                    [-3, 3],
                    [-3, 3],
                    [-3, 3],
                ],
            ],
            { axesPosition: 'border' }
        ) as unknown as {
            create(type: string, parents: unknown[], attributes?: unknown): unknown;
        };
        const axes = view.create('axes3d', [], {
            withLabel: false,
        }) as unknown as {
            write(duration?: number): unknown;
            hide(): unknown;
            show(): unknown;
            xAxis: {
                visPropCalc: { visible: boolean };
                element2D: { id: string; visPropCalc: { visible: boolean } };
            };
        };

        // 具名成员访问保持可用。
        expect(!!axes.xAxis).toBe(true);

        axes.hide();
        board.update();
        expect(axes.xAxis.visPropCalc.visible).toBe(false);

        axes.show();
        board.update();
        expect(axes.xAxis.visPropCalc.visible).toBe(true);

        const node = nodeOf(axes.xAxis.element2D);
        axes.write(400);
        board.update();
        expect(axes.xAxis.element2D.visPropCalc.visible).toBe(true);
        tick(0.5);
        expect((node.getAttribute('d') || '').length).toBeGreaterThan(0);
    });


    it('画布渲染器下三维投影与刻度的淡入按像素生效', () => {
        const canvasHost = document.createElement('div');
        canvasHost.id = `coverage-canvas-${Math.random().toString(36).slice(2)}`;
        canvasHost.style.cssText = 'width:320px;height:320px';
        document.body.append(canvasHost);
        const canvasJobs = new Set<JXG.AnimationJob>();
        const canvasBoard = JXG.JSXGraph.initBoard(canvasHost, {
            renderer: 'canvas',
            boundingbox: [-4, 4, 4, -4],
            showCopyright: false,
            showNavigation: false,
            resize: { enabled: false },
            animationScheduler: {
                schedule(job: JXG.AnimationJob) {
                    canvasJobs.add(job);
                    job.start();
                    return {
                        cancel() {
                            canvasJobs.delete(job);
                            job.cancel();
                        },
                    };
                },
                dispose() {
                    for (const job of canvasJobs) job.cancel();
                    canvasJobs.clear();
                },
            },
        });
        try {
            const advance = (progress: number) => {
                for (const job of [...canvasJobs]) {
                    job.update(progress);
                    if (progress === 1) {
                        job.finish();
                        canvasJobs.delete(job);
                    }
                }
                canvasBoard.update();
            };
            const view = canvasBoard.create(
                'view3d',
                [
                    [-3, -3],
                    [6, 6],
                    [
                        [-3, 3],
                        [-3, 3],
                        [-3, 3],
                    ],
                ],
                { axesPosition: 'none' }
            ) as unknown as {
                create(type: string, parents: unknown[], attributes?: unknown): unknown;
            };
            const point3 = view.create('point3d', [[0, 0, 0]], {
                visible: false,
                withLabel: false,
            }) as unknown as {
                fadeIn(duration?: number): unknown;
                element2D: {
                    visPropCalc: { visible: boolean };
                    coords: { scrCoords: number[] };
                };
            };
            const line = canvasBoard.create('line', [
                [-3, 3],
                [3, 3],
            ]);
            const ticks = canvasBoard.create('ticks', [line, 1], {
                drawLabels: false,
            }) as unknown as {
                fadeIn(duration?: number): unknown;
                visPropCalc: { visible: boolean };
            };
            canvasBoard.update();

            const context = (
                canvasBoard.renderer as unknown as {
                    context: CanvasRenderingContext2D;
                    canvasRoot: HTMLCanvasElement;
                }
            ).context;
            const canvas = (
                canvasBoard.renderer as unknown as {
                    canvasRoot: HTMLCanvasElement;
                }
            ).canvasRoot;
            // 画布按设备像素比放大，采样前先换算到画布像素坐标。
            const pixelRatio =
                canvas.width /
                (canvasBoard as unknown as { canvasWidth: number }).canvasWidth;
            const sample = () => {
                const [, x, y] = point3.element2D.coords.scrCoords;
                const data = context.getImageData(
                    Math.floor(x * pixelRatio),
                    Math.floor(y * pixelRatio),
                    1,
                    1
                ).data;
                return [data[0], data[1], data[2]];
            };
            const distance = (left: number[], right: number[]) =>
                Math.hypot(
                    left[0] - right[0],
                    left[1] - right[1],
                    left[2] - right[2]
                );
            const background = sample();

            point3.fadeIn(400);
            ticks.fadeIn(400);
            advance(0.5);
            const midway = sample();
            advance(1);
            const finished = sample();

            expect(distance(background, midway)).toBeGreaterThan(0);
            expect(distance(background, finished)).toBeGreaterThan(
                distance(background, midway)
            );
            expect(point3.element2D.visPropCalc.visible).toBe(true);
            expect(ticks.visPropCalc.visible).toBe(true);
        } finally {
            JXG.JSXGraph.freeBoard(canvasBoard);
            canvasHost.remove();
        }
    });

    it('无路径对象、空组与结构对象在边界输入下行为明确', () => {

        const image = board.create('image', ['', [-2, -4], [-1, -3]], {
            visible: false,
        }) as unknown as {
            write(duration?: number): unknown;
            visPropCalc: { visible: boolean };
        };
        expect(() => image.write(Infinity)).toThrowError(/duration/);
        expect(() => image.write(-1)).toThrowError(/duration/);
        expect(image.visPropCalc.visible).toBe(false);

        const emptyGroup = board.create('group', []) as unknown as {
            write(duration?: number): unknown;
            fadeIn(duration?: number): unknown;
            hide(): unknown;
        };
        expect(() => emptyGroup.write(50)).not.toThrow();
        expect(() => emptyGroup.fadeIn(50)).not.toThrow();
        expect(() => emptyGroup.hide()).not.toThrow();

        const view = makeView();
        const turtle = board.create('turtle', [[-3, -3]]) as unknown as {
            write(duration?: number): unknown;
            fadeIn(duration?: number): unknown;
        };
        expect(() => view.fadeIn(100)).toThrowError(/view3d/);
        expect(() => view.write(100)).toThrowError(/view3d/);
        expect(() => turtle.fadeIn(100)).toThrowError(/turtle/);
        expect(() => turtle.write(100)).toThrowError(/turtle/);
    });

    it('圆弧与扇形书写按轮廓前缀推进，扇形填充在末段恢复', () => {
        const arc = board.create(
            'arc',
            [
                [0, 0],
                [2, 0],
                [0, 2],
            ],
            { withLabel: false, visible: false }
        ) as unknown as { id: string; write(duration?: number): void };
        board.update();
        const arcNode = nodeOf(arc);
        arc.write(1000);
        board.update();
        const arcStart = arcNode.getAttribute('d') || '';
        tick(0.5);
        const arcMid = arcNode.getAttribute('d') || '';
        expect(arcMid.length).toBeGreaterThan(arcStart.length);
        tick(1);
        expect((arcNode.getAttribute('d') || '').length).toBeGreaterThan(
            arcMid.length
        );

        // 扇形与圆同属可书写家族：轮廓按前缀推进，填充在最后阶段恢复；闭合由回到起点完成，不写出 Z。
        const sector = board.create(
            'sector',
            [
                [0, 0],
                [2, 0],
                [0, 2],
            ],
            { withLabel: false, visible: false, fillOpacity: 0.5 }
        ) as unknown as { id: string; write(duration?: number): void };
        board.update();
        const sectorNode = nodeOf(sector);
        sector.write(1000);
        board.update();
        const sectorStart = sectorNode.getAttribute('d') || '';
        tick(0.5);
        const sectorMid = sectorNode.getAttribute('d') || '';
        expect(sectorMid.length).toBeGreaterThan(sectorStart.length);
        tick(1);
        expect(Number(sectorNode.getAttribute('fill-opacity'))).toBeCloseTo(
            0.5,
            5
        );
        expect((sectorNode.getAttribute('d') || '').length).toBeGreaterThan(
            sectorMid.length
        );
    });
});
