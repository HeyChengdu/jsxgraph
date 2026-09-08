/** Finite mathematical-state animations. Only the Board scheduler owns time. */
import Const from '../base/constants.js';
import Numerics from '../math/numerics.js';
import Type from './type.js';
import Color from './color.js';
import JXG from '../jxg.js';
import { addLegacyAnimation, removeLegacyAnimation } from './legacyAnimation.js';

const active = new WeakMap();

export function cancelStateAnimations(element, channel) {
    const channels = active.get(element);
    if (!channels) return;
    for (const [name, handle] of [...channels]) {
        if (channel === undefined || channel === name) handle.cancel();
    }
}

function durationValue(duration) {
    if (!Number.isFinite(duration) || duration < 0) {
        throw new Error('JSXGraph: animation duration must be finite and non-negative.');
    }
    return duration;
}

function run(element, channel, duration, update, callback) {
    durationValue(duration);
    if (callback !== undefined && typeof callback !== 'function') {
        throw new Error('JSXGraph: animation callback must be a function.');
    }
    let channels = active.get(element);
    if (!channels) active.set(element, channels = new Map());
    let handle;
    let ended = false;
    const clear = () => {
        ended = true;
        if (channels.get(channel) === handle) channels.delete(channel);
    };
    // Mutation starts inside schedule: a rejected host scope leaves existing work intact.
    handle = element.board.animationScheduler.schedule({
        duration,
        start() {
            cancelStateAnimations(element, channel);
            if (channel === 'position') removeLegacyAnimation(element);
        },
        update(progress) { if (!ended) update(progress); },
        finish() { clear(); callback?.call(element); },
        // Unlike presentation effects, cancellation retains the current mathematical state.
        cancel: clear,
    });
    if (!ended) channels.set(channel, handle);
    return element;
}

function coordinate(value) {
    const coords = Type.isPoint(value) ? [value.X(), value.Y()] : value;
    if (!Array.isArray(coords) || ![2, 3].includes(coords.length) ||
        !coords.every(Number.isFinite) || (coords.length === 3 && coords[0] === 0)) {
        throw new Error('JSXGraph: motion requires finite affine coordinates.');
    }
    return coords.length === 2 ? coords.slice() : [coords[1] / coords[0], coords[2] / coords[0]];
}

function easing(effect = '--') {
    switch (effect) {
        case '--': case '==': return x => x;
        case '<': return x => x * x * x;
        case '>': return x => 1 - Math.pow(1 - x, 3);
        case '<>': return x => Math.pow(Math.sin(x * Math.PI / 2), 2);
        default:
            JXG.warn('JSXGraph: unsupported motion effect; using linear interpolation.');
            return x => x;
    }
}

function position(element, coords) {
    element.setPositionDirectly(Const.COORDS_BY_USER, coordinate(coords));
    // Commit the dependency graph before observers or completion callbacks read it.
    // An injected clock need not render a frame (for example, timeline rehearsal).
    element.board.update(element);
}

export function moveTo(element, where, duration = 0, options = {}, returning = false) {
    const target = coordinate(where);
    const origin = coordinate(element.coords.usrCoords);
    const ease = easing(options.effect);
    const repeat = options.repeat === undefined ? 1 : options.repeat;
    if (returning && (!Number.isInteger(repeat) || repeat < 1)) {
        throw new Error('JSXGraph: visit repeat must be a positive integer.');
    }
    return run(element, 'position', duration, progress => {
        let phase = progress;
        if (returning) {
            const cycle = progress === 1 ? 0 : (progress * repeat) % 1;
            phase = 1 - Math.abs(2 * cycle - 1);
        }
        const amount = ease(phase);
        position(element, origin.map((v, i) => v + (target[i] - v) * amount));
    }, options.callback);
}

export function moveAlong(element, path, duration = 0, options = {}) {
    let sample;
    if (typeof path === 'function') {
        if (!element.board.externalAnimationScheduler) {
            cancelStateAnimations(element, 'position');
            element.animationPath = path;
            element.animationCallback = options.callback;
            addLegacyAnimation(element.board, element);
            return element;
        }
        sample = progress => path(progress * duration);
    } else {
        if (!Array.isArray(path) || path.length === 0) {
            throw new Error('JSXGraph: motion path must not be empty.');
        }
        const points = path.map(coordinate);
        if (points.length === 1) sample = () => points[0];
        else if (options.interpolate === false) {
            sample = progress => {
                const offset = progress * (points.length - 1);
                const index = Math.min(Math.floor(offset), points.length - 2);
                const fraction = offset - index;
                return points[index].map((v, axis) => v + (points[index + 1][axis] - v) * fraction);
            };
        } else {
            const curve = Numerics.Neville(points.map(p => ({ X: () => p[0], Y: () => p[1] })));
            sample = progress => [curve[0](progress * curve[3]()), curve[1](progress * curve[3]())];
        }
    }
    return run(element, 'position', duration, progress => position(element, sample(progress)), options.callback);
}

export function animateAttributes(element, attributes, duration = 0, options = {}) {
    const interpolators = Object.entries(attributes).map(([key, target]) => {
        const name = key.toLowerCase();
        const initial = Type.evaluate(element.visProp[name]);
        if (name === 'strokecolor' || name === 'fillcolor') {
            const resolve = value => JXG.resolveThemeColor(value, element.board.attr.theme, name);
            const style = element.board.containerObj.ownerDocument.createElement('span').style;
            const valid = value => { style.color = ''; style.color = value; return style.color !== ''; };
            if (!valid(resolve(initial)) || !valid(resolve(target))) {
                throw new Error('JSXGraph: animated colors must resolve to CSS colors.');
            }
            return [name, progress => {
                if (progress === 1) return target;
                const from = resolve(initial);
                const to = resolve(target);
                // Preserve the legacy HSV interpolation for its supported RGB color syntax.
                if (Color.rgbParser(from).length === 3 && Color.rgbParser(to).length === 3) {
                    const start = Color.rgb2hsv(from);
                    const end = Color.rgb2hsv(to);
                    return Color.hsv2rgb(...start.map((v, i) => v + (end[i] - v) * progress));
                }
                // CSS computes color only; progress still belongs exclusively to the scheduler.
                return `color-mix(in srgb, ${from}, ${to} ${progress * 100}%)`;
            }];
        }
        const from = parseFloat(initial);
        const to = parseFloat(target);
        if (!['strokeopacity', 'fillopacity', 'strokewidth', 'size'].includes(name) ||
            (name === 'size' && !Type.isPoint(element)) ||
            !Number.isFinite(from) || !Number.isFinite(to)) return null;
        return [name, progress => from + (to - from) * progress];
    }).filter(Boolean);
    return run(element, 'attributes', duration, progress => {
        element.setAttribute(Object.fromEntries(interpolators.map(([name, sample]) => [name, sample(progress)])));
    }, options.callback);
}

export function startGlider(element, direction, stepCount, delay = 250, maxRounds = -1) {
    direction = Type.evaluate(direction);
    stepCount = Type.evaluate(stepCount);
    delay = Type.evaluate(delay);
    maxRounds = Type.evaluate(maxRounds);
    if (element.type !== Const.OBJECT_TYPE_GLIDER) return element;
    if (![1, -1].includes(direction) || !Number.isFinite(stepCount) || stepCount < 1 ||
        !Number.isFinite(delay) || delay <= 0 ||
        !(maxRounds === Infinity || Number.isInteger(maxRounds))) {
        throw new Error('JSXGraph: invalid glider animation parameters.');
    }
    const infinite = maxRounds < 0 || maxRounds === Infinity;
    if (infinite && element.board.externalAnimationScheduler) {
        throw new Error('JSXGraph: externally scheduled glider animation requires finite rounds.');
    }
    if (maxRounds === 0) return element;
    const parent = element.slideObject;
    const kind = parent.elementClass;
    if (![Const.OBJECT_CLASS_LINE, Const.OBJECT_CLASS_CIRCLE, Const.OBJECT_CLASS_CURVE].includes(kind)) {
        throw new Error('JSXGraph: unsupported glider path.');
    }
    const rounds = infinite ? 1 : maxRounds;
    return run(element, 'position', stepCount * delay * rounds, progress => {
        const cycle = progress === 1 ? 1 : (progress * rounds) % 1;
        const phase = direction > 0 ? cycle : 1 - cycle;
        let coords;
        if (kind === Const.OBJECT_CLASS_LINE) {
            coords = [parent.point1.X() + (parent.point2.X() - parent.point1.X()) * phase,
                parent.point1.Y() + (parent.point2.Y() - parent.point1.Y()) * phase];
        } else if (kind === Const.OBJECT_CLASS_CIRCLE) {
            const angle = -phase * 2 * Math.PI;
            coords = [parent.center.X() + parent.Radius() * Math.cos(angle),
                parent.center.Y() + parent.Radius() * Math.sin(angle)];
        } else {
            const parameter = parent.minX() + (parent.maxX() - parent.minX()) * phase;
            coords = [parent.X(parameter), parent.Y(parameter)];
        }
        position(element, coords);
    }, infinite ? () => startGlider(element, direction, stepCount, delay, maxRounds) : undefined);
}
