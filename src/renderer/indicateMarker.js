/**
 * [INPUT]: Native rendered paths and the active indicate presentation
 * [OUTPUT]: Temporary crisp marker paint for SVG, HTML and Canvas
 * [POS]: Renderer-only paint; owns no geometry and never writes visProp
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import Const from '../base/constants.js';

/** Closed semantics belong to the native element, not to arbitrary curve samples. */
export function markerHasInterior(element) {
    return element.elType !== 'polygonalchain' && (
        element.elementClass === Const.OBJECT_CLASS_AREA ||
        element.elementClass === Const.OBJECT_CLASS_CIRCLE ||
        element.elementClass === Const.OBJECT_CLASS_POINT ||
        ['angle', 'ellipse', 'sector', 'circumcirclesector'].includes(element.elType) ||
        element.visProp.element3d?.elType === 'face3d'
    );
}

export function paintMarkerCanvas(renderer, element, fill) {
    const marker = renderer._indicateMarker;
    if (!marker || marker.element !== element) return;
    if (fill !== markerHasInterior(element)) return;
    const context = renderer.context;
    context.save();
    try {
        context.globalAlpha = marker.pulse * 0.22;
        context.fillStyle = context.strokeStyle = marker.color;
        if (fill) context.fill('evenodd');
        else {
            context.lineWidth = Number(element.evalVisProp('strokewidth')) + 6;
            context.lineCap = 'butt';
            context.stroke();
        }
    } finally { context.restore(); }
}

/** Clone only the current native primitive, after projection and native clipping. */
export function markerSVG(board, element, node, color, pulse) {
    if (!['path', 'polygon', 'polyline', 'ellipse', 'circle', 'line'].includes(node.localName)) return;
    const overlay = node.cloneNode(false);
    overlay.removeAttribute('id');
    overlay.removeAttribute('filter');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('data-jxg-attention', 'indicate-marker');
    const set = (key, value) => overlay.style.setProperty(key, String(value), 'important');
    set('filter', 'none');
    set('pointer-events', 'none');
    set('opacity', pulse * 0.22);
    set('fill', markerHasInterior(element) ? color : 'none');
    set('fill-opacity', 1);
    set('stroke', markerHasInterior(element) ? 'none' : color);
    set('stroke-opacity', 1);
    set('stroke-width', Number(element.evalVisProp('strokewidth')) + 6);
    set('stroke-linecap', 'butt');
    node.after(overlay);
    board._attentionPresentation.set(overlay, () => overlay.remove());
}
