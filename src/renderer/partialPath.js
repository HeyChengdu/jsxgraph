/** Return a prefix of a rendered line; do not modify the underlying geometry. */
export function partialLine(x1, y1, x2, y2, progress = 1) {
  if (progress <= 0) return [x1, y1];
  const fraction = Math.min(1, progress);
  return [x1, y1, x1 + (x2 - x1) * fraction, y1 + (y2 - y1) * fraction];
}
