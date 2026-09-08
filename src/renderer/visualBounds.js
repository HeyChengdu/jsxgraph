/**
 * [INPUT]: Native element-owned borders, ticks, labels and rendered DOM/pixels
 * [OUTPUT]: Deduplicated visible families and renderer-space visual bounds
 * [POS]: Shared renderer ownership boundary consumed by attention and fade
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
/** Enumerate native presentation ownership, not mathematical dependencies. */
export function visualFamily(element) {
  const members = new Set();
  function visit(target) {
    if (!target || members.has(target) || !target.visPropCalc.visible) return;
    members.add(target);
    for (const border of target.borders ?? []) visit(border);
    for (const ticks of target.ticks ?? []) {
      // Tick elements also store coordinate arrays under `ticks`.
      if (ticks?.board) visit(ticks);
    }
    for (const label of target.labels ?? []) visit(label);
    visit(target.label);
  }
  visit(element);
  return [...members];
}

/** Measure rendered DOM or raster results; never fall back to mathematical bounds. */
export function domVisualBounds(element, partName = null) {
  const board = element.board;
  if (!board.containerObj.isConnected) return [];
  const nodes =
    partName === null
      ? visualFamily(element).map(member => member.rendNode).filter(Boolean)
      : [
          ...element.rendNode.querySelectorAll(
            '[data-jxg-part="' + partName + '"]'
          ),
        ];
  const host = board.containerObj.getBoundingClientRect();
  const sx = host.width ? board.canvasWidth / host.width : 1;
  const sy = host.height ? board.canvasHeight / host.height : 1;
  const boxes = nodes
    .filter(node => {
      if (!node.isConnected) return false;
      const style =
        board.containerObj.ownerDocument.defaultView.getComputedStyle(node);
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.visibility !== 'collapse'
      );
    })
    .map(node => {
      const rect = node.getBoundingClientRect();
      const svg = node.namespaceURI === 'http://www.w3.org/2000/svg';
      const computed =
        board.containerObj.ownerDocument.defaultView.getComputedStyle(node);
      const strokeColor = computed.stroke || node.getAttribute('stroke');
      const stroke =
        svg && strokeColor !== 'none'
          ? (parseFloat(
              computed.strokeWidth || node.getAttribute('stroke-width')
            ) || 0) / 2
          : 0;
      return [
        (rect.left - host.left) * sx - stroke,
        (rect.top - host.top) * sy - stroke,
        rect.width * sx + stroke * 2,
        rect.height * sy + stroke * 2,
      ];
    });
  return partName === null && boxes.length ? [unionBounds(boxes)] : boxes;
}

export function unionBounds(boxes) {
  const left = Math.min(...boxes.map(box => box[0]));
  const top = Math.min(...boxes.map(box => box[1]));
  return [
    left,
    top,
    Math.max(...boxes.map(box => box[0] + box[2])) - left,
    Math.max(...boxes.map(box => box[1] + box[3])) - top,
  ];
}

/** Read actual alpha coverage without geometry-specific size or shape rules. */
export function rasterVisualBounds(canvas, board) {
  const { width, height } = canvas;
  const pixels = canvas.getContext('2d').getImageData(0, 0, width, height).data;
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  if (right < left) return [];
  const sx = board.canvasWidth / width,
    sy = board.canvasHeight / height;
  return [
    [left * sx, top * sy, (right - left + 1) * sx, (bottom - top + 1) * sy],
  ];
}
