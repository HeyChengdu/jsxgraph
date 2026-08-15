import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import ts from "typescript";

const declarationUrl = new URL("../../src/index.d.ts", import.meta.url);
const source = await readFile(declarationUrl, "utf8");
const sourceFile = ts.createSourceFile(
    declarationUrl.pathname,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
);

assert.equal(
    /Type definitions for JSXGraph \d/.test(source),
    false,
    "The bundled declaration must not duplicate a package version that can drift."
);
assert.equal(
    source.includes("???"),
    false,
    "Public declarations must not contain placeholder docs."
);
assert.equal(
    /^\s*\*\s*@param\s+\S+\s*$/m.test(source),
    false,
    "JSDoc parameters must explain their role instead of repeating only the parameter name."
);

const emptyJSDocBlocks = [...source.matchAll(/\/\*\*[\s\S]*?\*\//g)].filter(({ 0: block }) => {
    const content = block
        .replace(/^\/\*\*/, "")
        .replace(/\*\/$/, "")
        .replace(/^\s*\* ?/gm, "")
        .trim();
    return content.length === 0;
});
assert.equal(
    emptyJSDocBlocks.length,
    0,
    "Empty JSDoc blocks create misleading hover affordances."
);

const forbiddenWideTypes = [];
let boardElementRegistry;

function visit(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
        forbiddenWideTypes.push({ kind: "any", position: node.getStart(sourceFile) });
    }
    if (
        ts.isTypeReferenceNode(node) &&
        ts.isIdentifier(node.typeName) &&
        node.typeName.text === "Function"
    ) {
        forbiddenWideTypes.push({ kind: "Function", position: node.getStart(sourceFile) });
    }
    if (ts.isInterfaceDeclaration(node) && node.name.text === "BoardElementRegistry") {
        boardElementRegistry = node;
    }
    ts.forEachChild(node, visit);
}

visit(sourceFile);

assert.deepEqual(
    forbiddenWideTypes,
    [],
    `Use concrete call signatures or unknown instead of ${forbiddenWideTypes
        .map(({ kind, position }) => {
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(position);
            return `${kind} at ${line + 1}:${character + 1}`;
        })
        .join(", ")}`
);
assert.ok(
    boardElementRegistry,
    "BoardElementRegistry must remain the Board.create truth source."
);

const undocumentedElements = boardElementRegistry.members
    .filter((member) => ts.getJSDocCommentsAndTags(member).length === 0)
    .map((member) => member.name.getText(sourceFile));

assert.deepEqual(
    undocumentedElements,
    [],
    `Every Board.create element needs hover documentation: ${undocumentedElements.join(", ")}`
);
