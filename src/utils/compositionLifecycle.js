/**
 * [INPUT]: 依赖 Board 注册表、原生几何依赖和 Composition 的直接成员
 * [OUTPUT]: 提供同步工厂资源记录、原子删除预检和对象注销
 * [POS]: JSXGraph Board 与组合共用的生命周期边界，不保存视觉状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import JXG from "../jxg.js";

export function isComposition(object) {
    return object instanceof JXG.Composition;
}
export function ownedResources(object) {
    return [
        ...(object._ownedResources ?? []),
        ...(isComposition(object) ? object.members : [])
    ];
}
export function detachMember(object) {
    const owner = object._compositionOwner;
    if (owner) {
        delete owner.elements[owner._memberKeys.get(object)];
        owner._memberKeys.delete(object);
        owner.objectsList = owner.objectsList.filter((member) => member !== object);
        for (const [name, member] of owner._aliases) {
            if (member !== object) continue;
            owner._aliases.delete(name);
            delete owner[name];
        }
        delete object._compositionOwner;
    }
    object._resourceOwner?._ownedResources?.delete(object);
    delete object._resourceOwner;
}

export function createWithResources(board, create) {
    const frames = (board._creationFrames ??= []);
    const resources = new Set();
    frames.push(resources);
    try {
        const result = create();
        if (result && result.board === board) {
            // 已注册返回值由 setId/Group 构造登记；返回旧对象不得扩大回滚范围。
            const known = (board._knownFactoryResources ??= new WeakSet());
            if (!result.id && !known.has(result)) {
                for (const frame of frames) frame.add(result);
            }
            known.add(result);
            result._ownedResources ??= new Set();
            for (const resource of resources) {
                if (
                    resource === result ||
                    resource._compositionOwner ||
                    resource._resourceOwner
                )
                    continue;
                result._ownedResources.add(resource);
                resource._resourceOwner = result;
            }
        }
        return result;
    } catch (error) {
        try {
            removeObjects(board, [...resources], true);
        } catch (cleanupError) {
            throw new AggregateError(
                [error, cleanupError],
                "JSXGraph: creation and rollback failed."
            );
        }
        throw error;
    } finally {
        frames.pop();
    }
}

export function removeObjects(board, target, releasingBoard = false) {
    const roots = new Set();
    function resolve(value) {
        if (Array.isArray(value)) {
            value.forEach(resolve);
            return;
        }
        if (value instanceof JXG.ElementSelection) {
            throw new Error("JSXGraph: remove an explicit member array, not ElementSelection.");
        }
        const object =
            typeof value === "string"
                ? (board.objects[value] ?? board.elementsByName[value])
                : value;
        if (
            !object ||
            object._disposed ||
            (object.board === board &&
                object.id &&
                !board.objects[object.id] &&
                !board.groups[object.id])
        )
            return;
        if (object.board !== board)
            throw new Error("JSXGraph: removal requires the same Board.");
        if (
            !object.id ||
            board.objects[object.id] === object ||
            board.groups[object.id] === object
        )
            roots.add(object);
    }
    resolve(target);
    if (board._deletionPlan) {
        for (const root of roots) {
            if (!board._deletionPlan.has(root))
                throw new Error("JSXGraph: cleanup requested an unplanned object.");
        }
        return;
    }
    const allowed = new Set();
    function own(object) {
        if (allowed.has(object)) return;
        allowed.add(object);
        ownedResources(object).forEach(own);
    }
    roots.forEach(own);
    const visited = new Set(),
        ordered = [];
    function visit(object) {
        if (
            !object ||
            object.board !== board ||
            visited.has(object) ||
            object._disposed ||
            (object.id &&
                board.objects[object.id] !== object &&
                board.groups[object.id] !== object)
        )
            return;
        visited.add(object);
        ownedResources(object).forEach(visit);
        Object.values(object.childElements ?? {}).forEach(visit);
        // 原生 turtle 等复合元素的内部对象同样参加旧几何级联。
        if (!isComposition(object)) Object.values(object.objects ?? {}).forEach(visit);
        ordered.push(object);
    }
    roots.forEach(visit);
    const managed = ordered.some((object) => isComposition(object) || object._compositionOwner);
    if (!releasingBoard && managed) {
        for (const object of ordered) {
            if (!allowed.has(object)) {
                throw new Error(
                    `JSXGraph: removal crosses composition boundary: ${object.id} (owner ${object._compositionOwner?.id ?? "Board"}).`
                );
            }
        }
    }
    const errors = [];
    board._deletionPlan = visited;
    for (const object of ordered) {
        if (isComposition(object)) object.state = "deleting";
    }
    for (const object of ordered) {
        try {
            object._compositionWrite?.cancel();
            if (object.visProp && object.evalVisProp("trace")) object.clearTrace();
            if (object instanceof JXG.Group) object.ungroup();
            else if (!isComposition(object)) object.remove?.();
        } catch (error) {
            errors.push(error);
        }
        for (const ancestor of Object.values(object.ancestors ?? {})) {
            delete ancestor.childElements?.[object.id];
            delete ancestor.descendants?.[object.id];
        }
        detachMember(object);
        if (board.objects[object.id] === object) delete board.objects[object.id];
        if (board.groups[object.id] === object) delete board.groups[object.id];
        if (board.elementsByName[object.name] === object)
            delete board.elementsByName[object.name];
        object._pos = -1;
        object._disposed = true;
        object._ownedResources?.clear();
        if (isComposition(object)) {
            object.state = "disposed";
            object.objectsList.length = 0;
            for (const key of Object.keys(object.elements)) delete object.elements[key];
            for (const key of object._aliases.keys()) delete object[key];
            object._aliases.clear();
            object._memberKeys.clear();
        }
    }
    board.objectsList = board.objectsList.filter((object) => !visited.has(object));
    board.objectsList.forEach((object, index) => {
        object._pos = index;
    });
    delete board._deletionPlan;
    if (errors.length) throw new AggregateError(errors, "JSXGraph: object cleanup failed.");
}
