/**
 * [INPUT]: Native visual membership, renderer layers and the Board scheduler
 * [OUTPUT]: Minimal fade entrances/exits without changing authored opacity or geometry
 * [POS]: JSXGraph presentation channel, independent of write and attention
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import Const from '../base/constants.js';
import { visualFamily } from '../renderer/visualBounds.js';
import { compositionMembers } from './compositionAnimation.js';

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

export function fade(target, entering, duration = 1000) {
  if (!Number.isFinite(duration) || duration < 0)
    throw new Error('JSXGraph: fade duration must be finite and nonnegative.');
  const candidates = target.board ? [target] : compositionMembers(target);
  const roots = entering ? candidates : candidates.filter(element => element.evalVisProp('visible'));
  if (roots.some(element => element.is3D ||
    (element.elementClass === Const.OBJECT_CLASS_OTHER && element.type !== Const.OBJECT_TYPE_IMAGE)))
    throw new Error('JSXGraph: fade requires 2D visual elements.');
  if (!roots.length) return target;
  const board = roots[0].board;
  const state = { roots, opacity: entering ? 0 : 1, handle: null };
  let scheduled;
  const clear = () => {
    resetFadePresentation(board);
    board._fades?.delete(state);
  };
  state.handle = { cancel() { scheduled ? scheduled.cancel() : clear(); } };
  scheduled = board.animationScheduler.schedule({
    duration,
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
  });
  return target;
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
