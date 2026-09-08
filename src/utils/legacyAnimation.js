/** Compatibility for queued animationPath/animationData; the Board clock still owns all time. */
import Const from '../base/constants.js';
import Type from './type.js';

const states = new WeakMap();

export function advanceLegacyAnimations(board) {
    for (const [id, element] of Object.entries(board.animationObjects)) {
        if (!element) { delete board.animationObjects[id]; continue; }
        element._legacyAnimationElapsed = (element._legacyAnimationElapsed || 0) + board.attr.animationdelay;
        if (element.animationPath) {
            const path = element.animationPath;
            const coords = typeof path === 'function' ? path(element._legacyAnimationElapsed) : path.pop();
            if (!Type.exists(coords) || (!Array.isArray(coords) && Number.isNaN(coords))) {
                delete element.animationPath;
            } else {
                element.setPositionDirectly(Const.COORDS_BY_USER, coords);
                element.fullUpdate();
            }
        }
        if (element.animationData) {
            for (const [name, values] of Object.entries(element.animationData)) {
                const value = values.pop();
                if (value === undefined) delete element.animationData[name];
                else element.setAttribute({ [name]: value });
            }
            if (Object.keys(element.animationData).length === 0) delete element.animationData;
        }
        if (!element.animationPath && !element.animationData) {
            delete board.animationObjects[element.id];
            const callback = element.animationCallback;
            element.animationCallback = null;
            callback?.call(element);
        }
    }
    board.update();
    return board;
}

export function addLegacyAnimation(board, element) {
    // Legacy function paths have no finite duration. Their external-host restriction is unchanged.
    if (board.externalAnimationScheduler) {
        throw new Error('JSXGraph: this legacy animation is not supported by the external scheduler.');
    }
    board.animationObjects[element.id] = element;
    element._legacyAnimationElapsed = 0;
    if (states.has(board)) return board;
    const state = { handle: undefined, stopped: false };
    states.set(board, state);
    const step = () => {
        state.handle = board.animationScheduler.schedule({
            duration: board.attr.animationdelay,
            start() {},
            update() {},
            finish() {
                advanceLegacyAnimations(board);
                if (!state.stopped && Object.keys(board.animationObjects).length) step();
                else states.delete(board);
            },
            cancel() {
                state.stopped = true;
                states.delete(board);
                for (const id of Object.keys(board.animationObjects)) delete board.animationObjects[id];
            },
        });
    };
    step();
    return board;
}

export function removeLegacyAnimation(element) {
    delete element.board.animationObjects[element.id];
}
