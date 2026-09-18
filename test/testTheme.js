/*
    Copyright 2008-2026
    SPDX-License-Identifier: LGPL-3.0-or-later OR MIT
 */

// oklch 与 hex 都换算到 sRGB，再算 WCAG 相对亮度与对比度。
function parseSrgb(value) {
    var match, lightness, chroma, hue, a, b, coneL, coneM, coneS, encode;

    if (value.charAt(0) === "#") {
        return [1, 3, 5].map(function (index) {
            return parseInt(value.slice(index, index + 2), 16) / 255;
        });
    }

    match = /oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/.exec(value);
    if (!match) {
        throw new Error("无法解析颜色：" + value);
    }
    lightness = Number(match[1]) / 100;
    chroma = Number(match[2]);
    hue = (Number(match[3]) * Math.PI) / 180;
    a = chroma * Math.cos(hue);
    b = chroma * Math.sin(hue);
    coneL = Math.pow(lightness + 0.3963377774 * a + 0.2158037573 * b, 3);
    coneM = Math.pow(lightness - 0.1055613458 * a - 0.0638541728 * b, 3);
    coneS = Math.pow(lightness - 0.0894841775 * a - 1.291485548 * b, 3);
    encode = function (channel) {
        channel = Math.min(1, Math.max(0, channel));
        return channel <= 0.0031308 ? 12.92 * channel : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
    };
    return [
        encode(4.0767416621 * coneL - 3.3077115913 * coneM + 0.2309699292 * coneS),
        encode(-1.2684380046 * coneL + 2.6097574011 * coneM - 0.3413193965 * coneS),
        encode(-0.0041960863 * coneL - 0.7034186147 * coneM + 1.707614701 * coneS)
    ];
}

function relativeLuminance(srgb) {
    var channel = function (value) {
        return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    };

    return 0.2126 * channel(srgb[0]) + 0.7152 * channel(srgb[1]) + 0.0722 * channel(srgb[2]);
}

function contrastOf(color, surface) {
    var front = relativeLuminance(parseSrgb(color)),
        back = relativeLuminance(surface);

    return (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05);
}

// 收集主题树中承担指定角色的 token 值，例如每条 strokeColor 与顶层 color。
function collectThemeTokens(keyPattern) {
    var tokens = {};

    (function collect(node) {
        Object.keys(node).forEach(function (key) {
            var value = node[key];

            if (value && typeof value === "object") {
                collect(value);
            } else if (typeof value === "string" && keyPattern.test(key.toLowerCase())) {
                tokens[value] = true;
            }
        });
    })(JXG.themes.dark);

    return tokens;
}

describe("Adaptive color themes", function () {
    var board, container;

    beforeEach(function () {
        container = document.createElement("div");
        container.id = "theme-box";
        container.style.width = "100px";
        container.style.height = "100px";
        document.body.appendChild(container);
        board = JXG.JSXGraph.initBoard("theme-box", {
            renderer: "no",
            theme: "light",
            resize: { enabled: false },
            showCopyright: false,
            showNavigation: false
        });
    });

    afterEach(function () {
        JXG.JSXGraph.freeBoard(board);
        container.remove();
    });

    it("resolves Tailwind tokens through the active theme", function () {
        var point = board.create("point", [0, 0], { strokeColor: "blue-400" }),
            lightColor = point.evalVisProp("strokeColor");

        board.setTheme("dark");

        expect(point.visProp.strokecolor).toEqual("blue-400");
        expect(point.evalVisProp("strokeColor")).not.toEqual(lightColor);
    });

    it("keeps explicit CSS colors unchanged", function () {
        var point = board.create("point", [0, 0], { strokeColor: "#123456" });

        board.setTheme("dark");

        expect(point.evalVisProp("strokeColor")).toEqual("#123456");
    });

    it("resolves point label colors through the active theme", function () {
        var point = board.create("point", [0, 0], { withLabel: true, name: "L" }),
            lightColor = point.label.evalVisProp("strokeColor");

        board.setTheme("dark");

        expect(point.label.visProp.strokecolor).toEqual("slate-900");
        expect(point.label.evalVisProp("strokeColor")).not.toEqual(lightColor);
    });

    it("resolves slider track colors through the active theme", function () {
        var slider = board.create("slider", [[-3, 1], [3, 1], [0, 1, 2]], {
            name: "s",
            withLabel: true
        }),
            lightHighline = slider.highline.evalVisProp("strokeColor");

        // 上游 slider 默认值写死 #000000，深色 Board 上轨道会与背景同色。
        expect(slider.baseline.evalVisProp("strokeColor")).not.toEqual("#000000");
        expect(lightHighline).not.toEqual("#000000");

        board.setTheme("dark");

        expect(slider.baseline.evalVisProp("strokeColor")).not.toEqual("#000000");
        expect(slider.highline.evalVisProp("strokeColor")).not.toEqual("#000000");
        expect(slider.highline.evalVisProp("strokeColor")).not.toEqual(lightHighline);
        expect(slider.evalVisProp("fillColor")).not.toEqual("#ffffff");
    });

    it("keeps every stroke token declared by the theme readable on both surfaces", function () {
        // 主题里声明的每条描边／文字色（含高亮态）都要在亮底与深底上达到 3:1
        // 非文本对比度。填充色不在此列：它由自己的不透明度表示，边界由描边承担。
        // 这里按 sRGB 相对亮度自行换算，不依赖浏览器对 oklch 的支持。
        var tokens = collectThemeTokens(/strokecolor$|^color$/);

        expect(Object.keys(tokens).length).toBeGreaterThan(8);
        Object.keys(tokens).forEach(function (token) {
            ["light", "dark"].forEach(function (theme) {
                var palette = JXG.colorThemes[theme],
                    surface = theme === "light" ? [1, 1, 1] : [2 / 255, 6 / 255, 23 / 255],
                    ratio;

                // 只检查真正进了色表的 token；"inherit" 一类控制值不参与对比度。
                if (!Object.prototype.hasOwnProperty.call(palette, token)) {
                    return;
                }
                ratio = contrastOf(palette[token], surface);
                expect(
                    ratio,
                    token + " 在 " + theme + " 主题下只有 " + ratio.toFixed(2) + ":1"
                ).toBeGreaterThan(3);
            });
        });
    });

    it("trusts the mirror except where it is calibrated, and never weakens a token", function () {
        // 深色主题允许对浅色档位做人工校准，但不得比机械镜像更弱，
        // 否则校准就成了又一次降低可读性。镜像按色阶两端配对计算。
        var opposite = { 50: 950, 100: 900, 200: 800, 300: 700, 400: 600, 500: 500 },
            surface = [2 / 255, 6 / 255, 23 / 255],
            structural = collectThemeTokens(/strokecolor$|^color$/);

        Object.keys(JXG.colorThemes.dark).forEach(function (token) {
            var match = token.match(/^(.*)-(50|100|200|300|400|500|600|700|800|900|950)$/),
                mirrored,
                partner;

            // 只对结构色要求单调；填充色在暗色下本来就可以比镜像更弱。
            if (!match || !structural[token]) {
                return;
            }
            partner = Number(match[2]);
            partner = opposite[partner] !== undefined ? opposite[partner] : 1000 - partner;
            mirrored = JXG.colorThemes.dark[match[1] + "-" + partner];
            expect(
                contrastOf(JXG.colorThemes.dark[token], surface),
                token + " 的校准值比镜像 " + match[1] + "-" + partner + " 更弱"
            ).toBeGreaterThanOrEqual(contrastOf(mirrored, surface));
        });
    });

    it("rejects runtime switching for legacy themes", function () {
        JXG.JSXGraph.freeBoard(board);
        board = JXG.JSXGraph.initBoard("theme-box", {
            renderer: "no",
            resize: { enabled: false },
            showCopyright: false,
            showNavigation: false
        });

        expect(function () {
            board.setTheme("dark");
        }).toThrowError();
    });
});
