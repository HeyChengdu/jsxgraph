import JXG from "../../jxg.js";
import {
    createBoardRegion,
    createLayoutRegion,
    readLayoutRatio,
    readNonNegativeLayoutNumber
} from "./layoutRegion.js";
import { createSemanticLayoutRegion, readSemanticSections } from "./semanticSection.js";
const DEFAULT_GAP = 0.6;
const DEFAULT_PADDING = 0.3;
const DEFAULT_FOOTER_RATIO = 0.14;
const DEFAULT_HEADER_RATIO = 0.12;
function createComparisonLayout(board, parents, attributes) {
    const definition = readComparisonDefinition(parents);
    const gap = readNonNegativeLayoutNumber(attributes, "comparisonlayout", "gap", DEFAULT_GAP);
    const padding = readNonNegativeLayoutNumber(
        attributes,
        "comparisonlayout",
        "padding",
        DEFAULT_PADDING
    );
    const footerRatio = readLayoutRatio(
        attributes,
        "comparisonlayout",
        "footerRatio",
        DEFAULT_FOOTER_RATIO
    );
    const headerRatio = readLayoutRatio(
        attributes,
        "comparisonlayout",
        "headerRatio",
        DEFAULT_HEADER_RATIO
    );
    const inner = createBoardRegion(board, padding);
    const innerLeft = inner.point(["left", "center"])[0];
    const innerRight = inner.point(["right", "center"])[0];
    const innerTop = inner.point(["center", "top"])[1];
    const innerBottom = inner.point(["center", "bottom"])[1];
    const footerTop = () => innerBottom() + (innerTop() - innerBottom()) * footerRatio;
    const headerBottom = () => innerTop() - (innerTop() - innerBottom()) * headerRatio;
    const bodyBottom = () => footerTop() + gap * 0.5;
    const bodyTop = () => headerBottom() - gap * 0.5;
    const contentWidth = () => innerRight() - innerLeft();
    const panelCount = definition.panels.length;
    const panelWidth = () => (contentWidth() - gap * (panelCount - 1)) / panelCount;
    const panels = new Map();
    for (const [index, name] of definition.panels.entries()) {
        const left = () => innerLeft() + index * (panelWidth() + gap);
        const right = () => left() + panelWidth();
        panels.set(
            name,
            createPanel(
                { name, sections: definition.sections },
                left,
                right,
                bodyBottom,
                bodyTop
            )
        );
    }
    const panelNames = definition.panels;
    const composition = new JXG.Composition({});
    const body = Object.assign(
        createLayoutRegion({
            left: innerLeft,
            right: innerRight,
            bottom: bodyBottom,
            top: bodyTop
        }),
        {
            panel(name) {
                const panel = panels.get(name);
                if (!panel) {
                    throw new Error(
                        `JSXGraph: comparisonlayout has no panel named "${name}". Available panels: ${panelNames.map((panelName) => `"${panelName}"`).join(", ")}.`
                    );
                }
                return panel;
            }
        }
    );
    return Object.assign(composition, {
        header: createLayoutRegion({
            left: innerLeft,
            right: innerRight,
            bottom: headerBottom,
            top: innerTop
        }),
        body,
        footer: createLayoutRegion({
            left: innerLeft,
            right: innerRight,
            bottom: innerBottom,
            top: footerTop
        }),
        panelNames
    });
}
function createPanel(definition, left, right, bottom, top) {
    return createSemanticLayoutRegion(
        definition,
        { left, right, bottom, top },
        "comparisonlayout panel"
    );
}
function readComparisonDefinition(parents) {
    const definition = parents[0];
    if (parents.length !== 1 || !isRecord(definition)) {
        throw new Error(
            "JSXGraph: comparisonlayout requires one definition object. Example: board.create('comparisonlayout', [{ panels: ['groundFrame', 'planeFrame'] }])."
        );
    }
    const unknownKeys = Object.keys(definition).filter(
        (key) => key !== "panels" && key !== "sections"
    );
    if (unknownKeys.length > 0) {
        throw new Error(
            `JSXGraph: comparisonlayout definition has unknown property "${unknownKeys[0]}". Allowed properties are "panels" and "sections".`
        );
    }
    const panels = definition.panels;
    if (
        !Array.isArray(panels) ||
        panels.length < 2 ||
        !panels.every((name) => typeof name === "string" && name.length > 0)
    ) {
        throw new Error(
            'JSXGraph: comparisonlayout "panels" must contain at least two non-empty names.'
        );
    }
    const duplicate = panels.find((name, index) => panels.indexOf(name) !== index);
    if (duplicate) {
        throw new Error(
            `JSXGraph: comparisonlayout panel name "${duplicate}" is duplicated. Panel names must be unique.`
        );
    }
    return {
        panels: [panels[0], panels[1], ...panels.slice(2)],
        sections:
            definition.sections === undefined
                ? undefined
                : readSemanticSections("comparisonlayout", definition.sections)
    };
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
JXG.registerElement("comparisonlayout", createComparisonLayout);
