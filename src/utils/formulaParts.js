/**
 * [INPUT]: KaTeX 语义标记、原生强调和关系动画
 * [OUTPUT]: 稳定公式局部选择器及受限 KaTeX 宏配置
 * [POS]: 公式作者 API；不复制公式或保存 DOM 快照
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { emphasize } from './attention.js';
import { relateParts } from './relation.js';

const partName = /^[A-Za-z][A-Za-z0-9_-]*$/;
const selections = new WeakMap();

export function formulaParts(text, name) {
    if (typeof name !== 'string' || !partName.test(name)) throw new Error('JSXGraph: invalid formula part name.');
    if (!text.evalVisProp('usekatex')) throw new Error('JSXGraph: parts() requires KaTeX text.');
    const selection = {
        indicate(duration) { emphasize(text, 'indicate', duration, name); return selection; },
        circumscribe(duration) { emphasize(text, 'circumscribe', duration, name); return selection; },
        relate(target, options) {
            relateParts(selections.get(selection), selections.get(target), options);
            return selection;
        }
    };
    selections.set(selection, { element: text, name });
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
