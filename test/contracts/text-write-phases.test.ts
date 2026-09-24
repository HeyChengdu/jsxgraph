/// <reference path="../../src/index.d.ts" />
/**
 * [INPUT]: 公开 text.write、Board 的 writeInterval、注入的公式渲染器与受控动画时钟
 * [OUTPUT]: 普通文字按 manim Write 包络书写的字素相位、父元素隐藏状态继承，以及公式掩膜路径的边界
 * [POS]: 文字书写时序的浏览器契约测试；不依赖 Mideo 运行时
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
describe('文字书写的 manim Write 时序', () => {
    let board: JXG.Board;
    let host: HTMLDivElement;
    let jobs: Set<JXG.AnimationJob>;

    const initBoard = (extra: Record<string, unknown> = {}) => {
        const element = document.createElement('div');
        element.style.cssText = 'width:640px;height:480px';
        document.body.append(element);
        const scheduled = new Set<JXG.AnimationJob>();
        const created = JXG.JSXGraph.initBoard(element, {
            renderer: 'svg',
            boundingbox: [-5, 5, 5, -5],
            showCopyright: false,
            showNavigation: false,
            resize: { enabled: false },
            formulaRenderer: (source: string, target: HTMLElement) => {
                target.textContent = source;
            },
            animationScheduler: {
                schedule(job: JXG.AnimationJob) {
                    scheduled.add(job);
                    job.start();
                    return {
                        cancel() {
                            scheduled.delete(job);
                            job.cancel();
                        }
                    };
                },
                dispose() {
                    scheduled.clear();
                }
            },
            ...extra
        });
        return { board: created, host: element, jobs: scheduled };
    };

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

    const textOf = (content: string, attributes: Record<string, unknown> = {}) =>
        board.create('text', [0, 0, content] as never, {
            withLabel: false,
            visible: false,
            fixed: true,
            fontSize: 28,
            strokeColor: '#112233',
            anchorX: 'middle',
            anchorY: 'middle',
            ...attributes
        } as never) as unknown as {
            rendNode: HTMLElement;
            write(duration?: number): unknown;
            hide(): unknown;
        };

    const spansOf = (text: { rendNode: HTMLElement }) =>
        Array.from(text.rendNode.querySelectorAll('span')) as HTMLElement[];

    const durations = () => [...jobs].map(job => job.duration);

    beforeEach(() => {
        const created = initBoard();
        board = created.board;
        host = created.host;
        jobs = created.jobs;
    });

    afterEach(() => {
        JXG.JSXGraph.freeBoard(board);
        host.remove();
    });

    it('普通文字默认采用 1 秒／2 秒包络，显式时长覆盖包络', () => {
        textOf('abc').write();
        expect(durations()).toEqual([1000]);

        jobs.clear();
        textOf('汉'.repeat(20)).write();
        expect(durations()).toEqual([2000]);

        jobs.clear();
        textOf('abc').write(300);
        expect(durations()).toEqual([300]);
    });

    it('作者改写 writeInterval 时仍按逐字素节奏书写', () => {
        const created = initBoard({ writeInterval: 300 });
        const paced = created.board.create('text', [0, 0, 'abc'] as never, {
            withLabel: false,
            visible: false,
            fixed: true
        } as never) as unknown as { write(duration?: number): unknown };
        paced.write();
        expect([...created.jobs].map(job => job.duration)).toEqual([900]);
        JXG.JSXGraph.freeBoard(created.board);
        created.host.remove();
    });

    it('字素按 manim 的窗口重叠推进，未开始的字素保持布局', () => {
        const count = 7;
        const lag = Math.min(4 / count, 0.2);
        const full = (count - 1) * lag + 1;
        const sub = (progress: number, index: number) =>
            Math.max(0, Math.min(1, progress * full - index * lag));
        const inked = (span: HTMLElement) => span.style.getPropertyValue('-webkit-text-stroke') !== '';
        const inkPercent = (span: HTMLElement) =>
            Number(/([\d.]+)%/.exec(span.style.getPropertyValue('background-image'))?.[1]);
        const text = textOf('abcdefg');
        text.write(1000);
        tick(0.25);
        tick(0.25);
        const spans = spansOf(text);
        expect(spans.length).toBe(count);
        // 窗口宽 1/full，相邻步距是窗口的 lag 倍：进度 0.25 时前三个字素同时在写。
        expect(sub(0.25, 0)).toBeCloseTo(0.55, 10);
        expect(sub(0.25, 1)).toBeCloseTo(0.35, 10);
        expect(sub(0.25, 2)).toBeCloseTo(0.15, 10);
        expect(spans.filter(inked).length).toBe(3);
        expect(spans.filter(span => span.style.visibility === 'hidden').length).toBe(4);
        expect(spans[0].style.visibility).toBe('');
        // 越靠后的字素灌墨越少，说明它们共享同一段重叠窗口。
        expect(inkPercent(spans[0])).toBeGreaterThan(inkPercent(spans[1]));
        expect(inkPercent(spans[1])).toBeGreaterThan(inkPercent(spans[2]));
        expect(spans[3].style.visibility).toBe('hidden');
        expect(spans[6].style.visibility).toBe('hidden');
    });

    it('书写结束后不残留临时内联样式', () => {
        const text = textOf('abcdefgh');
        text.write(600);
        tick(0.5);
        expect(spansOf(text)[7].style.visibility).toBe('hidden');
        tick(1);
        const spans = spansOf(text);
        expect(spans.every(span => span.style.visibility === '')).toBe(true);
        expect(spans.every(span => span.style.getPropertyValue('-webkit-text-stroke') === '')).toBe(true);
        expect(spans.every(span => span.style.getPropertyValue('background-clip') === '')).toBe(true);
    });

    it('写完后或写入中隐藏父文本，字素不覆盖父元素的隐藏状态', () => {
        const finished = textOf('已写完');
        finished.write(600);
        tick(1);
        finished.hide();
        board.update();
        expect(getComputedStyle(finished.rendNode).visibility).toBe('hidden');
        expect(spansOf(finished).every(span => getComputedStyle(span).visibility === 'hidden')).toBe(true);

        const writing = textOf('正在写');
        writing.write(600);
        tick(0.5);
        writing.hide();
        board.update();
        expect(spansOf(writing).every(span => getComputedStyle(span).visibility === 'hidden')).toBe(true);
    });

    it('重入从第一个字素重新开始，不叠加两次进度', () => {
        const text = textOf('abcdefgh');
        text.write(1000);
        expect(jobs.size).toBe(1);
        tick(0.6);
        text.write(1000);
        expect(jobs.size).toBe(1);
        tick(0);
        expect(spansOf(text)[0].style.visibility).toBe('hidden');
    });

    it('空文本零时长结束且不报错', () => {
        const text = textOf('');
        text.write();
        expect(durations()).toEqual([0]);
        expect(() => tick(1)).not.toThrow();
    });

    it('字素簇是书写单位，组合字符不被拆开', () => {
        const text = textOf('a\u0301b');
        text.write(600);
        tick(0.5);
        expect(spansOf(text).length).toBe(2);
    });

    it('公式保持完整排版与横向掩膜，不生成字素 span', () => {
        const formula = textOf('\\frac{1}{2}', { useKatex: true });
        formula.write();
        expect(durations()).toEqual([1000]);
        tick(0.5);
        expect(formula.rendNode.style.maskImage).toContain('linear-gradient');
        expect(formula.rendNode.querySelectorAll('span').length).toBe(0);
        tick(1);
        expect(formula.rendNode.style.maskImage).not.toContain('linear-gradient');
    });
});
