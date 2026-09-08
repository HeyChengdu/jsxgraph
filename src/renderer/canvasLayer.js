import JXG from '../jxg.js';
import { rasterVisualBounds } from './visualBounds.js';

function surface(renderer, width, height) {
  const canvas = renderer.canvasRoot.ownerDocument
    ? renderer.canvasRoot.ownerDocument.createElement('canvas')
    : JXG.createCanvas(width, height);
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Renderer-owned raster cache, invalidated by actual drawing commands, not geometry guesses. */
export function captureLayer(renderer, element, render) {
  const root = renderer.canvasRoot;
  const board = element.board;
  renderer._visualLayers ??= new WeakMap();
  let entry = renderer._visualLayers.get(element);
  const scratch = (renderer._visualScratch ??= surface(
    renderer,
    root.width,
    root.height
  ));
  if (scratch.width !== root.width || scratch.height !== root.height) {
    scratch.width = root.width;
    scratch.height = root.height;
  }
  const context = scratch.getContext('2d');
  context.reset();
  const output = renderer.context;
  const matrix = output.getTransform();
  context.setTransform(matrix);
  const commands = [
    root.width,
    root.height,
    board.canvasWidth,
    board.canvasHeight,
    matrix.a,
    matrix.b,
    matrix.c,
    matrix.d,
    matrix.e,
    matrix.f,
  ];
  let cacheable = true;
  const record = value => {
    if (Array.isArray(value)) return value.map(record);
    if (value !== null && typeof value === 'object') {
      // Mutable images, gradients and paths must never reuse a stale bitmap.
      cacheable = false;
      return null;
    }
    return value;
  };
  renderer.context = new Proxy(context, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (typeof value !== 'function') return value;
      return (...args) => {
        commands.push([key, args.map(record)]);
        return value.apply(target, args);
      };
    },
    set(target, key, value) {
      commands.push([key, record(value)]);
      return Reflect.set(target, key, value, target);
    },
  });
  try {
    render();
  } finally {
    renderer.context = output;
  }
  const signature = JSON.stringify(commands);
  if (cacheable && entry?.signature === signature) return entry;
  const boxes = rasterVisualBounds(scratch, board);
  const box = boxes[0];
  const sx = root.width / board.canvasWidth,
    sy = root.height / board.canvasHeight;
  const width = box ? Math.round(box[2] * sx) : 1;
  const height = box ? Math.round(box[3] * sy) : 1;
  const canvas = entry?.canvas ?? surface(renderer, width, height);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const cropped = canvas.getContext('2d');
  cropped.reset();
  if (box)
    cropped.drawImage(
      scratch,
      Math.round(box[0] * sx),
      Math.round(box[1] * sy),
      width,
      height,
      0,
      0,
      width,
      height
    );
  entry = { canvas, boxes, signature: cacheable ? signature : null };
  renderer._visualLayers.set(element, entry);
  return entry;
}

/** Tint a compact layer without modifying the cached source pixels. */
export function tintLayer(renderer, layer, color, opacity) {
  const source = layer.canvas;
  const canvas = (renderer._attentionScratch ??= surface(
    renderer,
    source.width,
    source.height
  ));
  if (canvas.width !== source.width) canvas.width = source.width;
  if (canvas.height !== source.height) canvas.height = source.height;
  const context = canvas.getContext('2d');
  context.reset();
  context.drawImage(source, 0, 0);
  context.globalCompositeOperation = 'source-atop';
  context.globalAlpha = opacity;
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}
