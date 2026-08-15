import JXG from "../../jxg.js";
import {
    createBoardRegion,
    createLayoutRegion,
    readLayoutRatio,
    readNonNegativeLayoutNumber
} from "./layoutRegion.js";
import { createSemanticLayoutRegion, readSemanticSections } from "./semanticSection.js";
const DEFAULT_GAP = 0.55;
const DEFAULT_PADDING = 0.3;
const DEFAULT_FOOTER_RATIO = 0.14;
const DEFAULT_HEADER_RATIO = 0.12;
function createStepFlowLayout(board, parents, attributes) {
    const definition = readStepFlowDefinition(parents);
    const stepNames = definition.steps;
    const gap = readNonNegativeLayoutNumber(attributes, "stepflowlayout", "gap", DEFAULT_GAP);
    const padding = readNonNegativeLayoutNumber(
        attributes,
        "stepflowlayout",
        "padding",
        DEFAULT_PADDING
    );
    const footerRatio = readLayoutRatio(
        attributes,
        "stepflowlayout",
        "footerRatio",
        DEFAULT_FOOTER_RATIO
    );
    const headerRatio = readLayoutRatio(
        attributes,
        "stepflowlayout",
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
    const bodyRegion = createLayoutRegion({
        left: innerLeft,
        right: innerRight,
        bottom: bodyBottom,
        top: bodyTop
    });
    const stepWidth = () =>
        (innerRight() - innerLeft() - gap * (stepNames.length - 1)) / stepNames.length;
    const steps = new Map();
    const stepRegions = new Map();
    for (const [index, name] of stepNames.entries()) {
        const left = () => innerLeft() + index * (stepWidth() + gap);
        const right = () => left() + stepWidth();
        const bounds = { left, right, bottom: bodyBottom, top: bodyTop };
        const region = createLayoutRegion(bounds);
        stepRegions.set(name, region);
        steps.set(
            name,
            createSemanticLayoutRegion(
                { name, sections: definition.sections },
                bounds,
                "stepflowlayout step"
            )
        );
    }
    const requireStep = (name) => {
        const step = steps.get(name);
        if (!step) throwUnknownStep(name, stepNames);
        return step;
    };
    const requireStepRegion = (name) => {
        const region = stepRegions.get(name);
        if (!region) throwUnknownStep(name, stepNames);
        return region;
    };
    const body = Object.assign(bodyRegion, {
        step: requireStep,
        between(from, to) {
            return [
                requireStepRegion(from).point(["right", "center"]),
                requireStepRegion(to).point(["left", "center"])
            ];
        }
    });
    return Object.assign(new JXG.Composition({}), {
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
        stepNames
    });
}
function readStepFlowDefinition(parents) {
    const definition = parents[0];
    if (parents.length !== 1 || !isRecord(definition)) {
        throw new Error(
            "JSXGraph: stepflowlayout requires one definition object. Example: board.create('stepflowlayout', [{ steps: ['question', 'answer'] }])."
        );
    }
    const unknownKeys = Object.keys(definition).filter(
        (key) => key !== "steps" && key !== "sections"
    );
    if (unknownKeys.length > 0) {
        throw new Error(
            `JSXGraph: stepflowlayout definition has unknown property "${unknownKeys[0]}". Allowed properties are "steps" and "sections".`
        );
    }
    const steps = definition.steps;
    if (
        !Array.isArray(steps) ||
        steps.length < 2 ||
        !steps.every((name) => typeof name === "string" && name.length > 0)
    ) {
        throw new Error(
            'JSXGraph: stepflowlayout "steps" must contain at least two non-empty names in order.'
        );
    }
    const duplicate = steps.find((name, index) => steps.indexOf(name) !== index);
    if (duplicate) {
        throw new Error(
            `JSXGraph: stepflowlayout step name "${duplicate}" is duplicated. Step names must be unique.`
        );
    }
    return {
        steps: [steps[0], steps[1], ...steps.slice(2)],
        sections:
            definition.sections === undefined
                ? undefined
                : readSemanticSections("stepflowlayout", definition.sections)
    };
}
function throwUnknownStep(name, stepNames) {
    throw new Error(
        `JSXGraph: stepflowlayout has no step named "${name}". Available steps: ${stepNames.map((stepName) => `"${stepName}"`).join(", ")}.`
    );
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
JXG.registerElement("stepflowlayout", createStepFlowLayout);
