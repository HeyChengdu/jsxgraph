/**
 * [INPUT]: Native visual membership, renderer layers and the Board scheduler
 * [OUTPUT]: Minimal fade entrances/exits for every rendered element, 2D or 3D
 * [POS]: JSXGraph presentation channel, independent of write and attention
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import Const from '../base/constants.js';
import { visualFamily } from '../renderer/visualBounds.js';
import { compositionMembers, groupMembers } from './compositionAnimation.js';

export function resetFadePresentation(board) {
  for (const undo of board._fadePresentation?.values() ?? []) undo();
  board._fadePresentation?.clear();
}

function members(state) {
  return new Set(state.roots.flatMap(visualFamily));
}

export function cancelFade(element) {
  for (const state of element.board._fades ?? [])
    if (state.roots.includes(element)) state.handle.cancel();
}

// 结构对象没有自己的呈现：三维视图由相机运动建立，变换不参与画面，
// 海龟的轨迹由它绘制出的曲线承担。刻度有自己的渲染节点，因此不在此列。
const STRUCTURAL_TYPES = new Map([
  [Const.OBJECT_TYPE_VIEW3D, 'view3d'],
  [Const.OBJECT_TYPE_TRANSFORMATION, 'transform'],
  [Const.OBJECT_TYPE_TURTLE, 'turtle'],
]);

/** 单元素即自身；Composition 与组拆成实际参与渲染的对象。 */
function fadeRoots(target) {
  let roots = null;
  if (target?.board && target.board.groups?.[target.id] === target)
    roots = groupMembers(target);
  else if (target?.board) roots = [target];
  else if (target?.elements) roots = compositionMembers(target);
  if (!roots)
    throw new Error('JSXGraph: fade requires an element or composition.');
  for (const root of roots) {
    const structural = STRUCTURAL_TYPES.get(root.type);
    if (structural)
      throw new Error(
        `JSXGraph: fade does not apply to ${structural}; fade the objects it renders.`
      );
  }
  return roots;
}

export function fade(target, entering, duration = 1000) {
  if (!Number.isFinite(duration) || duration < 0)
    throw new Error('JSXGraph: fade duration must be finite and nonnegative.');
  // 三维元素通过它的二维投影与面参与呈现，因此与二维元素走同一条通路。
  const candidates = fadeRoots(target);
  const roots = entering ? candidates : candidates.filter(element => element.evalVisProp('visible'));
  if (!roots.length) return target;
  const job = createFadeJob(roots, entering, duration);
  const handle = roots[0].board.animationScheduler.schedule(job);
  job.bind(handle);
  return target;
}

/** 无书写能力成员在复合书写中的出现方式，与独立淡入共用同一实现。 */
export function createRevealJob(member, duration) {
  // 与独立淡入走同一条解析：容器拆成成员，没有呈现载体的对象在这里被拒绝。
  return createFadeJob(fadeRoots(member), true, duration);
}

/**
 * 单个可调度任务：根成员在进入时显隐切换，透明度由 board._fades 在渲染边界施加。
 * 复合书写把成员任务聚合成一个任务，因此这里不自行调度。
 */
export function createFadeJob(roots, entering, duration) {
  const board = roots[0].board;
  const state = { roots, opacity: entering ? 0 : 1, handle: null };
  let scheduled;
  const clear = () => {
    resetFadePresentation(board);
    board._fades?.delete(state);
  };
  const handle = { cancel() { scheduled ? scheduled.cancel() : clear(); } };
  state.handle = handle;
  return {
    duration,
    bind(outer) {
      scheduled = outer;
    },
    start() {
      for (const root of roots) cancelFade(root);
      if (entering) for (const root of roots) root.setAttribute({ visible: true });
      board._fades ??= new Set();
      board._fades.add(state);
    },
    update(progress) { state.opacity = entering ? progress : 1 - progress; },
    finish() {
      clear();
      if (!entering) for (const root of roots) root.setAttribute({ visible: false });
    },
    cancel: clear,
  };
}

/** Apply opacity after native DOM rendering; preserve the author's inline priority. */
export function updateFade(board) {
  resetFadePresentation(board);
  const factors = new Map();
  for (const state of board._fades ?? []) {
    if (state.roots.some(root => !root.evalVisProp('visible'))) {
      state.handle.cancel();
      continue;
    }
    for (const element of members(state)) {
      const node = element.rendNode;
      if (node?.isConnected) factors.set(node, Math.min(factors.get(node) ?? 1, state.opacity));
    }
  }
  for (const [node, factor] of factors) {
    board._fadePresentation ??= new Map();
    const old = node.style.getPropertyValue('opacity');
    const priority = node.style.getPropertyPriority('opacity');
    if (!board._fadePresentation.has(node)) board._fadePresentation.set(node, () => {
      old ? node.style.setProperty('opacity', old, priority) : node.style.removeProperty('opacity');
    });
    const authored = board.containerObj.ownerDocument.defaultView.getComputedStyle(node).opacity;
    node.style.setProperty('opacity', String((authored === '' ? 1 : Number(authored)) * factor), 'important');
  }
}

/** Multiply renderer alpha at the drawing boundary; no pixel readback is needed. */
export function renderFadeCanvas(element, render) {
  const states = [...(element.board._fades ?? [])].filter(state => members(state).has(element));
  if (!states.length || element.rendNode?.isConnected) return render();
  const renderer = element.board.renderer;
  const context = renderer.context;
  const factor = Math.min(...states.map(state => state.opacity));
  context.save();
  try {
    context.globalAlpha *= factor;
    renderer.context = new Proxy(context, {
      get(target, key) {
        const value = Reflect.get(target, key, target);
        if (key === 'globalAlpha') return factor ? value / factor : 1;
        return typeof value === 'function' ? value.bind(target) : value;
      },
      set(target, key, value) {
        return Reflect.set(target, key, key === 'globalAlpha' ? value * factor : value, target);
      },
    });
    return render();
  } finally {
    renderer.context = context;
    context.restore();
  }
}
