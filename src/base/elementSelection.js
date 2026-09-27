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
 * [INPUT]: 依赖现有 Board 对象引用与共享组合呈现算法
 * [OUTPUT]: 提供不登记、不拥有对象的 ElementSelection
 * [POS]: Board/Composition/View3D 的筛选结果，只管理选择项
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import JXG from "../jxg.js";
import { fade, createRevealJob } from "../utils/fade.js";
import {
    compositionMembers,
    writeComposition,
    emphasizeComposition
} from "../utils/compositionAnimation.js";

JXG.ElementSelection = function (elements = {}) {
    this.elements = {};
    this.objects = this.elements;

    this.groups = {};
    this._aliases = new Map();
    this._keys = new Map();
    this._nextKey = 0;
    for (const [name, element] of Object.entries(elements)) {
        if (element) this.add(name, element);
    }
};
Object.defineProperties(JXG.ElementSelection.prototype, {
    members: {
        get() {
            for (const [name, element] of this._aliases) {
                if (
                    element._disposed ||
                    (element.id &&
                        element.board?.objects[element.id] !== element &&
                        element.board?.groups[element.id] !== element)
                )
                    this.remove(name);
            }
            return Object.values(this.elements);
        }
    },
    objectsList: {
        get() {
            return this.members;
        }
    }
});
Object.defineProperty(JXG.ElementSelection.prototype, "elementsByName", {
    get() {
        return Object.fromEntries(
            this.members.filter((member) => member.name).map((member) => [member.name, member])
        );
    }
});
Object.assign(JXG.ElementSelection.prototype, {
    add(name, element) {
        if (name in this) return this._aliases.get(name) === element;
        if (!element || (!(element instanceof JXG.ElementSelection) && !element.board))
            return false;
        if (
            element._disposed ||
            (element.id &&
                element.board?.objects[element.id] !== element &&
                element.board?.groups[element.id] !== element)
        )
            return false;
        this._aliases.set(name, element);
        this[name] = element;
        if (!this._keys.has(element)) this._keys.set(element, `member${this._nextKey++}`);
        this.elements[this._keys.get(element)] = element;

        return true;
    },
    remove(name) {
        const element = this._aliases.get(name);
        if (!element) return false;
        this._aliases.delete(name);
        delete this[name];
        if (![...this._aliases.values()].includes(element)) {
            delete this.elements[this._keys.get(element)];
            this._keys.delete(element);
            for (const key of Object.keys(this.elementsByName)) {
                if (this.elementsByName[key] === element) delete this.elementsByName[key];
            }
        }
        return true;
    },
    select(filter) {
        this.members;
        if (typeof filter === "string")
            return (
                this._aliases.get(filter) ??
                this.members.find((member) => member.id === filter || member.name === filter) ??
                null
            );
        return JXG.Board.prototype.select.call(this, filter);
    },
    write(duration, options) {
        return writeComposition(this, duration, { ...options, fadeJob: createRevealJob });
    },
    indicate(duration, options) {
        return emphasizeComposition(this, "indicate", duration, options);
    },
    circumscribe(duration) {
        return emphasizeComposition(this, "circumscribe", duration);
    },
    fadeIn(duration) {
        return fade(this, true, duration);
    },
    fadeOut(duration) {
        return fade(this, false, duration);
    }
});
for (const method of ["show", "hide", "setAttribute", "highlight", "noHighlight"]) {
    JXG.ElementSelection.prototype[method] = function (...args) {
        for (const member of compositionMembers(this)) member[method]?.(...args);
        return this;
    };
}
export default JXG.ElementSelection;
