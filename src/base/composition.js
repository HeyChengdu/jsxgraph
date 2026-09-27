/*
 Copyright 2008-2026
 Matthias Ehmann,
 Michael Gerhaeuser,
 Carsten Miller,
 Bianca Valentin,
 Alfred Wassermann,
 Peter Wilfahrt

 This file is part of JSXGraph.

 JSXGraph is free software dual licensed under the GNU LGPL or MIT License.

 You can redistribute it and/or modify it under the terms of the

 * GNU Lesser General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version
 OR
 * MIT License: https://github.com/jsxgraph/jsxgraph/blob/master/LICENSE.MIT

 JSXGraph is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Lesser General Public License for more details.

 You should have received a copy of the GNU Lesser General Public License and
 the MIT License along with JSXGraph. If not, see <https://www.gnu.org/licenses/>
 and <https://opensource.org/licenses/MIT/>.
 */

/**
 * [INPUT]: 依赖 Board 注册、组合/辅助资源所有权链、ElementSelection 呈现及 JSXGraph 工厂
 * [OUTPUT]: 提供有 Board 身份和唯一所有权的 Composition
 * [POS]: JSXGraph 非几何组合单元；Board 负责调度与注销
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import JXG from "../jxg.js";
import Const from "./constants.js";
import ElementSelection from "./elementSelection.js";
import { createWithResources } from "../utils/compositionLifecycle.js";

JXG.Composition = function (board, attributes = {}) {
    if (!board || typeof board.setId !== "function") {
        throw new Error(
            "JSXGraph: Composition requires a Board; use board.create('composition')."
        );
    }
    this.board = board;
    this.type = Const.OBJECT_TYPE_COMPOSITION;
    this.elType = "composition";
    this.id = attributes.id ?? "";
    this.name = attributes.name ?? "";
    this.state = "active";
    this.elements = {};
    this.objects = this.elements;
    this.objectsList = [];

    this.groups = {};
    this.subs = {};
    this._aliases = new Map();
    this._memberKeys = new Map();
    this._nextMemberKey = 0;
    if ((this.id && board.objects[this.id]) || (this.name && board.elementsByName[this.name])) {
        throw new Error("JSXGraph: Composition identity already exists.");
    }
    board.setId(this, "Composition");
    if (this.name) board.elementsByName[this.name] = this;
};
Object.defineProperty(JXG.Composition.prototype, "members", {
    get() {
        return [...this.objectsList];
    }
});
Object.defineProperty(JXG.Composition.prototype, "elementsByName", {
    get() {
        return Object.fromEntries(
            this.members.filter((member) => member.name).map((member) => [member.name, member])
        );
    }
});
// 共享呈现方法，不继承选择集合的成员解绑或更新接口。
for (const method of ["write", "indicate", "circumscribe", "fadeIn", "fadeOut"]) {
    JXG.Composition.prototype[method] = function (...args) {
        this.assertActive();
        return ElementSelection.prototype[method].apply(this, args);
    };
}
for (const method of ["show", "hide", "setAttribute", "highlight", "noHighlight"]) {
    JXG.Composition.prototype[method] = function (...args) {
        this.assertActive();
        return ElementSelection.prototype[method].apply(this, args);
    };
}
Object.assign(JXG.Composition.prototype, {
    assertActive() {
        if (this.state !== "active" || this.board.objects[this.id] !== this) {
            throw new Error("JSXGraph: Composition is disposed.");
        }
    },
    select(filter) {
        this.assertActive();
        if (typeof filter === "string")
            return (
                this._aliases.get(filter) ??
                this.members.find((member) => member.id === filter || member.name === filter) ??
                null
            );
        return JXG.Board.prototype.select.call(this, filter);
    },
    add(name, element) {
        this.assertActive();
        if (
            !element ||
            element.board !== this.board ||
            element._disposed ||
            (element.id &&
                this.board.objects[element.id] !== element &&
                this.board.groups[element.id] !== element)
        ) {
            throw new Error("JSXGraph: Composition requires a live member on the same Board.");
        }
        if (
            element._resourceOwner ||
            (element._compositionOwner && element._compositionOwner !== this)
        ) {
            throw new Error("JSXGraph: member already has a composition owner.");
        }
        // 工厂内部资源与显式成员属于同一所有权树，不能只检查组合成员边。
        for (
            let ancestor = this;
            ancestor;
            ancestor = ancestor._compositionOwner ?? ancestor._resourceOwner
        ) {
            if (ancestor === element) throw new Error("JSXGraph: composition cycle.");
        }
        if (name !== undefined && name in this && this._aliases.get(name) !== element) {
            throw new Error("JSXGraph: composition alias conflict: " + name);
        }
        if (!this.objectsList.includes(element)) {
            const key = `member${this._nextMemberKey++}`;
            this._memberKeys.set(element, key);
            this.elements[key] = element;
            this.objectsList.push(element);
            element._compositionOwner = this;
        }
        if (name !== undefined) {
            this._aliases.set(name, element);
            this[name] = element;
        }

        return true;
    },
    create(type, parents, attributes) {
        this.assertActive();
        return createWithResources(this.board, () => {
            const element = this.board.create(type, parents, attributes);
            this.add(undefined, element);
            return element;
        });
    }
});
JXG.registerElement("composition", (board, parents, attributes) => {
    if (parents.length) throw new Error("JSXGraph: composition parents must be empty.");
    return new JXG.Composition(board, attributes);
});
export default JXG.Composition;

/** 内置复合工厂接纳同板成员；调用方的工厂范围负责失败回滚。 */
export function compose(board, members, attributes = {}) {
    const composition = board.create("composition", [], {
        id: attributes.id,
        name: attributes.name
    });
    for (const [name, member] of Object.entries(members)) {
        if (member != null) composition.add(name, member);
    }
    return composition;
}
