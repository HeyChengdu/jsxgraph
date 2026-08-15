import JXG from "../../jxg.js";
import {
    createLayoutFrame,
    createLayoutRegion,
    readLayoutRatio,
    readNonNegativeLayoutNumber
} from "./layoutRegion.js";
import { createSemanticLayoutRegion, readSemanticSections } from "./semanticSection.js";
const DEFAULT_ASIDE_RATIO = 0.28;
const DEFAULT_GAP = 0.4;
const DEFAULT_PADDING = 0.3;
const DEFAULT_FOOTER_RATIO = 0.14;
const DEFAULT_HEADER_RATIO = 0.12;
function createMainAsideLayout(board, parents, attributes) {
    const sections = readMainAsideSections(parents);
    const gap = readNonNegativeLayoutNumber(attributes, "mainasidelayout", "gap", DEFAULT_GAP);
    const asideRatio = readLayoutRatio(
        attributes,
        "mainasidelayout",
        "asideRatio",
        DEFAULT_ASIDE_RATIO
    );
    const frame = createLayoutFrame(board, {
        gap,
        padding: readNonNegativeLayoutNumber(
            attributes,
            "mainasidelayout",
            "padding",
            DEFAULT_PADDING
        ),
        footerRatio: readLayoutRatio(
            attributes,
            "mainasidelayout",
            "footerRatio",
            DEFAULT_FOOTER_RATIO
        ),
        headerRatio: readLayoutRatio(
            attributes,
            "mainasidelayout",
            "headerRatio",
            DEFAULT_HEADER_RATIO
        )
    });
    const bodyLeft = frame.body.point(["left", "center"])[0];
    const bodyRight = frame.body.point(["right", "center"])[0];
    const bodyWidth = () => bodyRight() - bodyLeft();
    const asideLeft = () => bodyRight() - bodyWidth() * asideRatio;
    const leftMainBounds = {
        left: bodyLeft,
        right: () => asideLeft() - gap * 0.5,
        bottom: frame.body.point(["center", "bottom"])[1],
        top: frame.body.point(["center", "top"])[1]
    };
    const rightAsideBounds = {
        left: () => asideLeft() + gap * 0.5,
        right: bodyRight,
        bottom: frame.body.point(["center", "bottom"])[1],
        top: frame.body.point(["center", "top"])[1]
    };
    const leftMain = sections?.leftMain
        ? createSemanticLayoutRegion(
              { name: "leftMain", sections: sections.leftMain },
              leftMainBounds,
              "mainasidelayout leftMain"
          )
        : createLayoutRegion(leftMainBounds);
    const rightAside = sections?.rightAside
        ? createSemanticLayoutRegion(
              { name: "rightAside", sections: sections.rightAside },
              rightAsideBounds,
              "mainasidelayout rightAside"
          )
        : createLayoutRegion(rightAsideBounds);
    const body = Object.assign(frame.body, { leftMain, rightAside });
    return Object.assign(new JXG.Composition({}), frame, { body });
}
function readMainAsideSections(parents) {
    if (parents.length === 0) return undefined;
    const definition = parents[0];
    if (parents.length !== 1 || !isRecord(definition)) {
        throw new Error(
            "JSXGraph: mainasidelayout accepts no parents or one definition object. Example: board.create('mainasidelayout', [{ sections: { rightAside: { evidence: 0.7, conclusion: 0.3 } } }])."
        );
    }
    const unknownDefinitionKeys = Object.keys(definition).filter((key) => key !== "sections");
    if (unknownDefinitionKeys.length > 0) {
        throw new Error(
            `JSXGraph: mainasidelayout definition has unknown property "${unknownDefinitionKeys[0]}". Allowed property is "sections".`
        );
    }
    if (!isRecord(definition.sections)) {
        throw new Error(
            'JSXGraph: mainasidelayout "sections" must define "leftMain", "rightAside", or both.'
        );
    }
    const unknownRegion = Object.keys(definition.sections).find(
        (key) => key !== "leftMain" && key !== "rightAside"
    );
    if (unknownRegion) {
        throw new Error(
            `JSXGraph: mainasidelayout sections has unknown region "${unknownRegion}". Available regions are "leftMain" and "rightAside".`
        );
    }
    if (
        definition.sections.leftMain === undefined &&
        definition.sections.rightAside === undefined
    ) {
        throw new Error(
            'JSXGraph: mainasidelayout "sections" must define "leftMain", "rightAside", or both.'
        );
    }
    return {
        leftMain:
            definition.sections.leftMain === undefined
                ? undefined
                : readSemanticSections(
                      "mainasidelayout leftMain",
                      definition.sections.leftMain
                  ),
        rightAside:
            definition.sections.rightAside === undefined
                ? undefined
                : readSemanticSections(
                      "mainasidelayout rightAside",
                      definition.sections.rightAside
                  )
    };
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
JXG.registerElement("mainasidelayout", createMainAsideLayout);
