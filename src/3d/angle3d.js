/* Spatial angle markers reuse the native polygon projection and presentation lifecycle. */
import JXG from '../jxg.js';
import Type from '../utils/type.js';
import './polygon3d.js';

/**
 * The smaller spatial angle [A, B, C], with vertex B. Radius is in spatial units.
 * A right angle has a square marker; other angles have a sector marker.
 * Collinear or coincident rays have no unique plane and produce no marker.
 * @class Spatial angle defined by three points, with the middle point as vertex.
 * Create with view.create('angle3d', [A, B, C], attributes).
 * The marker lies in the plane of the two rays: right angles use a square,
 * other nondegenerate smaller angles use a sector. Camera rotation does not change the angle.
 * The radius attribute accepts a number or function in spatial units (default 0.35).
 * Nonpositive or nonfinite radii and collinear or coincident rays produce no marker.
 * Value() returns the smaller angle in radians; coincident rays return NaN.
 * Native indicate(duration) emphasizes the projected marker without changing its geometry.
 * @pseudo
 * @constructor
 * @name Angle3D
 * @type JXG.Angle3D
 * @augments JXG.Polygon3D
 * @param {Point3D|Array|Function_Point3D|Array|Function_Point3D|Array|Function} A,B,C First ray point, vertex, second ray point. Each input is a spatial point, a three-coordinate array, or a function returning three coordinates.
 * @example
 * // B, A and E are existing Point3D objects in the same view.
 * const angle = view.create('angle3d', [B, A, E], {
 *     withLabel: false, visible: false, radius: 0.36,
 *     fillColor: 'blue-600', fillOpacity: 0.12,
 *     borders: { strokeColor: 'blue-600', strokeWidth: 2.5 }
 * });
 * angle.setAttribute({ visible: true });
 * angle.indicate(1600);
 */
JXG.createAngle3D = function (board, parents, attributes) {
    const view = parents[0];
    if (parents.length !== 4) throw new Error('JSXGraph: angle3d requires three spatial points.');
    const points = Type.providePoints3D(view, parents.slice(1),
        { vertices: { visible: false, withLabel: false, fixed: true } }, 'polygon3d', ['vertices']);
    if (!points || points.length !== 3) throw new Error('JSXGraph: invalid angle3d points.');
    let el;
    const frame = () => {
        const coords = points.map(p => [p.X(), p.Y(), p.Z()]);
        const origin = coords[1];
        const u = coords[0].map((x, i) => x - origin[i]);
        const v = coords[2].map((x, i) => x - origin[i]);
        const a = Math.hypot(...u), b = Math.hypot(...v);
        const dot = u.reduce((s, x, i) => s + x * v[i], 0) / (a * b);
        const theta = Math.acos(Math.max(-1, Math.min(1, dot)));
        const unit = u.map(x => x / a);
        const perpendicular = v.map((x, i) => x / b - Math.cos(theta) * unit[i]);
        const length = Math.hypot(...perpendicular);
        return { origin, unit, normal: perpendicular.map(x => x / length), theta,
            valid: a > 1e-12 && b > 1e-12 && length > 1e-12 };
    };
    const radius = () => Type.evaluate(el ? el.visProp.radius : attributes.radius ?? 0.35);
    const vertices = Array.from({ length: 35 }, (_, index) => () => {
        const f = frame(), r = radius();
        if (!f.valid || !Number.isFinite(r) || r <= 0) return [NaN, NaN, NaN];
        let x = 0, y = 0;
        if (index > 0 && index < 34) {
            const t = (index - 1) / 32;
            if (Math.abs(f.theta - Math.PI / 2) < 1e-8) {
                x = r * Math.min(1, 2 - 2 * t);
                y = r * Math.min(1, 2 * t);
            } else {
                x = r * Math.cos(t * f.theta);
                y = r * Math.sin(t * f.theta);
            }
        }
        return f.origin.map((value, i) => value + x * f.unit[i] + y * f.normal[i]);
    });
    el = view.create('polygon3d', vertices, {
        ...attributes, radius: attributes.radius ?? 0.35,
        vertices: { visible: false, withLabel: false, fixed: true },
        fillOpacity: attributes.fillOpacity ?? 0.12,
    });
    el.elType = 'angle3d';
    /**
     * Return the smaller spatial angle in radians, or NaN for coincident rays.
     * @name Value
     * @memberOf JXG.Angle3D.prototype
     * @function
     * @returns {Number} Spatial angle in radians.
     */
    el.Value = () => frame().theta;
    el.setParents(points);
    for (const point of points) point.addChild(el);
    return el;
};
JXG.registerElement('angle3d', JXG.createAngle3D);

/**
 * Marker radius in spatial units. Nonpositive or nonfinite values hide the marker.
 * @name radius
 * @memberOf Angle3D
 * @type Number|Function
 * @default 0.35
 * @visprop
 */
