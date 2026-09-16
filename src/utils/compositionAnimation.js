/**
 * [INPUT]: Existing Composition membership and element-owned write jobs
 * [OUTPUT]: Deduplicated, atomic composite presentation on the Board scheduler
 * [POS]: Native JSXGraph animation orchestration; owns no geometry or renderer
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { emphasize, indicateScale } from './attention.js';
import { isVisuallyVisible } from '../renderer/visualBounds.js';

export function emphasizeComposition(composition, kind, duration = 1000, options = {}) {
  indicateScale(options);
  const members = compositionMembers(composition).filter(isVisuallyVisible);
  if (members.length)
    emphasize(members[0], kind, duration, null, {
      target: composition,
      members,
    }, options);
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
  return dropOwnedBorders(members);
}

/** Polygon borders already belong to their parent's presentation. */
export function dropOwnedBorders(members) {
  const owned = new Set(members.flatMap(member => member.borders ?? []));
  return members.filter(member => !owned.has(member));
}

/** 复合书写只驱动有书写能力、且不被父对象呈现覆盖的成员。 */
export function writableMembers(members) {
  return dropOwnedBorders(members).filter(
    member => typeof member._write === 'function'
  );
}

/** 组的呈现成员是它持有的点。 */
export function groupMembers(group) {
  return Object.values(group.objects ?? {})
    .map(entry => entry?.point)
    .filter(Boolean);
}

/**
 * 把成员书写任务聚合成一个可调度的任务：成员能力在发布任何效果之前全部校验。
 * owner 用于同一目标重入时取消上一次书写；三维元素与组按成员各自的状态处理重入。
 */
export function createCompositeWriteJob(members, duration = 1000, options = {}) {
  if (!Number.isFinite(duration) || duration < 0)
    throw new Error(
      'JSXGraph: write() duration must be finite and nonnegative.'
    );
  if (!members.length) return null;
  const owner = options.owner;
  const fadeJob = options.fadeJob;
  // Prepare every child before publishing any effect, including capability validation.
  const jobs = members.map(member => {
    if (typeof member._write === 'function') return member._write(duration);
    // 能写就写，不能写就以淡入出现；两者都不可用时才失败。
    if (typeof fadeJob === 'function') return fadeJob(member, duration);
    throw new Error(
      'JSXGraph: write() is not supported by a composition member.'
    );
  });
  const finished = new Set(),
    started = new Set();
  let ended = false;
  const clear = () => {
    if (ended) return;
    ended = true;
    for (const job of started) job.cancel();
    if (owner && owner._compositionWrite === handle)
      owner._compositionWrite = null;
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
  return {
    duration,
    bind(outer) {
      scheduled = outer;
    },
    start() {
      owner?._compositionWrite?.cancel();
      if (owner) owner._compositionWrite = handle;
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
  };
}

export function writeComposition(composition, duration = 1000, options = {}) {
  const members = compositionMembers(composition);
  const job = createCompositeWriteJob(members, duration, {
    ...options,
    owner: composition,
  });
  if (!job) return composition;
  const handle = members[0].board.animationScheduler.schedule(job);
  job.bind(handle);
  return composition;
}
