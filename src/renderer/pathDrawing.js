/**
 * [INPUT]: Native screen-space geometry and Board-owned write progress
 * [OUTPUT]: Shared SVG/Canvas path commands, arc-length prefixes, and point/circle primitives
 * [POS]: Renderer presentation layer; never changes mathematical geometry or owns animation time
 * [PROTOCOL]: Update this contract on change, then check AGENTS.md
 */
import { strokeProgress } from '../utils/writePath.js';

const cache = new WeakMap();
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

function split(a, b, c, d, t) {
  const ab = mix(a, b, t),
    bc = mix(b, c, t),
    cd = mix(c, d, t);
  const abc = mix(ab, bc, t),
    bcd = mix(bc, cd, t),
    end = mix(abc, bcd, t);
  return [
    [a, ab, abc, end],
    [end, bcd, cd, d],
  ];
}

function measureCubic(points) {
  const samples = [{ t: 0, length: 0 }];
  let length = 0;
  function visit(p, lo, hi, depth) {
    const chord = distance(p[0], p[3]);
    const polygon =
      distance(p[0], p[1]) + distance(p[1], p[2]) + distance(p[2], p[3]);
    const speedError =
      Math.abs(distance(p[0], p[1]) - chord / 3) +
      Math.abs(distance(p[2], p[3]) - chord / 3);
    if (depth >= 16 || (polygon - chord <= 0.05 && speedError <= 0.05)) {
      length += (polygon + chord) / 2;
      samples.push({ t: hi, length });
      return;
    }
    const halves = split(...p, 0.5),
      mid = (lo + hi) / 2;
    visit(halves[0], lo, mid, depth + 1);
    visit(halves[1], mid, hi, depth + 1);
  }
  visit(points, 0, 1, 0);
  return { samples, length };
}

/** Consume renderer paths, preserving subpaths and cubic segments; cache arc-length tables. */
export function writtenCommands(element, commands) {
  const progress = strokeProgress(element);
  if (progress >= 1) return commands;
  const signature = JSON.stringify(commands);
  let entry = cache.get(element);
  if (entry?.signature !== signature) {
    let current = [0, 0],
      start = current,
      length = 0;
    const parts = commands.map(command => {
      const [op, ...values] = command;
      if (op === 'M') {
        current = values;
        start = current;
        return { command, length: 0 };
      }
      const end = op === 'Z' ? start : values.slice(-2);
      const points =
        op === 'C'
          ? [current, values.slice(0, 2), values.slice(2, 4), end]
          : [current, end];
      const metric =
        op === 'C' ? measureCubic(points) : { length: distance(current, end) };
      current = end;
      length += metric.length;
      return { command, points, ...metric };
    });
    entry = { signature, parts, length };
    cache.set(element, entry);
  }
  let remaining = entry.length * progress;
  const result = [];
  for (const part of entry.parts) {
    if (part.command[0] === 'M') {
      result.push(part.command);
      continue;
    }
    if (remaining <= 0) break;
    if (part.length <= remaining) {
      result.push(part.command);
      remaining -= part.length;
      continue;
    }
    if (part.command[0] === 'C') {
      const i = part.samples.findIndex(sample => sample.length >= remaining);
      const a = part.samples[i - 1],
        b = part.samples[i];
      const t =
        a.t + ((b.t - a.t) * (remaining - a.length)) / (b.length - a.length);
      const prefix = split(...part.points, t)[0];
      result.push(['C', ...prefix[1], ...prefix[2], ...prefix[3]]);
    } else
      result.push([
        'L',
        ...mix(part.points[0], part.points[1], remaining / part.length),
      ]);
    break;
  }
  return result;
}

export function curveCommands(element) {
  const commands = [];
  let penUp = true;
  const points = element.points.slice(0, element.numberPoints);
  for (let i = 0; i < points.length; i++) {
    const p = points[i]?.scrCoords;
    if (!p || !Number.isFinite(p[1]) || !Number.isFinite(p[2])) {
      penUp = true;
      continue;
    }
    if (penUp) {
      commands.push(['M', p[1], p[2]]);
      penUp = false;
    } else if (element.bezierDegree === 3) {
      const q = points[i + 1]?.scrCoords,
        r = points[i + 2]?.scrCoords;
      if (!q || !r || ![...q, ...r].every(Number.isFinite)) {
        penUp = true;
        continue;
      }
      commands.push(['C', p[1], p[2], q[1], q[2], r[1], r[2]]);
      i += 2;
    } else commands.push(['L', p[1], p[2]]);
  }
  return commands;
}

export function ellipseCommands(x, y, rx, ry) {
  const k = 0.5522847498307936;
  return [
    ['M', x - rx, y],
    ['C', x - rx, y - k * ry, x - k * rx, y - ry, x, y - ry],
    ['C', x + k * rx, y - ry, x + rx, y - k * ry, x + rx, y],
    ['C', x + rx, y + k * ry, x + k * rx, y + ry, x, y + ry],
    ['C', x - k * rx, y + ry, x - rx, y + k * ry, x - rx, y],
    ['Z'],
  ];
}

export const svgPath = commands =>
  commands.map(command => command.join(' ')).join(' ');
export function canvasPath(context, commands) {
  context.beginPath();
  for (const [op, ...args] of commands) {
    if (op === 'M') context.moveTo(...args);
    else if (op === 'L') context.lineTo(...args);
    else if (op === 'C') context.bezierCurveTo(...args);
    else if (op === 'Z') context.closePath();
  }
}

/** Point faces are renderer primitives, not mathematical points with zero-area bounds. */
export function pointCommands(x, y, size, face) {
  if (face === 'o')
    return ellipseCommands(
      x,
      y,
      size === 0 ? 0 : size + 1,
      size === 0 ? 0 : size + 1
    );
  const polygon = vertices => [
    ['M', ...vertices[0]],
    ...vertices.slice(1).map(p => ['L', ...p]),
    ['Z'],
  ];
  if (face === '[]')
    return polygon([
      [x - size, y - size],
      [x + size, y - size],
      [x + size, y + size],
      [x - size, y + size],
    ]);
  if (face === '<>' || face === '<<>>') {
    const s = face === '<<>>' ? size * 1.41 : size;
    return polygon([
      [x - s, y],
      [x, y - s],
      [x + s, y],
      [x, y + s],
    ]);
  }
  const h = (size * Math.sqrt(3)) / 2,
    half = size / 2;
  if (face === '^')
    return polygon([
      [x, y - size],
      [x - h, y + half],
      [x + h, y + half],
    ]);
  if (face === 'v')
    return polygon([
      [x, y + size],
      [x - h, y - half],
      [x + h, y - half],
    ]);
  if (face === '>')
    return polygon([
      [x + size, y],
      [x - half, y - h],
      [x - half, y + h],
    ]);
  if (face === '<')
    return polygon([
      [x - size, y],
      [x + half, y - h],
      [x + half, y + h],
    ]);
  if (face === 'x')
    return [
      ['M', x - size, y - size],
      ['L', x + size, y + size],
      ['M', x - size, y + size],
      ['L', x + size, y - size],
    ];
  const paths = [];
  if (face !== '|') paths.push(['M', x - size, y], ['L', x + size, y]);
  if (face !== '-') paths.push(['M', x, y - size], ['L', x, y + size]);
  return paths;
}
