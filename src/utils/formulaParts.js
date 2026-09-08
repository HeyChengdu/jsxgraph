/* KaTeX 公式的稳定语义分组；选择器不复制公式，也不保存 DOM 快照。 */
import { emphasize } from './attention.js';

const partName = /^[A-Za-z][A-Za-z0-9_-]*$/;

export function formulaParts(text, name) {
    if (typeof name !== 'string' || !partName.test(name)) throw new Error('JSXGraph: invalid formula part name.');
    if (!text.evalVisProp('usekatex')) throw new Error('JSXGraph: parts() requires KaTeX text.');
    const selection = {
        indicate(duration) { emphasize(text, 'indicate', duration, name); return selection; },
        circumscribe(duration) { emphasize(text, 'circumscribe', duration, name); return selection; }
    };
    return selection;
}

export function formulaOptions(text) {
    return {
        macros: { ...text.evalVisProp('katexmacros'), '\\part': '\\htmlData{jxg-part=#1}{#2}' },
        // 只允许无副作用的语义 data 属性，不开放 style、链接、图像或其他 HTML。
        trust: context => context.command === '\\htmlData' &&
            Object.keys(context.attributes).length === 1 &&
            partName.test(context.attributes['data-jxg-part'] ?? ''),
        strict: code => code === 'htmlExtension' ? 'ignore' : 'warn',
        throwOnError: false
    };
}
