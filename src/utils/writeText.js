/** 原生 Text 书写：普通文字逐字揭示，公式完整排版后按横向进度揭示。 */
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
    const milliseconds = duration === undefined ? (formula ? 1000 : characters.length * text.board.attr.writeinterval) : duration;
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
        throw new Error('JSXGraph: write() duration must be a finite nonnegative number of milliseconds.');
    }
    const state = { content, characters, formula, progress: 0, count: 0, active: true, handle: null };
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
            state.count = Math.min(characters.length, Math.floor(progress * characters.length));
            text.needsUpdate = true;
        },
        finish() {
            if (!state.active) return;
            state.active = false;
            state.progress = 1;
            state.count = characters.length;
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
        '<span style="white-space:pre-wrap;visibility:' + (index < state.count ? 'visible' : 'hidden') + '">' +
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
