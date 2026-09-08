/** Board-owned lifecycle around an injected or browser-driven animation clock. */
export function createAnimationController(driver) {
    const entries = new Set();
    let disposed = false;
    const cancelAll = () => {
        const errors = [];
        for (const entry of [...entries]) {
            try { entry.cancel(); } catch (error) { errors.push(error); }
        }
        if (errors.length) throw new AggregateError(errors, 'JSXGraph: animation cleanup failed.');
    };
    const guard = action => {
        try { action(); } catch (error) {
            try { cancelAll(); } catch (cleanupError) {
                throw new AggregateError([error, cleanupError], 'JSXGraph: animation and cleanup failed.');
            }
            throw error;
        }
    };
    return {
        schedule(job) {
            if (disposed) throw new Error('JSXGraph: animation controller is disposed.');
            if (!Number.isFinite(job.duration) || job.duration < 0) {
                throw new Error('JSXGraph: animation duration must be finite and non-negative.');
            }
            let ended = false;
            let downstream;
            const clear = () => { ended = true; entries.delete(entry); };
            const entry = {
                cancel() {
                    if (ended) return;
                    clear();
                    try { downstream?.cancel(); } finally { job.cancel(); }
                },
            };
            entries.add(entry);
            try {
                downstream = driver.schedule({
                    duration: job.duration,
                    start() { if (!ended) guard(() => job.start()); },
                    update(progress) { if (!ended) guard(() => job.update(progress)); },
                    finish() {
                        if (ended) return;
                        guard(() => job.finish());
                        clear();
                    },
                    cancel() { if (!ended) { clear(); job.cancel(); } },
                });
                // Handles can be cancelled reentrantly during start or finish.
                if (ended) downstream.cancel();
            } catch (error) {
                try { entry.cancel(); } catch (cleanupError) {
                    throw new AggregateError([error, cleanupError], 'JSXGraph: animation and cleanup failed.');
                }
                throw error;
            }
            return entry;
        },
        cancelAll,
        dispose() {
            if (disposed) return;
            disposed = true;
            try { cancelAll(); } finally { driver.dispose(); }
        },
    };
}
