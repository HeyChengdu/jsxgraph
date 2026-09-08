/** Prepare path presentation for either an element or a composite Board job. */
export function writePath(element, duration = 1000, options = {}) {
  if (!Number.isFinite(duration) || duration < 0) {
    throw new Error(
      'JSXGraph: write() duration must be finite and nonnegative.'
    );
  }
  const state = { kind: 'path', progress: 0, handle: null };
  const clear = () => {
    if (element._writeState === state) {
      element._writeState = null;
      element.needsUpdate = true;
      for (const border of element.borders ?? []) border.needsUpdate = true;
      for (const ticks of element.ticks ?? []) ticks.needsUpdate = true;
      element.board._pathWrites?.delete(element);
    }
  };
  return {
    duration,
    bind(handle) { state.handle = handle; },
    start() {
      element._writeState?.handle?.cancel();
      element._writeState = state;
      element.board._pathWrites ??= new Set();
      element.board._pathWrites.add(element);
      element.setAttribute({ visible: true });
    },
    update(progress) {
      state.progress = Math.max(0, Math.min(1, progress));
      element.needsUpdate = true;
      for (const border of element.borders ?? []) border.needsUpdate = true;
      for (const ticks of element.ticks ?? []) ticks.needsUpdate = true;
    },
    finish() {
      clear();
      options.callback?.();
    },
    cancel: clear,
  };
}

export function writeVector(duration, options) {
  if (
    this.is3D ||
    !['svg', 'canvas', 'no'].includes(this.board.renderer.type)
  ) {
    throw new Error('JSXGraph: write() requires a supported 2D renderer.');
  }
  return writePath(this, duration, options);
}

function phase(element) {
  return Boolean(
    element.ticks?.length ||
    element.evalVisProp('firstarrow') ||
    element.evalVisProp('lastarrow') ||
    (Number(element.evalVisProp('fillopacity')) > 0 &&
      element.evalVisProp('fillcolor') !== 'none')
  );
}

export function fillProgress(element) {
  const state = element._writeState;
  return state?.kind === 'path'
    ? Math.max(0, Math.min(1, (state.progress - 0.8) / 0.2))
    : 1;
}

/** Attached ticks and labels follow the line's terminal presentation phase. */
export function writtenTickCount(ticks) {
  return Math.ceil(ticks.ticks.length * fillProgress(ticks.line));
}

export function strokeProgress(element) {
  const state = element._writeState;
  if (state?.kind === 'path')
    return Math.min(1, state.progress / (phase(element) ? 0.8 : 1));
  for (const owner of element.board._pathWrites ?? []) {
    const borders = owner.borders?.filter(border => border.visPropCalc.visible);
    const index = borders?.indexOf(element) ?? -1;
    if (index < 0) continue;
    const lengths = borders.map(border =>
      Math.hypot(
        border.point2.coords.scrCoords[1] - border.point1.coords.scrCoords[1],
        border.point2.coords.scrCoords[2] - border.point1.coords.scrCoords[2]
      )
    );
    const total = lengths.reduce((a, b) => a + b, 0);
    const before = lengths.slice(0, index).reduce((a, b) => a + b, 0);
    return lengths[index]
      ? Math.max(
          0,
          Math.min(1, (total * strokeProgress(owner) - before) / lengths[index])
        )
      : 1;
  }
  return 1;
}
