/** Default Board animation scheduler; hosts may inject the same contract at initialization. */
export function createAnimationScheduler(board) {
  const jobs = new Set();
  const host = board.containerObj.ownerDocument.defaultView;
  let timer;
  const stopTimer = () => {
    if (timer !== undefined && jobs.size === 0) {
      host.clearInterval(timer);
      timer = undefined;
    }
  };
  return {
    schedule(job) {
      const start = host.performance.now();
      let ended = false;
      const entry = {
        job,
        start,
        finish: () => {
          if (ended) return;
          // Keep the job cancellable until its terminal effect succeeds.
          job.finish();
          ended = true;
          jobs.delete(entry);
        },
        cancel: () => {
          if (ended) return;
          ended = true;
          jobs.delete(entry);
          job.cancel();
          stopTimer();
        },
      };
      try {
        job.start();
        if (job.duration === 0) {
          job.update(1);
          entry.finish();
          board.update();
          ended = true;
          return { cancel: entry.cancel };
        }
      } catch (error) {
        entry.cancel();
        throw error;
      }
      jobs.add(entry);
      if (timer === undefined) {
        timer = host.setInterval(() => {
          const now = host.performance.now();
          try {
            for (const item of [...jobs]) {
              if (!jobs.has(item)) continue;
              const progress = Math.min(
                1,
                (now - item.start) / item.job.duration
              );
              item.job.update(progress);
              if (progress === 1) item.finish();
            }
            board.update();
          } catch (error) {
            for (const item of [...jobs]) item.cancel();
            throw error;
          } finally {
            stopTimer();
          }
        }, board.attr.animationdelay);
      }
      try {
        board.update();
      } catch (error) {
        entry.cancel();
        throw error;
      }
      return { cancel: entry.cancel };
    },
    dispose() {
      for (const entry of [...jobs]) entry.cancel();
      stopTimer();
    },
  };
}
