/*
    Copyright 2008-2026
    SPDX-License-Identifier: LGPL-3.0-or-later OR MIT
 */

import JXG from "../jxg.js";
import { darkColors, lightColors } from "./color_tokens.js";

const colorProperties =
    /(^|\.)(color|fillcolor|fillcolorarray|highlightfillcolor|highlightstrokecolor|gradientsecondcolor|strokecolor)$/;

const adaptiveTheme = {
    elements: {
        strokeColor: "slate-700",
        highlightStrokeColor: "blue-400",
        fillColor: "none",
        highlightFillColor: "none"
    },
    angle: {
        strokeColor: "blue-600",
        fillColor: "blue-200",
        highlightStrokeColor: "blue-400",
        highlightFillColor: "blue-300",
        label: { strokeColor: "slate-900" }
    },
    arc: {
        strokeColor: "blue-600",
        highlightStrokeColor: "blue-400"
    },
    axis: {
        strokeColor: "slate-600",
        highlightStrokeColor: "slate-500",
        ticks: {
            strokeColor: "slate-500",
            highlightStrokeColor: "slate-400",
            label: { strokeColor: "slate-700" }
        }
    },
    circle: {
        strokeColor: "blue-600",
        highlightStrokeColor: "blue-400",
        highlightFillColor: "none",
        center: {
            fillColor: "red-600",
            strokeColor: "red-600",
            highlightFillColor: "red-400",
            highlightStrokeColor: "red-400"
        },
        point2: {
            fillColor: "red-600",
            strokeColor: "red-600",
            highlightFillColor: "red-400",
            highlightStrokeColor: "red-400"
        }
    },
    curve: {
        strokeColor: "blue-600",
        highlightStrokeColor: "blue-400"
    },
    grid: {
        strokeColor: "slate-300"
    },
    line: {
        strokeColor: "blue-600",
        highlightStrokeColor: "blue-400"
    },
    point: {
        fillColor: "red-600",
        strokeColor: "red-600",
        highlightFillColor: "red-400",
        highlightStrokeColor: "red-400"
    },
    polygon: {
        fillColor: "blue-200",
        highlightFillColor: "blue-300",
        borders: {
            strokeColor: "blue-600",
            highlightStrokeColor: "blue-400"
        }
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
