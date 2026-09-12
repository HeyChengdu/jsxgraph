/**
 * [INPUT]: 公式语义端点、renderer 可见边界与 Board 动画调度
 * [OUTPUT]: 两个唯一公式局部之间的临时弧线、端点范围横线及纯文字关系标签
 * [POS]: JSXGraph 教学呈现层，不改变公式、数学坐标或作者样式
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import JXG from '../jxg.js';
import { scheduleAttention } from './attention.js';

const namespace = 'http://www.w3.org/2000/svg';
const mix = (a, b, t) => a.map((value, index) => value + (b[index] - value) * t);

function validateEndpoint(endpoint) {
  if (!endpoint) throw new Error('JSXGraph: relate requires a formula parts selection.');
  const { element, name } = endpoint;
  if (!element.evalVisProp('visible')) throw new Error('JSXGraph: relate requires visible endpoints.');
  element.updateText();
  // 排演没有 DOM；对作者语义标记进行基数校验，实际渲染再校验解析后的边界。
  const marker = new RegExp('\\\\part\\s*\\{\\s*' + name + '\\s*\\}', 'g');
  if ([...String(element.plaintext).matchAll(marker)].length !== 1)
    throw new Error('JSXGraph: relate requires a unique formula part: ' + name);
}

export function relateParts(source, destination, options) {
  if (!options || typeof options !== 'object' || Array.isArray(options))
    throw new Error('JSXGraph: invalid relate options.');
  const { duration, label } = options;
  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error('JSXGraph: relation duration must be finite and positive.');
  if (typeof label !== 'string' || label.trim().length === 0)
    throw new Error('JSXGraph: relation label must be nonempty plain text.');
  validateEndpoint(source);
  validateEndpoint(destination);
  const board = source.element.board;
  if (board !== destination.element.board) throw new Error('JSXGraph: relate endpoints must share a Board.');
  if (source.element === destination.element && source.name === destination.name)
    throw new Error('JSXGraph: relate requires distinct endpoints.');
  const members = [...new Set([source.element, destination.element])];
  const state = {
    element: source.element,
    members,
    contents: members.map(element => element.plaintext),
    source, destination,
    kind: 'relate',
    label: board.attr.textresolver?.(label) ?? label,
    progress: 0, node: null, handle: null,
    render: renderRelation,
  };
  scheduleAttention(state, duration, previous => previous.kind === 'relate' &&
    previous.source.element === source.element && previous.source.name === source.name &&
    previous.destination.element === destination.element && previous.destination.name === destination.name);
}

function endpointBox(endpoint) {
  const boxes = endpoint.element.board.renderer.getVisualBounds(endpoint.element, endpoint.name);
  if (boxes.length !== 1) throw new Error('JSXGraph: relate requires a unique rendered formula part: ' + endpoint.name);
  const box = boxes[0];
  if (!box.every(Number.isFinite) || box[2] <= 0 || box[3] <= 0)
    throw new Error('JSXGraph: relate requires measurable formula parts.');
  return box;
}

function renderRelation(state) {
  const board = state.element.board;
  // 回看重建会先推进未挂载的 Board；布局必须等宿主挂载后再测量。
  if (!board.containerObj.isConnected) return;
  const a = endpointBox(state.source), b = endpointBox(state.destination);
  const start = [a[0] + a[2] / 2, a[1] - 5];
  const end = [b[0] + b[2] / 2, b[1] - 5];
  // 横线表示整个语义范围，弧线接其中点；负号、多位数均由实测边界决定。
  const caps = [a, b].map(box => [box[0], box[1] - 5, box[0] + box[2], box[1] - 5]);
  const top = Math.min(start[1], end[1]) - Math.max(24, Math.min(70, Math.abs(end[0] - start[0]) * 0.3));
  const c1 = [start[0], top], c2 = [end[0], top];
  // SVG 与 Canvas 使用同一三次曲线前缀，避免两种后端的揭示进度不同。
  const t = Math.min(1, state.progress / 0.45);
  const ab = mix(start, c1, t), bc = mix(c1, c2, t), cd = mix(c2, end, t);
  const abc = mix(ab, bc, t), bcd = mix(bc, cd, t), tip = mix(abc, bcd, t);
  const labelX = (start[0] + end[0]) / 2;
  const labelY = (start[1] + end[1]) / 8 + top * 0.75 - 9;
  const opacity = Math.min(1, (1 - state.progress) / 0.2);
  const color = JXG.resolveThemeColor('amber-600', board.attr.theme, 'strokeColor');
  if (board.renderer.type === 'canvas') {
    const context = board.renderer.context;
    context.save();
    try {
      context.globalAlpha = opacity;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.lineCap = 'round';
      context.setLineDash([]);
      context.beginPath();
      context.moveTo(...start);
      context.bezierCurveTo(...ab, ...abc, ...tip);
      context.stroke();
      context.globalAlpha = opacity * t;
      context.beginPath();
      for (const [x1, y1, x2, y2] of caps) {
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
      }
      context.stroke();
      context.fillStyle = color;
      context.font = '18px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'alphabetic';
      context.fillText(state.label, labelX, labelY);
    } finally { context.restore(); }
    return;
  }
  if (!state.node) {
    const doc = board.containerObj.ownerDocument;
    state.node = doc.createElementNS(namespace, 'g');
    state.node.setAttribute('data-jxg-attention', 'relate');
    state.node.setAttribute('aria-hidden', 'true');
    state.node.style.pointerEvents = 'none';
    state.node.append(
      doc.createElementNS(namespace, 'path'), doc.createElementNS(namespace, 'text'),
      ...caps.map(() => doc.createElementNS(namespace, 'line'))
    );
    board.renderer.svgRoot.append(state.node);
  }
  const [path, label] = state.node.children;
  state.node.setAttribute('opacity', String(opacity));
  for (const [key, value] of Object.entries({
    d: `M ${start.join(' ')} C ${[...ab, ...abc, ...tip].join(' ')}`,
    fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round',
  })) path.setAttribute(key, String(value));
  for (const [key, value] of Object.entries({
    x: labelX, y: labelY, fill: color, opacity: t,
    'font-family': 'sans-serif', 'font-size': 18, 'text-anchor': 'middle',
  })) label.setAttribute(key, String(value));
  label.textContent = state.label;
  for (const [index, [x1, y1, x2, y2]] of caps.entries()) {
    const line = state.node.children[index + 2];
    for (const [key, value] of Object.entries({
      x1, y1, x2, y2, stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round', opacity: t,
    })) line.setAttribute(key, String(value));
  }
}
