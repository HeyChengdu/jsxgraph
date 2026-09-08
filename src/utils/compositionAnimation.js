/**
 * [INPUT]: Existing Composition membership and element-owned write jobs
 * [OUTPUT]: Deduplicated, atomic composite presentation on the Board scheduler
 * [POS]: Native JSXGraph animation orchestration; owns no geometry or renderer
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { emphasize } from './attention.js';

export function emphasizeComposition(composition, kind, duration = 1000) {
  const members = compositionMembers(composition).filter(member =>
    member.evalVisProp('visible')
  );
  if (members.length)
    emphasize(members[0], kind, duration, null, {
      target: composition,
      members,
    });
  else if (!Number.isFinite(duration) || duration < 0)
    throw new Error(
      'JSXGraph: attention duration must be finite and nonnegative.'
    );
  return composition;
}

export function compositionMembers(composition) {
  const members = [],
    seen = new Set(),
    visiting = new Set();
  function visit(target) {
    if (visiting.has(target)) throw new Error('JSXGraph: composition cycle.');
    if (seen.has(target)) return;
    if (target.elements && !target.board) {
      visiting.add(target);
      for (const child of target._animationMembers ??
        Object.values(target.elements))
        visit(child);
      visiting.delete(target);
    } else {
      members.push(target);
    }
    seen.add(target);
  }
  visit(composition);
  const board = members[0]?.board;
  if (members.some(member => member.board !== board))
    throw new Error('JSXGraph: composite animation requires a single Board.');
  // Polygon borders already belong to their parent's write presentation.
  const owned = new Set(members.flatMap(member => member.borders ?? []));
  return members.filter(member => !owned.has(member));
}

export function writeComposition(composition, duration = 1000, options = {}) {
  if (!Number.isFinite(duration) || duration < 0)
    throw new Error(
      'JSXGraph: write() duration must be finite and nonnegative.'
    );
  const members = compositionMembers(composition);
  if (!members.length) return composition;
  const board = members[0].board;
  // Prepare every child before publishing any effect, including capability validation.
  const jobs = members.map(member => {
    if (typeof member._write !== 'function')
      throw new Error(
        'JSXGraph: write() is not supported by a composition member.'
      );
    return member._write(duration);
  });
  const finished = new Set(),
    started = new Set();
  let ended = false;
  const clear = () => {
    if (ended) return;
    ended = true;
    for (const job of started) job.cancel();
    if (composition._compositionWrite === handle)
      composition._compositionWrite = null;
  };
  // This bridge is bound before start, so synchronous hiding can cancel the whole job.
  let scheduled;
  const handle = {
    cancel() {
      if (scheduled) scheduled.cancel();
      else clear();
    },
  };
  for (const job of jobs) job.bind(handle);
  scheduled = board.animationScheduler.schedule({
    duration,
    start() {
      composition._compositionWrite?.cancel();
      composition._compositionWrite = handle;
      for (const job of jobs) {
        if (ended) break;
        started.add(job);
        job.start();
        job.update(0);
      }
    },
    update(progress) {
      if (ended) return;
      for (const [index, job] of jobs.entries()) {
        if (finished.has(job)) continue;
        const local = options.sequential
          ? Math.max(0, Math.min(1, progress * jobs.length - index))
          : progress;
        job.update(local);
        if (local === 1) {
          finished.add(job);
        }
      }
    },
    finish() {
      if (!ended) for (const job of jobs) job.finish();
      clear();
    },
    cancel: clear,
  });
  return composition;
}
