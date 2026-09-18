/*
    Copyright 2008-2026
    SPDX-License-Identifier: LGPL-3.0-or-later OR MIT
 */

import JXG from "../jxg.js";
import { darkColors, lightColors } from "./color_tokens.js";

/*
    Contrast budget for this theme.

    A color token is a name, not a contrast guarantee: darkColors mirrors the
    light scale, so shades at the ends of the scale pass on one surface and fail
    on the other. Every color declared here must therefore keep at least 3:1
    (WCAG non-text contrast) against both surfaces, #ffffff in theme "light" and
    #020617 in theme "dark". That rules out the 300/400 shades of every family on
    the light surface and their mirrored shades on the dark surface, so structure
    uses 500 and darker while a fill may stay as faint as its own opacity says.

    Relative weight is part of the budget: grid and ticks are background
    structure and take the faintest shade that still passes, an axis is a reading
    reference and stays markedly stronger than the grid, and a highlight is one
    step off its own base color instead of a lighter tint of it.
*/
const colorProperties =
    /(^|\.)(color|fillcolor|fillcolorarray|highlightfillcolor|highlightstrokecolor|gradientsecondcolor|strokecolor)$/;

const adaptiveTheme = {
    elements: {
        strokeColor: "slate-700",
        highlightStrokeColor: "blue-500",
        fillColor: "none",
        highlightFillColor: "none"
    },
    angle: {
        strokeColor: "blue-600",
        fillColor: "blue-200",
        highlightStrokeColor: "blue-500",
        highlightFillColor: "blue-300",
        label: { strokeColor: "slate-900" }
    },
    arc: {
        strokeColor: "blue-600",
        highlightStrokeColor: "blue-500"
    },
    axis: {
        strokeColor: "slate-800",
        highlightStrokeColor: "slate-600",
        ticks: {
            strokeColor: "slate-500",
            highlightStrokeColor: "slate-500",
            label: { strokeColor: "slate-700" }
        }
    },
    circle: {
        strokeColor: "blue-600",
        highlightStrokeColor: "blue-500",
        highlightFillColor: "none",
        center: {
            fillColor: "red-600",
            strokeColor: "red-600",
            highlightFillColor: "red-500",
            highlightStrokeColor: "red-500"
        },
        point2: {
            fillColor: "red-600",
            strokeColor: "red-600",
            highlightFillColor: "red-500",
            highlightStrokeColor: "red-500"
        }
    },
    curve: {
        strokeColor: "blue-600",
        highlightStrokeColor: "blue-500"
    },
    grid: {
        strokeColor: "slate-500"
    },
    label: {
        strokeColor: "slate-900",
        highlightStrokeColor: "slate-700"
    },
    line: {
        strokeColor: "blue-600",
        highlightStrokeColor: "blue-500"
    },
    point: {
        fillColor: "red-600",
        strokeColor: "red-600",
        highlightFillColor: "red-500",
        highlightStrokeColor: "red-500"
    },
    polygon: {
        fillColor: "blue-200",
        highlightFillColor: "blue-300",
        borders: {
            strokeColor: "blue-600",
            highlightStrokeColor: "blue-500"
        }
    },
    slider: {
        // 上游 slider 默认值写死纯黑／纯白，主题解析只映射 token，对裸 hex 原样返回，
        // 因此深色 Board 上轨道会与背景同色。三段颜色必须在这里补全。
        strokeColor: "blue-600",
        fillColor: "white",
        strokeWidth: 2,
        baseline: {
            strokeColor: "slate-500",
            strokeWidth: 3
        },
        highline: {
            strokeColor: "blue-600",
            strokeWidth: 3
        },
        label: {
            strokeColor: "slate-900",
            highlightStrokeColor: "slate-700"
        }
    },
    ticks: {
        // 滑块刻度与独立 ticks 走 board.options.ticks，同样不能被上游纯黑默认值带走。
        strokeColor: "slate-500",
        label: { strokeColor: "slate-700" }
    },
    text: {
        strokeColor: "slate-900",
        highlightStrokeColor: "slate-700"
    }
};

JXG.colorThemes = {
    light: lightColors,
    dark: darkColors
};

JXG.themes.light = adaptiveTheme;
JXG.themes.dark = adaptiveTheme;

JXG.resolveThemeColor = function (value, theme, property) {
    let colors;

    if (!colorProperties.test(property.toLowerCase())) {
        return value;
    }

    colors = JXG.colorThemes[theme === "dark" ? "dark" : "light"];
    if (Array.isArray(value)) {
        return value.map(function (entry) {
            return Object.prototype.hasOwnProperty.call(colors, entry) ? colors[entry] : entry;
        });
    }
    return Object.prototype.hasOwnProperty.call(colors, value) ? colors[value] : value;
};

export default adaptiveTheme;
