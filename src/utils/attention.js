/* Native emphasis changes presentation, never geometry or authored styles. */
import JXG from '../jxg.js';
import Const from '../base/constants.js';
import { unionBounds, visualFamily, isVisuallyVisible } from '../renderer/visualBounds.js';
import { markerSVG } from '../renderer/indicateMarker.js';

const svgNamespace = 'http://www.w3.org/2000/svg';

function visualMembers(state) { return state.members ?? [state.element]; }
function renderedMembers(state) { return [...new Set(visualMembers(state).flatMap(visualFamily))]; }
function attentionBounds(state) {
  const renderer = state.element.board.renderer;
  if (!state.members) return renderer.getVisualBounds(state.element, state.partName);
  const boxes = state.members.flatMap(member => renderer.getVisualBounds(member));
  return boxes.length ? [unionBounds(boxes)] : [];
}

/** Composite a compact native drawing without changing coordinates or visProp. */
export function renderAttentionCanvas(element, render) {
  const board = element.board;
  const state = [...(board._attention ?? [])].find(
    item =>
      item.kind === 'indicate' &&
      item.partName === null &&
      renderedMembers(item).includes(element)
  );
  if (!state || element.rendNode) return render();
  const renderer = board.renderer,
    output = renderer.context;
  let layer = renderer.captureVisualLayer(element, render);
  const pulse = Math.sin(Math.PI * state.progress);
  const color = JXG.resolveThemeColor(
    'amber-600',
    board.attr.theme,
    'strokeColor'
  );
  const box =
    !state.members && state.element === element && visualFamily(element).length === 1
      ? layer.boxes[0]
      : attentionBounds(state)[0];
  renderer._indicateMarker = { element, color, pulse };
  try { layer = renderer.captureVisualLayer(element, render); }
  finally { renderer._indicateMarker = null; }
  const markerBox = layer.boxes[0];
  if (!markerBox) return;
  const buffer = renderer.tintVisualLayer(layer, color, pulse);
  // Transparent regions still have a native path: measure their marker drawing.
  const [x, y, width, height] = box ?? markerBox;
  const cx = x + width / 2,
    cy = y + height / 2;
  output.save();
  try {
    output.translate(cx, cy);
    const scale = 1 + (state.scaleFactor - 1) * pulse;
    output.scale(scale, scale);
    output.translate(-cx, -cy);
    output.drawImage(buffer, ...markerBox);
  } finally {
    output.restore();
  }
}

function restore(state) {
  const board = state.element.board;
  resetAttentionPresentation(board);
}

/** Restore each shared DOM property once before native rendering and measurement. */
export function resetAttentionPresentation(board) {
  for (const undo of board._attentionPresentation?.values() ?? []) undo();
  board._attentionPresentation?.clear();
}

function style(state, node, key, value) {
  const board = state.element.board;
  board._attentionPresentation ??= new Map();
  let properties = board._attentionStyles?.get(node);
  if (!properties) {
    board._attentionStyles ??= new WeakMap();
    properties = new Map();
    board._attentionStyles.set(node, properties);
  }
  if (properties.has(key)) {
    node.style.setProperty(key, value, 'important');
    return;
  }
  const old = node.style.getPropertyValue(key);
  const priority = node.style.getPropertyPriority(key);
  const token = {};
  properties.set(key, token);
  board._attentionPresentation.set(token, () => {
    old
      ? node.style.setProperty(key, old, priority)
      : node.style.removeProperty(key);
    properties.delete(key);
  });
  node.style.setProperty(key, value, 'important');
}

function indicateDOM(state) {
  const element = state.element,
    board = element.board;
  const pulse = Math.sin(Math.PI * state.progress);
  const color = JXG.resolveThemeColor(
    'amber-600',
    board.attr.theme,
    'strokeColor'
  );
  if (!state.node) {
    const doc = board.containerObj.ownerDocument;
    state.node = doc.createElementNS(svgNamespace, 'svg');
    state.node.setAttribute('width', '0');
    state.node.setAttribute('height', '0');
    state.node.style.position = 'absolute';
    state.node.style.pointerEvents = 'none';
    state.node.setAttribute('aria-hidden', 'true');
    const filter = doc.createElementNS(svgNamespace, 'filter');
    filter.id =
      board.id +
      '-indicate-' +
      (board._attentionId = (board._attentionId ?? 0) + 1);
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const flood = doc.createElementNS(svgNamespace, 'feFlood');
    const composite = doc.createElementNS(svgNamespace, 'feComposite');
    composite.setAttribute('operator', 'atop');
    composite.setAttribute('in2', 'SourceGraphic');
    filter.append(flood, composite);
    state.node.append(filter);
    board.containerObj.append(state.node);
  }
  const filter = state.node.firstChild;
  // Stroke-only horizontal/vertical paths have a zero-area object bounding box.
  // Use the board viewport, not that degenerate box, for the pixel tint region.
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  filter.setAttribute('x', '0');
  filter.setAttribute('y', '0');
  filter.setAttribute('width', String(board.canvasWidth));
  filter.setAttribute('height', String(board.canvasHeight));
  filter.firstChild.setAttribute('flood-color', color);
  filter.firstChild.setAttribute('flood-opacity', String(pulse));
  const targets =
    state.partName === null
      ? renderedMembers(state).map(member => member.rendNode).filter(Boolean)
      : [
          ...element.rendNode.querySelectorAll(
            '[data-jxg-part="' + state.partName + '"]'
          ),
        ];
  const box = attentionBounds(state)[0];
  if (!box) return;
  for (const node of targets) {
    const svg = node.namespaceURI === svgNamespace;
    style(state, node, 'transform-box', svg ? 'view-box' : 'border-box');
    const host = board.containerObj.getBoundingClientRect();
    const rect = node.getBoundingClientRect();
    const htmlOrigin = state.partName === null && renderedMembers(state).length > 1
      ? (box[0] + box[2] / 2 - (rect.left - host.left) * (host.width ? board.canvasWidth / host.width : 1)) + 'px ' +
        (box[1] + box[3] / 2 - (rect.top - host.top) * (host.height ? board.canvasHeight / host.height : 1)) + 'px'
      : '50% 50%';
    style(
      state,
      node,
      'transform-origin',
      svg
        ? box[0] + box[2] / 2 + 'px ' + (box[1] + box[3] / 2) + 'px'
        : htmlOrigin
    );
    if (!svg && state.partName !== null)
      style(state, node, 'display', 'inline-block');
    style(state, node, 'scale', String(1 + (state.scaleFactor - 1) * pulse));
    if (svg) {
      const member = renderedMembers(state).find(member => member.rendNode === node);
      if (member) markerSVG(board, member, node, color, pulse);
    } else {
      style(state, node, 'background-color', `color-mix(in srgb, ${color} ${22 * pulse}%, transparent)`);
    }
    node.setAttribute('data-jxg-attention', 'indicate');
    if (!board._attentionPresentation.has(node))
      board._attentionPresentation.set(node, () =>
        node.removeAttribute('data-jxg-attention')
      );
    // Tint rendered pixels while preserving transparency and authored colors.
    const originalFilter =
      board.containerObj.ownerDocument.defaultView.getComputedStyle(
        node
      ).filter;
    style(
      state,
      node,
      'filter',
      (originalFilter && originalFilter !== 'none'
        ? originalFilter + ' '
        : '') +
        'url(#' +
        filter.id +
        ')'
    );
  }
}

export function indicateScale(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options))
    throw new Error('JSXGraph: indicate options must be an object.');
  const value = options.scaleFactor === undefined ? 1 : options.scaleFactor;
  if (!Number.isFinite(value) || value <= 0)
    throw new Error('JSXGraph: indicate scaleFactor must be finite and positive.');
  return value;
}

export function emphasize(element, kind, duration = 1000, partName = null, selection = null, options = {}) {
  const scaleFactor = indicateScale(options);
  if (!Number.isFinite(duration) || duration < 0)
    throw new Error(
      'JSXGraph: attention duration must be finite and nonnegative.'
    );
  const board = element.board;
  if ((selection?.members ?? [element]).some(member =>
    (member.is3D && kind !== 'indicate') ||
    member.elType === 'view3d' ||
    (member.elementClass === Const.OBJECT_CLASS_OTHER &&
      member.type !== Const.OBJECT_TYPE_IMAGE)
  )) {
    throw new Error(
      'JSXGraph: attention requires visible geometry; only indicate supports 3D objects.'
    );
  }
  if (!isVisuallyVisible(element))
    throw new Error('JSXGraph: attention requires a visible element.');
  if (partName !== null) {
    element.updateText();
    const marker = new RegExp('\\\\part\\s*\\{\\s*' + partName + '\\s*\\}');
    if (!marker.test(String(element.plaintext)))
      throw new Error('JSXGraph: formula part not found: ' + partName);
  }
  const state = {
    element,
    target: selection?.target ?? element,
    members: selection?.members,
    contents: selection?.members.map(member => member.plaintext),
    kind,
    partName,
    content: element.plaintext,
    progress: 0,
    scaleFactor,
    node: null,
    handle: null,
  };
  scheduleAttention(state, duration, previous =>
    previous.target === state.target && previous.partName === partName && !previous.render
  );
  return element;
}

/** 临时呈现共用调度和清理，具体效果只提供绘制与重入判定。 */
export function scheduleAttention(state, duration, replaces) {
  const board = state.element.board;
  let scheduled;
  let ended = false;
  const cleanup = () => {
    if (ended) return;
    ended = true;
    restore(state);
    state.node?.remove();
    board._attention?.delete(state);
    state.dispose?.();
  };
  // Cancellation is available before a synchronous driver starts rendering.
  state.handle = { cancel() {
    if (ended) return;
    cleanup();
    scheduled?.cancel();
  } };
  scheduled = board.animationScheduler.schedule({
    duration,
    start() {
      if (ended) return;
      for (const previous of board._attention ?? [])
        if (replaces(previous))
          previous.handle?.cancel();
      board._attention ??= new Set();
      board._attention.add(state);
      state.prepare?.();
    },
    update(progress) {
      if (!ended) state.progress = progress;
    },
    finish: cleanup,
    cancel: cleanup,
  });
  if (ended) scheduled.cancel();
}

export function cancelAttention(element, partName) {
  for (const state of element.board._attention ?? []) {
    if (
      (state.dependencies ?? visualMembers(state)).includes(element) &&
      (partName === undefined || state.partName === partName)
    )
      state.handle?.cancel();
  }
}

/** Apply presentation after native rendering using Board coordinates and its clock. */
export function updateAttention(board) {
  resetAttentionPresentation(board);
  for (const state of board._attention ?? []) {
    const element = state.element;
    if (
      (state.isCurrent ? !state.isCurrent() : visualMembers(state).some(member => !isVisuallyVisible(member))) ||
      state.members?.some((member, index) => state.contents[index] !== member.plaintext) ||
      (state.content !== undefined && state.content !== element.plaintext)
    ) {
      state.handle?.cancel();
      continue;
    }
    if (board.renderer.type === 'no') continue;
    if (state.render) {
      state.render(state);
      continue;
    }
    if (state.kind === 'indicate') {
      if (board.renderer.type !== 'canvas' || renderedMembers(state).some(member => member.rendNode))
        indicateDOM(state);
      continue;
    }
    const canvas = board.renderer.type === 'canvas';
    if (!canvas && !state.node) {
      state.node = board.containerObj.ownerDocument.createElementNS(
        svgNamespace,
        'g'
      );
      state.node.setAttribute('data-jxg-attention', state.kind);
      state.node.style.pointerEvents = 'none';
      state.node.setAttribute('aria-hidden', 'true');
      board.renderer.svgRoot.appendChild(state.node);
    }
    const boxes = attentionBounds(state);
    if (!canvas)
      while (state.node.childNodes.length > boxes.length)
        state.node.lastChild.remove();
    for (const [index, [x, y, width, height]] of boxes.entries()) {
      const color = JXG.resolveThemeColor(
        'amber-600',
        board.attr.theme,
        'strokeColor'
      );
      if (canvas) {
        const context = board.renderer.context;
        const perimeter = 2 * (width + height + 16);
        context.save();
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = 2;
        context.beginPath();
        context.rect(x - 4, y - 4, width + 8, height + 8);
        context.setLineDash([perimeter]);
        context.lineDashOffset =
          perimeter * (1 - Math.min(1, state.progress * 2));
        context.globalAlpha = Math.min(1, (1 - state.progress) * 4);
        context.stroke();
        context.restore();
        continue;
      }
      const rect =
        state.node.childNodes[index] ??
        state.node.appendChild(
          board.containerObj.ownerDocument.createElementNS(svgNamespace, 'rect')
        );
      for (const [name, value] of Object.entries({
        x: x - 4,
        y: y - 4,
        width: width + 8,
        height: height + 8,
        fill: 'none',
        stroke: color,
        'stroke-width': 2,
        pathLength: 1,
        'stroke-dasharray': 1,
        'stroke-dashoffset': 1 - Math.min(1, state.progress * 2),
        opacity: Math.min(1, (1 - state.progress) * 4),
      }))
        rect.setAttribute(name, String(value));
    }
  }
}
