import { createLayoutRegion, projectLayoutRegion } from "./layoutRegion.js";
const SECTION_RATIO_TOLERANCE = 1e-9;
export function createSemanticLayoutRegion(definition, bounds, owner) {
    const region = createLayoutRegion(bounds);
    if (!definition.sections) return region;
    const sectionEntries = Object.entries(definition.sections);
    let consumedRatio = 0;
    const sections = new Map();
    for (const [name, ratio] of sectionEntries) {
        const sectionTopRatio = 1 - consumedRatio;
        consumedRatio += ratio;
        sections.set(
            name,
            createLayoutRegion({
                left: bounds.left,
                right: bounds.right,
                bottom: projectLayoutRegion(region, [0.5, 1 - consumedRatio])[1],
                top: projectLayoutRegion(region, [0.5, sectionTopRatio])[1]
            })
        );
    }
    return Object.assign(region, {
        sectionNames: sectionEntries.map(([name]) => name),
        section(name) {
            const section = sections.get(name);
            if (!section) {
                throw new Error(
                    `JSXGraph: ${owner} "${definition.name}" has no section named "${name}". Available sections: ${sectionEntries.map(([sectionName]) => `"${sectionName}"`).join(", ")}.`
                );
            }
            return section;
        }
    });
}
export function readSemanticSections(owner, value) {
    if (!isRecord(value)) {
        throw new Error(
            `JSXGraph: ${owner} sections must be an object mapping semantic names to ratios.`
        );
    }
    const entries = Object.entries(value);
    if (entries.length < 2) {
        throw new Error(
            `JSXGraph: ${owner} must define at least two sections; omit "sections" for one full region.`
        );
    }
    let totalRatio = 0;
    const sections = {};
    for (const [name, ratio] of entries) {
        if (name.length === 0) {
            throw new Error(`JSXGraph: ${owner} section names must be non-empty.`);
        }
        if (typeof ratio !== "number" || !Number.isFinite(ratio) || ratio <= 0) {
            throw new RangeError(
                `JSXGraph: ${owner} section "${name}" ratio must be a positive finite number.`
            );
        }
        totalRatio += ratio;
        sections[name] = ratio;
    }
    if (Math.abs(totalRatio - 1) > SECTION_RATIO_TOLERANCE) {
        throw new RangeError(
            `JSXGraph: ${owner} section ratios must sum to 1; received ${totalRatio}.`
        );
    }
    return sections;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
