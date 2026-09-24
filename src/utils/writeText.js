/** 原生 Text 书写：普通文字按 manim Write 的时序逐字素描边后再填色，公式完整排版后按横向揭示。 */
const LAG_LIMIT = 0.2;          // manim Write 的 lag_ratio 上限，决定同时在写的字素个数
const SHORT_TEXT = 15;          // manim Write：家族成员少于 15 个写 1 秒，否则 2 秒
const DEFAULT_INTERVAL = 100;   // JXG.Options.board.writeInterval 的出厂值
const STROKE_PER_FONT = 1 / 28; // 描边宽度随字号缩放：28px 字号对应 1px

/** manim Write 的总时长包络：短文本 1 秒，长文本 2 秒，与字数无关。 */
function envelope(count) {
    return count < SHORT_TEXT ? 1000 : 2000;
}

/** 书写期间使用的墨色；无可见墨色的文字退化为直接显隐。 */
function inkColor(text) {
    const color = text.evalVisProp('strokecolor');
    if (typeof color !== 'string' || color === '' || color === 'none' || color === 'transparent') {
        return null;
    }
    // 九位十六进制是 JSXGraph 内部的 RGBA，书写样式只使用其中的 RGB，透明度仍由节点承担。
    return color.length === 9 && color.charAt(0) === '#' ? color.slice(0, 7) : color;
}

function outlineWidth(text) {
    const size = Number(text.evalVisProp('fontsize'));
    return Number.isFinite(size) && size > 0 ? Math.max(1, Math.round(size * STROKE_PER_FONT)) : 1;
}

/** manim Write 的逐字素子进度：窗口宽 1/((n-1)·lag+1)，相邻步距是窗口的 lag 倍。 */
function subProgress(progress, index, count, lag) {
    const full = (count - 1) * lag + 1;
    return Math.max(0, Math.min(1, progress * full - index * lag));
}

/** 描边与灌墨同时进行：前半段轮廓出现并在字素内部灌墨，后半段描边收细回到作者填色。 */
function phaseInk(sub, state) {
    const outlining = sub < 0.5;
    return {
        outlining,
        ink: (outlining ? sub * 2 : 1) * 100,
        width: outlining ? state.stroke : state.stroke * (2 - sub * 2)
    };
}

function phaseStyle(sub, state) {
    const base = 'white-space:pre-wrap;';
    if (sub <= 0) return base + 'visibility:hidden';
    if (sub >= 1 || !state.ink) return base;
    const phase = phaseInk(sub, state);
    return base + 'color:transparent;-webkit-text-stroke:' + phase.width + 'px ' +
        state.color + ';background-image:linear-gradient(to right,' + state.color + ' ' + phase.ink +
        '%,transparent ' + phase.ink + '%);-webkit-background-clip:text;background-clip:text';
}

/** 直接改缓存 span 的样式，避免每帧重建 innerHTML。 */
function applyPhase(span, sub, state) {
    const style = span.style;
    if (sub > 0 && sub < 1 && state.ink) {
        const phase = phaseInk(sub, state);
        style.removeProperty('visibility');
        style.setProperty('color', 'transparent');
        style.setProperty('-webkit-text-stroke', phase.width + 'px ' + state.color);
        style.setProperty('background-image', 'linear-gradient(to right,' + state.color + ' ' + phase.ink +
            '%,transparent ' + phase.ink + '%)');
        style.setProperty('-webkit-background-clip', 'text');
        style.setProperty('background-clip', 'text');
        return;
    }
    // 未开始与终态都回到作者样式，书写期间的内联样式不残留。
    if (sub <= 0) style.setProperty('visibility', 'hidden');
    else style.removeProperty('visibility');
    style.removeProperty('color');
    style.removeProperty('-webkit-text-stroke');
    style.removeProperty('background-image');
    style.removeProperty('-webkit-background-clip');
    style.removeProperty('background-clip');
}

/** renderer 首次写入内容后就能拿到全部字素 span；数量不符时交回 renderer 重建。 */
function phaseSpans(text, state) {
    const node = text.rendNode;
    if (!node || typeof node.querySelectorAll !== 'function') return null;
    const spans = node.querySelectorAll('span');
    return spans.length === state.characters.length ? spans : null;
}

export function writeText(text, duration, options = {}) {
    if (text.board.renderer.type !== 'no' && text.evalVisProp('display') !== 'html') {
        throw new Error('JSXGraph: write() requires HTML text, not internal text.');
    }
    const formula = !!(text.evalVisProp('usekatex') || text.evalVisProp('usemathjax') ||
        text.evalVisProp('useasciimathml'));
    text.updateText();
    const content = String(text.plaintext);
    if (!formula && /[<>]|&(?:#\w+|\w+);/.test(content)) {
        throw new Error('JSXGraph: write() does not support markup.');
    }
    const characters = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(content)]
        .map(part => part.segment);
    // TeX 命令的长度不代表视觉复杂度；公式默认一秒，作者可显式指定毫秒。
    // 普通文字默认用 manim Write 的 1 秒／2 秒包络；作者改写 writeInterval 时仍按逐字素节奏书写。
    const interval = text.board.attr.writeinterval;
    const pace = Number.isFinite(interval) && interval !== DEFAULT_INTERVAL ? characters.length * interval : null;
    const milliseconds = duration === undefined
        ? (formula ? 1000 : (pace === null ? envelope(characters.length) : pace))
        : duration;
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
        throw new Error('JSXGraph: write() duration must be a finite nonnegative number of milliseconds.');
    }
    // 没有可见墨色时无法表达描边与灌墨，退回直接显隐。
    const ink = formula ? null : inkColor(text);
    const state = {
        kind: 'text',
        content,
        characters,
        formula,
        progress: 0,
        subs: characters.map(() => 0),
        color: ink,
        ink: ink !== null,
        stroke: formula ? 0 : outlineWidth(text),
        active: true,
        handle: null
    };
    return {
        duration: characters.length === 0 ? 0 : milliseconds,
        bind(handle) { state.handle = handle; },
        start() {
            text._writeState?.handle?.cancel();
            text._writeState = state;
            text.setAttribute({ visible: true });
        },
        update(progress) {
            if (!state.active) return;
            state.progress = Math.max(0, Math.min(1, progress));
            if (state.formula) {
                text.needsUpdate = true;
                return;
            }
            const lag = Math.min(4 / Math.max(1, characters.length), LAG_LIMIT);
            for (let index = 0; index < characters.length; index++) {
                state.subs[index] = subProgress(state.progress, index, characters.length, lag);
            }
            const spans = phaseSpans(text, state);
            if (spans) {
                for (let index = 0; index < spans.length; index++) {
                    applyPhase(spans[index], state.subs[index], state);
                }
            } else {
                text.needsUpdate = true;
            }
        },
        finish() {
            if (!state.active) return;
            state.active = false;
            state.progress = 1;
            state.subs.fill(1);
            text.needsUpdate = true;
            options.callback?.();
        },
        cancel() {
            state.active = false;
            // Cancellation removes presentation progress without changing authored visibility.
            if (text._writeState === state) {
                text._writeState = null;
                text.needsUpdate = true;
            }
        }
    };
}

export function renderWrittenText(text) {
    const state = text._writeState;
    if (!state) return text.plaintext;
    if (state.content !== String(text.plaintext)) {
        state.handle?.cancel();
        text._writeState = null;
        return text.plaintext;
    }
    if (state.formula) return text.plaintext;
    // 所有字素始终参与布局，隐藏部分不收缩；不把用户文本解释为 HTML。
    const escape = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return state.characters.map((character, index) =>
        '<span style="' + phaseStyle(state.subs[index], state) + '">' +
        escape(character) + '</span>'
    ).join('');
}

/** 由原生 HTML renderer 调用；不改公式 DOM，不干扰既有几何 clipPath。 */
export function updateWrittenFormula(text) {
    const node = text.rendNode;
    const state = text._writeState;
    if (state?.formula && state.progress < 1) {
        if (text._writeMask === undefined) text._writeMask = node.style.maskImage;
        const edge = state.progress * 100;
        node.style.maskImage = 'linear-gradient(to right, black ' + edge + '%, transparent ' + edge + '%)';
    } else if (text._writeMask !== undefined) {
        node.style.maskImage = text._writeMask;
        delete text._writeMask;
    }
}
