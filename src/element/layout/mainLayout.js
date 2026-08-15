import JXG from "../../jxg.js";
import {
    createLayoutFrame,
    readLayoutRatio,
    readNonNegativeLayoutNumber
} from "./layoutRegion.js";
import { createSemanticLayoutRegion, readSemanticSections } from "./semanticSection.js";
const DEFAULT_GAP = 0.4;
const DEFAULT_PADDING = 0.3;
const DEFAULT_FOOTER_RATIO = 0.14;
const DEFAULT_HEADER_RATIO = 0.12;
function createMainLayout(board, parents, attributes) {
    const sections = readMainLayoutSections(parents);
    const frame = createLayoutFrame(board, {
        gap: readNonNegativeLayoutNumber(attributes, "mainlayout", "gap", DEFAULT_GAP),
        padding: readNonNegativeLayoutNumber(
            attributes,
            "mainlayout",
            "padding",
            DEFAULT_PADDING
        ),
        footerRatio: readLayoutRatio(
            attributes,
            "mainlayout",
            "footerRatio",
            DEFAULT_FOOTER_RATIO
        ),
        headerRatio: readLayoutRatio(
            attributes,
            "mainlayout",
            "headerRatio",
            DEFAULT_HEADER_RATIO
        )
    });
    const body = sections
        ? createSemanticLayoutRegion(
              { name: "body", sections },
              {
                  left: frame.body.point(["left", "center"])[0],
                  right: frame.body.point(["right", "center"])[0],
                  bottom: frame.body.point(["center", "bottom"])[1],
                  top: frame.body.point(["center", "top"])[1]
              },
              "mainlayout body"
          )
        : frame.body;
    return Object.assign(new JXG.Composition({}), frame, { body });
}
function readMainLayoutSections(parents) {
    if (parents.length === 0) return undefined;
    const definition = parents[0];
    if (parents.length !== 1 || !isRecord(definition)) {
        throw new Error(
            "JSXGraph: mainlayout accepts no parents or one definition object. Example: board.create('mainlayout', [{ sections: { demonstration: 0.75, conclusion: 0.25 } }])."
        );
    }
    const unknownKeys = Object.keys(definition).filter((key) => key !== "sections");
    if (unknownKeys.length > 0) {
        throw new Error(
            `JSXGraph: mainlayout definition has unknown property "${unknownKeys[0]}". Allowed property is "sections".`
        );
    }
    return readSemanticSections("mainlayout", definition.sections);
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
JXG.registerElement("mainlayout", createMainLayout);
