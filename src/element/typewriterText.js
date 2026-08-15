import JXG from "../jxg.js";
const nativeTextCreator = JXG.elements.text;
function evaluateProgress(progress) {
    const value = typeof progress === "function" ? progress() : progress;
    if (!Number.isFinite(value)) {
        throw new Error(
            `JSXGraph: text typewriter progress must be a finite number between 0 and 1, received ${String(value)}.`
        );
    }
    return Math.min(1, Math.max(0, value));
}
function revealText(content, progress) {
    const characters = Array.from(String(content));
    return characters
        .slice(0, Math.floor(characters.length * evaluateProgress(progress)))
        .join("");
}
function createTypewriterText(board, parents, attributes) {
    const progress = attributes.typewriter;
    if (progress === undefined) {
        return nativeTextCreator(board, parents, attributes);
    }
    const anchorX = attributes.anchorX;
    if (anchorX !== undefined && anchorX !== "left") {
        throw new Error(
            "JSXGraph: text typewriter requires anchorX: 'left' to keep the reveal origin stable. Remove anchorX or set it to 'left'."
        );
    }
    const content = parents.at(-1);
    const dynamicContent = typeof content === "function" ? content : () => content;
    const typewriterParents = [
        ...parents.slice(0, -1),
        () => revealText(dynamicContent(), progress)
    ];
    const nativeAttributes = { ...attributes };
    delete nativeAttributes.typewriter;
    return nativeTextCreator(board, typewriterParents, nativeAttributes);
}
JXG.registerElement("text", createTypewriterText);
