var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined")
    return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// _cojson_src/crud/read-operations.js
var exports_read_operations = {};
__export(exports_read_operations, {
  waitForStoreReady: () => waitForStoreReady,
  waitForReactiveResolution: () => waitForReactiveResolution
});
function isReady(data, strict) {
  if (!data || data.loading || data.error)
    return false;
  if (!strict)
    return true;
  return typeof data === "object" && Object.keys(data).length > 0 && data.id;
}
async function waitForStoreReady(store, coId, timeoutMs = 5000) {
  const initialValue = store.value;
  if (isReady(initialValue, true))
    return;
  if (initialValue?.error)
    throw new Error(`CoValue error (co-id: ${coId}): ${initialValue.error}`);
  return new Promise((resolve, reject) => {
    let resolved = false;
    let unsubscribe;
    unsubscribe = store.subscribe((data) => {
      if (resolved)
        return;
      if (data?.error) {
        resolved = true;
        unsubscribe();
        reject(new Error(`CoValue error (co-id: ${coId}): ${data.error}`));
        return;
      }
      if (isReady(data, true)) {
        resolved = true;
        unsubscribe();
        resolve();
      }
    });
    const current = store.value;
    if (current?.error) {
      resolved = true;
      unsubscribe();
      reject(new Error(`CoValue error (co-id: ${coId}): ${current.error}`));
    } else if (isReady(current, true)) {
      resolved = true;
      unsubscribe();
      resolve();
    }
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        unsubscribe();
        reject(new Error(`CoValue timeout loading (co-id: ${coId}). Make sure the CoValue was seeded correctly.`));
      }
    }, timeoutMs);
  });
}
function waitForReactiveResolution(store, options = {}) {
  const { timeoutMs = 1e4 } = options;
  const initial = store.value;
  if (!initial?.loading) {
    if (initial?.error)
      return Promise.reject(new Error(initial.error));
    return Promise.resolve(initial);
  }
  return new Promise((resolve, reject) => {
    let unsub;
    const timeout = setTimeout(() => {
      if (unsub)
        unsub();
      reject(new Error(`Timeout waiting for reactive resolution after ${timeoutMs}ms`));
    }, timeoutMs);
    unsub = store.subscribe((state) => {
      if (state.loading)
        return;
      clearTimeout(timeout);
      if (unsub)
        unsub();
      state.error ? reject(new Error(state.error)) : resolve(state);
    });
  });
}

// _cojson_src/crud/reactive-resolver.js
import { observeCoValue } from "../primitives/co-cache.js";
import { ensureCoValueLoaded } from "../primitives/ensure-covalue-core.js";
import { ReactiveStore } from "../primitives/reactive-store.js";

function resolveFactoryReactive(_peer, factoryKey, _options = {}) {
  const store = new ReactiveStore({ loading: true });
  if (typeof factoryKey !== "string" || !factoryKey.startsWith("co_z")) {
    store._set({ loading: false, error: STRICT_ERR });
    return store;
  }
  store._set({ loading: false, factoryCoId: factoryKey });
  return store;
}
function resolveCoValueReactive(peer, coId, _options = {}) {
  const store = new ReactiveStore({ loading: true });
  if (!coId?.startsWith("co_z")) {
    store._set({ loading: false, error: "Invalid co-id" });
    return store;
  }
  const coValueCore = peer.getCoValue(coId);
  if (!coValueCore) {
    store._set({ loading: false, error: "CoValueCore not found" });
    return store;
  }
  if (peer.isAvailable(coValueCore)) {
    store._set({ loading: false, coValueCore });
    return store;
  }
  ensureCoValueLoaded(peer, coId, { waitForAvailable: false }).catch((_err) => {});
  const hubUnsub = observeCoValue(peer, coId).subscribe((core) => {
    if (peer.isAvailable(core)) {
      store._set({ loading: false, coValueCore: core });
      hubUnsub();
    }
  });
  const originalUnsubscribe = store._unsubscribe;
  store._unsubscribe = () => {
    if (originalUnsubscribe)
      originalUnsubscribe();
    hubUnsub();
  };
  return store;
}
function resolveQueryReactive(peer, queryDef, options = {}) {
  const store = new ReactiveStore({ loading: true, items: [] });
  if (!queryDef?.factory) {
    store._set({ loading: false, items: [], error: "Invalid query definition" });
    return store;
  }
  if (typeof queryDef.factory !== "string" || !queryDef.factory.startsWith("co_z")) {
    store._set({ loading: false, items: [], error: STRICT_ERR });
    return store;
  }
  const factoryStore = resolveFactoryReactive(peer, queryDef.factory, options);
  const factoryUnsubscribe = factoryStore.subscribe(async (factoryState) => {
    if (factoryState.loading) {
      return;
    }
    if (factoryState.error || !factoryState.factoryCoId) {
      store._set({ loading: false, items: [], error: factoryState.error || "Factory not found" });
      factoryUnsubscribe();
      return;
    }
    if (typeof peer.read !== "function") {
      store._set({
        loading: false,
        items: [],
        error: "[resolveQueryReactive] peer.read is required (MaiaDB / data engine peer)"
      });
      factoryUnsubscribe();
      return;
    }
    try {
      const queryStore = await peer.read(factoryState.factoryCoId, null, null, queryDef.filter || null, {
        ...options,
        ...queryDef.options || {}
      });
      const queryUnsubscribe = queryStore.subscribe((queryResults) => {
        const items = Array.isArray(queryResults) ? queryResults : queryResults?.items || [];
        store._set({ loading: false, items });
      });
      const originalUnsubscribe = store._unsubscribe;
      store._unsubscribe = () => {
        if (originalUnsubscribe)
          originalUnsubscribe();
        queryUnsubscribe();
        factoryUnsubscribe();
      };
    } catch (error) {
      store._set({ loading: false, items: [], error: error.message });
      factoryUnsubscribe();
    }
  });
  return store;
}
function resolveReactiveDependency(peer, identifier, options = {}) {
  if (identifier && typeof identifier === "object" && !Array.isArray(identifier)) {
    if (identifier.factory) {
      return resolveQueryReactive(peer, identifier, options);
    }
    if (identifier.fromCoValue) {
      const coValueStore = resolveCoValueReactive(peer, identifier.fromCoValue, options);
      const factoryStore = new ReactiveStore({ loading: true });
      let coValueUnsubscribe;
      let factoryResolveUnsubscribe;
      let headerUnsubscribe;
      coValueUnsubscribe = coValueStore.subscribe(async (coValueState) => {
        if (coValueState.loading) {
          return;
        }
        if (coValueState.error || !coValueState.coValueCore) {
          factoryStore._set({ loading: false, error: coValueState.error || "CoValue not found" });
          if (coValueUnsubscribe)
            coValueUnsubscribe();
          return;
        }
        const header = peer.getHeader(coValueState.coValueCore);
        const headerMeta = header?.meta || null;
        const factoryCoId = headerMeta?.$factory || null;
        if (factoryCoId && typeof factoryCoId === "string" && factoryCoId.startsWith("co_z")) {
          const resolvedFactoryStore = resolveFactoryReactive(peer, factoryCoId, options);
          factoryResolveUnsubscribe = resolvedFactoryStore.subscribe((factoryState) => {
            factoryStore._set(factoryState);
            if (!factoryState.loading) {
              if (factoryResolveUnsubscribe)
                factoryResolveUnsubscribe();
              if (coValueUnsubscribe)
                coValueUnsubscribe();
            }
          });
        } else {
          headerUnsubscribe = coValueState.coValueCore.subscribe((core) => {
            const updatedHeader = peer.getHeader(core);
            const updatedHeaderMeta = updatedHeader?.meta || null;
            const updatedFactoryCoId = updatedHeaderMeta?.$factory || null;
            if (updatedFactoryCoId && typeof updatedFactoryCoId === "string" && updatedFactoryCoId.startsWith("co_z")) {
              const resolvedFactoryStore = resolveFactoryReactive(peer, updatedFactoryCoId, options);
              factoryResolveUnsubscribe = resolvedFactoryStore.subscribe((factoryState) => {
                factoryStore._set(factoryState);
                if (!factoryState.loading) {
                  if (factoryResolveUnsubscribe)
                    factoryResolveUnsubscribe();
                  if (headerUnsubscribe)
                    headerUnsubscribe();
                  if (coValueUnsubscribe)
                    coValueUnsubscribe();
                }
              });
            }
          });
        }
      });
      const originalUnsubscribe = factoryStore._unsubscribe;
      factoryStore._unsubscribe = () => {
        if (originalUnsubscribe)
          originalUnsubscribe();
        if (coValueUnsubscribe)
          coValueUnsubscribe();
        if (factoryResolveUnsubscribe)
          factoryResolveUnsubscribe();
        if (headerUnsubscribe)
          headerUnsubscribe();
      };
      return factoryStore;
    }
  }
  if (typeof identifier === "string") {
    if (identifier.startsWith("co_z")) {
      return resolveCoValueReactive(peer, identifier, options);
    }
    const errStore = new ReactiveStore({
      loading: false,
      error: STRICT_ERR
    });
    return errStore;
  }
  const store = new ReactiveStore({ loading: false, error: "Invalid identifier" });
  return store;
}
var STRICT_ERR = "[resolveReactive] Runtime resolve requires co_z CoID";
var init_reactive_resolver = () => {};

// _cojson_src/factory/authoring-resolver.js
var exports_authoring_resolver = {};
__export(exports_authoring_resolver, {
  resolveReactive: () => resolveReactive,
  resolveFactoryDefFromPeer: () => resolveFactoryDefFromPeer,
  resolve: () => resolve,
  checkCotype: () => checkCotype
});

import { removeIdFields } from "@MaiaOS/validation";
import { normalizeCoValueData } from "../primitives/data-extraction.js";
import { ensureCoValueLoaded as ensureCoValueLoaded2 } from "../primitives/ensure-covalue-core.js";
import { ReactiveStore as ReactiveStore2 } from "../primitives/reactive-store.js";

function readViaPeer(peer, coId, options) {
  if (typeof peer?.read !== "function") {
    throw new Error("[resolve] peer.read is required (MaiaDB-like peer)");
  }
  return peer.read(null, coId, null, null, options);
}
async function ensureCoValueLoadedAuthoring(peer, id, opts) {
  return ensureCoValueLoaded2(peer, id, opts);
}
async function resolve(peer, identifier, options = {}) {
  const { returnType = "factory", deepResolve = false, timeoutMs = 5000 } = options;
  if (!peer) {
    throw new Error("[resolve] peer is required");
  }
  if (identifier === null || identifier === undefined) {
    throw new Error('[resolve] identifier is required (co-id string or { fromCoValue: "co_z..." })');
  }
  if (identifier && typeof identifier === "object" && !Array.isArray(identifier)) {
    const factoryCoId = identifier.$id ?? identifier.id;
    if (typeof factoryCoId === "string" && factoryCoId.startsWith("co_z")) {
      if (returnType === "coId")
        return factoryCoId;
      return await resolve(peer, factoryCoId, { returnType, deepResolve, timeoutMs });
    }
    if (identifier.fromCoValue) {
      if (!identifier.fromCoValue.startsWith("co_z")) {
        throw new Error(`[resolve] fromCoValue must be a valid co-id (co_z...), got: ${identifier.fromCoValue}`);
      }
      const coValueStore = await readViaPeer(peer, identifier.fromCoValue, {
        deepResolve: false,
        timeoutMs
      });
      try {
        await waitForStoreReady(coValueStore, identifier.fromCoValue, timeoutMs);
      } catch (_error) {
        return null;
      }
      const coValueData = coValueStore.value;
      if (!coValueData || coValueData.error) {
        return null;
      }
      let factoryCoId2 = coValueData.$factory || null;
      if (factoryCoId2 && typeof factoryCoId2 === "object") {
        factoryCoId2 = factoryCoId2.$id ?? factoryCoId2.id ?? null;
      }
      if (!factoryCoId2 || typeof factoryCoId2 !== "string") {
        return null;
      }
      if (returnType === "coId") {
        return factoryCoId2;
      }
      return await resolve(peer, factoryCoId2, { returnType, deepResolve, timeoutMs });
    }
    throw new Error('[resolve] Invalid identifier object. Expected { fromCoValue: "co_z..." }');
  }
  if (typeof identifier !== "string") {
    throw new Error(`[resolve] Invalid identifier type. Expected string or object, got: ${typeof identifier}`);
  }
  if (identifier.startsWith("co_z")) {
    try {
      await ensureCoValueLoadedAuthoring(peer, identifier, { waitForAvailable: true, timeoutMs });
    } catch (_e) {}
    const store = await readViaPeer(peer, identifier, {
      deepResolve,
      timeoutMs
    });
    try {
      await waitForStoreReady(store, identifier, timeoutMs);
    } catch (_error) {
      return null;
    }
    const data = store.value;
    if (!data || data.error) {
      return null;
    }
    if (returnType === "coValue") {
      return store;
    }
    if (returnType === "coId") {
      return identifier;
    }
    const cotype = data.cotype;
    const properties = data.properties;
    const items = data.items;
    const title = data.title;
    const definition = data.definition;
    const hasSchemaProps = cotype || properties || items || title || definition;
    if (hasSchemaProps) {
      const rawSchema = definition && typeof definition === "object" ? definition : data;
      const { id, type, definition: _def, ...schemaData } = rawSchema;
      const cleanedSchema = removeIdFields(schemaData);
      const result = { ...cleanedSchema, $id: identifier };
      if (!result.$factory && data.$factory)
        result.$factory = data.$factory;
      return normalizeCoValueData(result);
    }
    return null;
  }
  throw new Error(`[resolve] Runtime resolve requires co_z co-id, got: ${identifier}`);
}
function resolveReactive(peer, identifier, options = {}) {
  const { returnType = "coId" } = options;
  const store = resolveReactiveDependency(peer, identifier, options);
  if (returnType === "factory" || returnType === "coValue") {
    const transformedStore = new ReactiveStore2({ loading: true });
    let unsubscribe = () => {};
    unsubscribe = store.subscribe(async (state) => {
      if (state.loading) {
        transformedStore._set({ loading: true });
        return;
      }
      if (state.error) {
        transformedStore._set({ loading: false, error: state.error });
        unsubscribe();
        return;
      }
      if (state.factoryCoId) {
        if (returnType === "coId") {
          transformedStore._set({ loading: false, factoryCoId: state.factoryCoId });
          unsubscribe();
        } else {
          try {
            const resolved = await resolve(peer, state.factoryCoId, { returnType });
            if (resolved) {
              transformedStore._set({
                loading: false,
                [returnType === "factory" ? "factory" : "coValue"]: resolved
              });
            } else {
              transformedStore._set({ loading: false, error: "Factory not found" });
            }
            unsubscribe();
          } catch (error) {
            transformedStore._set({ loading: false, error: error.message });
            unsubscribe();
          }
        }
      } else if (state.coValueCore) {
        if (returnType === "coId") {
          const header = peer.getHeader(state.coValueCore);
          const headerMeta = header?.meta || null;
          const factoryCoId = headerMeta?.$factory || null;
          if (factoryCoId) {
            transformedStore._set({ loading: false, factoryCoId });
          } else {
            transformedStore._set({ loading: false, error: "Factory not found in headerMeta" });
          }
          unsubscribe();
        } else {
          transformedStore._set({ loading: false, coValue: state.coValueCore });
          unsubscribe();
        }
      }
    });
    const originalUnsubscribe = transformedStore._unsubscribe;
    transformedStore._unsubscribe = () => {
      if (originalUnsubscribe)
        originalUnsubscribe();
      unsubscribe();
    };
    return transformedStore;
  }
  return store;
}
async function checkCotype(peer, factoryCoId, expectedCotype) {
  const schema = await resolve(peer, factoryCoId, { returnType: "factory" });
  if (!schema) {
    throw new Error(`[checkCotype] Factory ${factoryCoId} not found`);
  }
  const cotype = schema.cotype || "comap";
  return cotype === expectedCotype;
}
async function resolveFactoryDefFromPeer(peer, factoryKey, options = {}) {
  const { returnType = "factory", deepResolve = false, timeoutMs = 5000 } = options;
  if (!peer) {
    throw new Error("[resolveFactoryDefFromPeer] peer is required");
  }
  if (typeof factoryKey !== "string") {
    throw new Error(`[resolveFactoryDefFromPeer] factoryKey must be a string, got: ${typeof factoryKey}`);
  }
  if (!factoryKey.startsWith("co_z")) {
    throw new Error(`[resolveFactoryDefFromPeer] factoryKey must be a co_z id, got: ${factoryKey} (namekeys: seed/lookup only)`);
  }
  const def = await resolve(peer, factoryKey, { returnType, deepResolve, timeoutMs });
  if (def == null && returnType === "factory") {
    throw new Error(`[resolveFactoryDefFromPeer] Factory not found for co-id: ${factoryKey}`);
  }
  return def;
}
var init_authoring_resolver = __esm(() => {
  init_reactive_resolver();
});

// _cojson_src/spark-os-keys.js
var SPARK_OS_META_FACTORY_CO_ID_KEY = "metaFactoryCoId";

// _cojson_src/groups/groups-core.js
function readCoMapCoIdField(peer, coId, key) {
  if (!coId?.startsWith("co_z") || !key)
    return null;
  const core = peer.getCoValue?.(coId) ?? peer.node?.getCoValue?.(coId);
  if (!core?.isAvailable?.())
    return null;
  const content = peer.getCurrentContent?.(core) ?? core.getCurrentContent?.();
  if (!content || typeof content.get !== "function")
    return null;
  const v = content.get(key);
  return typeof v === "string" && v.startsWith("co_z") ? v : null;
}
function readLiveSparksRegistryEntries(peer, sparksId) {
  const out = {};
  if (!sparksId?.startsWith("co_z"))
    return out;
  const core = peer.getCoValue?.(sparksId) ?? peer.node?.getCoValue?.(sparksId);
  if (!core?.isAvailable?.())
    return out;
  const content = peer.getCurrentContent?.(core) ?? core.getCurrentContent?.();
  if (!content || typeof content.get !== "function")
    return out;
  const keys = typeof content.keys === "function" ? content.keys() : Object.keys(content);
  for (const k of keys) {
    if (k === "maiaPathKey")
      continue;
    const v = content.get(k);
    if (typeof v === "string" && v.startsWith("co_z"))
      out[k] = v;
  }
  return out;
}
async function getGroup(node, groupId) {
  const groupCore = node.getCoValue(groupId);
  if (!groupCore || !(groupCore?.isAvailable() || false)) {
    return null;
  }
  const content = groupCore?.getCurrentContent();
  if (!content || typeof content.addMember !== "function") {
    return null;
  }
  return content;
}
function extractAccountMembers(groupContent) {
  const accountMembers = [];
  const seenMembers = new Set;
  try {
    if (typeof groupContent.getMemberKeys === "function") {
      const memberKeys = groupContent.getMemberKeys();
      for (const memberId of memberKeys) {
        if (seenMembers.has(memberId))
          continue;
        seenMembers.add(memberId);
        let role = null;
        if (typeof groupContent.roleOf === "function") {
          try {
            role = groupContent.roleOf(memberId);
          } catch (_e) {
            try {
              const directRole = groupContent.get(memberId);
              if (directRole && directRole !== "revoked") {
                role = directRole;
              }
            } catch (_e2) {}
          }
        } else if (typeof groupContent.get === "function") {
          const directRole = groupContent.get(memberId);
          if (directRole && directRole !== "revoked") {
            role = directRole;
          }
        }
        if (role && role !== "revoked") {
          const directRole = groupContent.get ? groupContent.get(memberId) : null;
          const isInherited = directRole === "revoked" || directRole !== role;
          accountMembers.push({
            id: memberId,
            role,
            isInherited: isInherited || false
          });
        }
      }
    }
  } catch (_e) {}
  return accountMembers;
}
function extractEveryoneRole(groupContent) {
  try {
    let everyoneRole = null;
    if (typeof groupContent.getRoleOf === "function") {
      try {
        const role = groupContent.getRoleOf("everyone");
        if (role && typeof role === "string" && role !== "revoked") {
          everyoneRole = role;
        }
      } catch (_e) {}
    }
    if (!everyoneRole && typeof groupContent.get === "function") {
      try {
        const value = groupContent.get("everyone");
        if (value && typeof value === "string" && value !== "revoked") {
          everyoneRole = value;
        }
      } catch (_e) {}
    }
    if (!everyoneRole && groupContent.everyone !== undefined) {
      const value = groupContent.everyone;
      if (value && typeof value === "string" && value !== "revoked") {
        everyoneRole = value;
      }
    }
    return everyoneRole;
  } catch (_e) {
    return null;
  }
}
function extractGroupMembers(groupContent) {
  const groupMembers = [];
  try {
    if (typeof groupContent.getParentGroups === "function") {
      const parentGroups = groupContent.getParentGroups();
      if (parentGroups && typeof parentGroups[Symbol.iterator] === "function") {
        for (const parentGroup of parentGroups) {
          const parentId = typeof parentGroup === "string" ? parentGroup : parentGroup.id || parentGroup.$jazz?.id || "unknown";
          let delegationRole = null;
          const parentKey = `parent_${parentId}`;
          if (typeof groupContent.get === "function") {
            try {
              delegationRole = groupContent.get(parentKey);
            } catch (_e) {}
          }
          let roleDescription = "";
          if (delegationRole === "extend") {
            roleDescription = "Inherits roles from this group";
          } else if (delegationRole === "reader") {
            roleDescription = "All members of this group get reader access";
          } else if (delegationRole === "writer") {
            roleDescription = "All members of this group get writer access";
          } else if (delegationRole === "manager") {
            roleDescription = "All members of this group get manager access";
          } else if (delegationRole === "admin") {
            roleDescription = "All members of this group get admin access";
          } else if (delegationRole === "revoked") {
            roleDescription = "Delegation revoked";
          } else {
            roleDescription = "Delegated access";
          }
          const delegatedMembers = [];
          try {
            const memberKeys = typeof parentGroup.getMemberKeys === "function" ? parentGroup.getMemberKeys() : [];
            const hasEveryone = typeof parentGroup.get === "function" && parentGroup.get("everyone");
            const memberIds = [...memberKeys];
            if (hasEveryone)
              memberIds.push("everyone");
            for (const memberId of memberIds) {
              const parentRole = typeof parentGroup.roleOf === "function" ? parentGroup.roleOf(memberId) : null;
              if (!parentRole || parentRole === "revoked")
                continue;
              const effectiveRole = delegationRole === "extend" || delegationRole === "inherit" ? parentRole : delegationRole;
              delegatedMembers.push({ id: memberId, role: effectiveRole });
            }
          } catch (_e) {}
          groupMembers.push({
            id: parentId,
            role: delegationRole || "extend",
            roleDescription,
            members: delegatedMembers
          });
        }
      }
    }
  } catch (_e) {}
  return groupMembers;
}
function getGroupInfoFromGroup(group) {
  if (!group || typeof group.addMember !== "function") {
    return null;
  }
  try {
    const groupId = group.id || group.$jazz?.id;
    if (!groupId) {
      return null;
    }
    const accountMembers = extractAccountMembers(group);
    const everyoneRole = extractEveryoneRole(group);
    if (everyoneRole) {
      const everyoneExists = accountMembers.some((m) => m.id === "everyone");
      if (!everyoneExists) {
        accountMembers.push({
          id: "everyone",
          role: everyoneRole
        });
      }
    }
    const groupMembers = extractGroupMembers(group);
    return {
      groupId,
      accountMembers,
      groupMembers
    };
  } catch (_error) {
    return null;
  }
}
function wouldLeaveNoAdmins(groupContent, memberIdToRemove) {
  const accountMembers = extractAccountMembers(groupContent);
  const directAdmins = accountMembers.filter((m) => (m.role === "admin" || m.role === "manager") && m.id !== memberIdToRemove);
  if (directAdmins.length > 0)
    return false;
  const groupMembers = extractGroupMembers(groupContent);
  const hasParentWithAdmins = groupMembers.some((g) => g.role === "admin" || g.role === "extend");
  if (hasParentWithAdmins)
    return false;
  return true;
}
async function removeGroupMember(group, member) {
  const memberId = typeof member === "string" ? member : member?.id ?? member?.$jazz?.id;
  if (!memberId?.startsWith("co_z")) {
    throw new Error("[removeGroupMember] member must be co-id (co_z...) or account content with .id");
  }
  if (typeof group.removeMember !== "function") {
    throw new Error("[MaiaDB] Group does not support removeMember");
  }
  if (wouldLeaveNoAdmins(group, memberId)) {
    throw new Error("[removeGroupMember] Cannot remove last admin. Group must have at least one admin.");
  }
  group.removeMember(memberId);
}

// _cojson_src/groups/groups.js
var exports_groups = {};
__export(exports_groups, {
  wouldLeaveNoAdmins: () => wouldLeaveNoAdmins,
  setSparkVibesId: () => setSparkVibesId,
  setGroupMemberRole: () => setGroupMemberRole,
  resolveSparkCoId: () => resolveSparkCoId,
  removeGroupMember: () => removeGroupMember,
  getSparksRegistryId: () => getSparksRegistryId,
  getSparksRegistryContent: () => getSparksRegistryContent,
  getSparkVibesId: () => getSparkVibesId,
  getSparkOsMetaFactoryCoId: () => getSparkOsMetaFactoryCoId,
  getSparkOsId: () => getSparkOsId,
  getSparkGroup: () => getSparkGroup,
  getSparkCapabilityGroupIdFromSparkCoId: () => getSparkCapabilityGroupIdFromSparkCoId,
  getSparkCapabilityGroupId: () => getSparkCapabilityGroupId,
  getMaiaGroup: () => getMaiaGroup,
  getGroupInfoFromGroup: () => getGroupInfoFromGroup,
  getGroup: () => getGroup,
  getCapabilityGroupIdFromOsId: () => getCapabilityGroupIdFromOsId,
  extractGroupMembers: () => extractGroupMembers,
  extractEveryoneRole: () => extractEveryoneRole,
  extractAccountMembers: () => extractAccountMembers,
  addGroupMember: () => addGroupMember
});

import { ensureCoValueLoaded as ensureCoValueLoaded3 } from "../primitives/ensure-covalue-core.js";

async function getCapabilityGroupIdFromOsId(peer, osId, capabilityName) {
  if (!osId || typeof osId !== "string" || !osId.startsWith("co_z"))
    return null;
  const osStore = await peer.read(null, osId);
  await waitForStoreReady(osStore, osId, 15000);
  const osCore = peer.getCoValue(osId);
  if (!osCore || !peer.isAvailable(osCore))
    return null;
  const osContent = peer.getCurrentContent(osCore);
  if (!osContent || typeof osContent.get !== "function")
    return null;
  let groupsId = osContent.get("groups");
  if (!groupsId?.startsWith("co_z")) {
    groupsId = readCoMapCoIdField(peer, osId, "groups");
  }
  if (!groupsId || typeof groupsId !== "string" || !groupsId.startsWith("co_z"))
    return null;
  const groupsStore = await peer.read(null, groupsId);
  await waitForStoreReady(groupsStore, groupsId, 15000);
  const groupsCore = peer.getCoValue(groupsId);
  if (!groupsCore || !peer.isAvailable(groupsCore))
    return null;
  const groupsContent = peer.getCurrentContent(groupsCore);
  if (!groupsContent || typeof groupsContent.get !== "function")
    return null;
  let groupId = groupsContent.get(capabilityName);
  if (!groupId?.startsWith("co_z")) {
    groupId = readCoMapCoIdField(peer, groupsId, capabilityName);
  }
  if (!groupId || typeof groupId !== "string" || !groupId.startsWith("co_z"))
    return null;
  return groupId;
}
async function getSparkCapabilityGroupId(peer, spark, capabilityName) {
  const osId = await getSparkOsId(peer, spark);
  return getCapabilityGroupIdFromOsId(peer, osId, capabilityName);
}
async function getSparkCapabilityGroupIdFromSparkCoId(peer, sparkCoId, capabilityName) {
  if (!sparkCoId || typeof sparkCoId !== "string" || !sparkCoId.startsWith("co_z"))
    return null;
  const sparkCore = peer.getCoValue(sparkCoId) || await peer.node?.loadCoValueCore?.(sparkCoId);
  if (!sparkCore || !peer.isAvailable?.(sparkCore))
    return null;
  const sparkContent = peer.getCurrentContent?.(sparkCore);
  if (!sparkContent || typeof sparkContent.get !== "function")
    return null;
  const osId = sparkContent.get("os");
  return getCapabilityGroupIdFromOsId(peer, osId, capabilityName);
}
async function getSparkGroup(peer, spark) {
  if (!spark || typeof spark !== "string") {
    throw new Error("[getSparkGroup] spark is required");
  }
  const cacheKey = `_cachedSparkGroup_${spark}`;
  if (peer[cacheKey]) {
    return peer[cacheKey];
  }
  const groupId = await getSparkCapabilityGroupId(peer, spark, "guardian");
  if (!groupId || typeof groupId !== "string" || !groupId.startsWith("co_z")) {
    throw new Error(`[getSparkGroup] Spark ${spark} has no guardian in os.groups`);
  }
  const groupStore = await peer.read("@group", groupId);
  if (!groupStore || groupStore.value?.error) {
    throw new Error(`[getSparkGroup] Group for spark ${spark} not available: ${groupId}`);
  }
  await waitForStoreReady(groupStore, groupId, 1e4);
  const groupCore = peer.getCoValue(groupId);
  if (!groupCore) {
    throw new Error(`[getSparkGroup] Group core not found: ${groupId}`);
  }
  const group = peer.getCurrentContent(groupCore);
  if (!group || typeof group.createMap !== "function") {
    throw new Error(`[getSparkGroup] Group content not available: ${groupId}`);
  }
  peer[cacheKey] = group;
  return group;
}
async function getSparksRegistryId(peer) {
  const sparksId = peer.account?.get?.("sparks");
  if (!sparksId?.startsWith("co_z"))
    return null;
  return sparksId;
}
async function getSparksRegistryContent(peer) {
  const sparksId = await getSparksRegistryId(peer);
  if (!sparksId?.startsWith("co_z"))
    return null;
  const sparksStore = await peer.read(null, sparksId);
  await waitForStoreReady(sparksStore, sparksId, 1e4);
  const fromStore = sparksStore?.value ?? {};
  const live = readLiveSparksRegistryEntries(peer, sparksId);
  const merged = { ...fromStore, ...live };
  return {
    get(key) {
      const v = merged[key];
      return typeof v === "string" && v.startsWith("co_z") ? v : undefined;
    }
  };
}
async function resolveSparkCoId(peer, spark) {
  if (!spark || typeof spark !== "string")
    return null;
  if (spark.startsWith("co_z"))
    return spark;
  const sparks = await getSparksRegistryContent(peer);
  if (!sparks)
    return null;
  return sparks.get(spark) ?? null;
}
async function getSparkOsMetaFactoryCoId(peer, spark) {
  const effectiveSpark = spark ?? peer?.systemSparkCoId ?? "°maia";
  const osId = await getSparkOsId(peer, effectiveSpark);
  if (!osId?.startsWith("co_z"))
    return null;
  if (peer.node?.loadCoValueCore) {
    await peer.node.loadCoValueCore(osId).catch(() => {});
  }
  const osCore = peer.getCoValue?.(osId) ?? peer.node?.getCoValue?.(osId);
  if (!osCore?.isAvailable?.())
    return null;
  const osContent = peer.getCurrentContent?.(osCore) ?? osCore.getCurrentContent?.();
  if (!osContent || typeof osContent.get !== "function")
    return null;
  const coId = osContent.get(SPARK_OS_META_FACTORY_CO_ID_KEY);
  return typeof coId === "string" && coId.startsWith("co_z") ? coId : null;
}
async function getSparkOsId(peer, spark) {
  const sparkCoId = await resolveSparkCoId(peer, spark);
  if (!sparkCoId?.startsWith("co_z"))
    return null;
  const sparkStore = await peer.read(null, sparkCoId);
  await waitForStoreReady(sparkStore, sparkCoId, 1e4);
  const sparkData = sparkStore?.value ?? {};
  let osId = sparkData.os || null;
  if (!osId?.startsWith("co_z")) {
    osId = readCoMapCoIdField(peer, sparkCoId, "os");
  }
  if (osId)
    peer._cachedMaiaOsId = osId;
  return osId;
}
async function getSparkVibesId(peer, spark) {
  const osId = await getSparkOsId(peer, spark);
  if (!osId?.startsWith("co_z"))
    return null;
  const osStore = await peer.read(null, osId);
  await waitForStoreReady(osStore, osId, 1e4);
  const osData = osStore?.value ?? {};
  let vibesId = osData.vibes ?? null;
  if (!vibesId?.startsWith("co_z")) {
    vibesId = readCoMapCoIdField(peer, osId, "vibes");
  }
  return vibesId;
}
async function setSparkVibesId(peer, spark, vibesId) {
  const osId = await getSparkOsId(peer, spark);
  if (!osId?.startsWith("co_z"))
    throw new Error(`[setSparkVibesId] Spark ${spark} has no os`);
  const osStore = await peer.read(null, osId);
  await waitForStoreReady(osStore, osId, 1e4);
  const osCore = peer.getCoValue(osId);
  if (!osCore || !peer.isAvailable(osCore))
    throw new Error(`[setSparkVibesId] OS not available: ${osId}`);
  const osContent = peer.getCurrentContent(osCore);
  if (!osContent || typeof osContent.set !== "function")
    throw new Error(`[setSparkVibesId] OS content not available`);
  osContent.set("vibes", vibesId);
}
async function getMaiaGroup(peer) {
  return getSparkGroup(peer, "°maia");
}
async function addGroupMember(node, group, accountCoId, role, peer = null) {
  if (typeof group.addMember !== "function") {
    throw new Error("[MaiaDB] Group does not support addMember");
  }
  if (!accountCoId?.startsWith("co_z")) {
    throw new Error("[MaiaDB] accountCoId required (co_z...). Human must sign in from maia first so account syncs.");
  }
  if (peer) {
    await ensureCoValueLoaded3(peer, accountCoId, { waitForAvailable: true, timeoutMs: 1e4 });
  }
  const accountCore = node.expectCoValueLoaded(accountCoId, "Expected account loaded. Human must sign in from maia at least once so account syncs.");
  const accountContent = accountCore.getCurrentContent();
  let agentId = null;
  if (typeof accountContent?.currentAgentID === "function") {
    agentId = accountContent.currentAgentID();
  } else if (accountCore.verified?.header?.ruleset?.type === "group") {
    const raw = accountCore.verified.header.ruleset.initialAdmin;
    if (typeof raw === "string" && raw.startsWith("sealer_") && raw.includes("/signer_")) {
      agentId = raw;
    }
  }
  if (!agentId) {
    throw new Error("[addGroupMember] Could not resolve agent ID from account. Human must sign in from maia at least once.");
  }
  const accountLike = { id: accountCoId, currentAgentID: () => agentId };
  group.addMember(accountLike, role);
}
async function setGroupMemberRole(node, group, memberId, role) {
  if (typeof group.setRole === "function") {
    group.setRole(memberId, role);
  } else if (typeof group.removeMember === "function" && typeof group.addMember === "function") {
    group.removeMember(memberId);
    await addGroupMember(node, group, memberId, role, null);
  } else {
    throw new Error("[MaiaDB] Group does not support role changes");
  }
}
var init_groups = () => {};

// _cojson_src/cotypes/coBinary.js
import {
  createFactoryMeta,
  FACTORY_REGISTRY,
  isExceptionFactory
} from "@MaiaOS/validation/peer-factory-registry";

async function createCoBinary(accountOrGroup, factoryName, _node = null, dbEngine = null) {
  let group = accountOrGroup;
  if (accountOrGroup && typeof accountOrGroup.get === "function") {
    const profileId = accountOrGroup.get("profile");
    if (profileId) {
      const peer = dbEngine?.peer;
      if (!peer) {
        throw new Error("[createCoBinary] dbEngine.peer required when passing account");
      }
      const { getSparkGroup: getSparkGroup2 } = await Promise.resolve().then(() => (init_groups(), exports_groups));
      group = await getSparkGroup2(peer, "°maia");
      if (!group) {
        throw new Error("[createCoBinary] °maia spark group not found. Ensure bootstrap has run.");
      }
    }
  }
  if (!factoryName || typeof factoryName !== "string") {
    throw new Error("[createCoBinary] Schema name is REQUIRED.");
  }
  if (!isExceptionFactory(factoryName) && !factoryName.startsWith("co_z") && !(factoryName in FACTORY_REGISTRY)) {
    throw new Error(`[createCoBinary] Schema '${factoryName}' not found. Available: AccountFactory, ProfileFactory`);
  }
  const meta = createFactoryMeta(factoryName);
  const binaryMeta = { ...meta, type: "binary" };
  return group.createBinaryStream(binaryMeta);
}
var init_coBinary = () => {};

// _cojson_src/cotypes/coList.js
import {
  createFactoryMeta as createFactoryMeta2,
  EXCEPTION_FACTORIES,
  FACTORY_REGISTRY as FACTORY_REGISTRY2,
  isExceptionFactory as isExceptionFactory2
} from "@MaiaOS/validation/peer-factory-registry";

async function authoringResolve(peer, identifier, options) {
  const { resolve: resolve2 } = await Promise.resolve().then(() => (init_authoring_resolver(), exports_authoring_resolver));
  return resolve2(peer, identifier, options);
}
async function createCoList(accountOrGroup, init = [], factoryName, _node = null, dbEngine = null, nanoid = null) {
  let group = accountOrGroup;
  if (accountOrGroup && typeof accountOrGroup.get === "function") {
    const profileId = accountOrGroup.get("profile");
    if (profileId) {
      const peer = dbEngine?.peer;
      if (!peer) {
        throw new Error("[createCoList] dbEngine.peer required when passing account (to resolve °maia spark group)");
      }
      const { getSparkGroup: getSparkGroup2 } = await Promise.resolve().then(() => (init_groups(), exports_groups));
      group = await getSparkGroup2(peer, "°maia");
      if (!group) {
        throw new Error("[createCoList] °maia spark group not found. Ensure bootstrap has run.");
      }
    }
  }
  if (factoryName === EXCEPTION_FACTORIES.META_SCHEMA) {
    const peer = dbEngine?.peer;
    let metaFactoryRef = EXCEPTION_FACTORIES.META_SCHEMA;
    if (peer) {
      const { getSparkOsMetaFactoryCoId: getSparkOsMetaFactoryCoId2 } = await Promise.resolve().then(() => (init_groups(), exports_groups));
      const metaCoId = await getSparkOsMetaFactoryCoId2(peer);
      if (metaCoId)
        metaFactoryRef = metaCoId;
    }
    const meta2 = createFactoryMeta2(metaFactoryRef, nanoid);
    return group.createList(init, meta2);
  }
  if (!factoryName || typeof factoryName !== "string") {
    throw new Error("[createCoList] Schema name is REQUIRED.");
  }
  if (!isExceptionFactory2(factoryName) && !factoryName.startsWith("co_z") && !(factoryName in FACTORY_REGISTRY2)) {
    throw new Error(`[createCoList] Schema '${factoryName}' not found. Use a co_z factory co-id or AccountFactory|ProfileFactory.`);
  }
  if (!isExceptionFactory2(factoryName)) {
    const { loadFactoryAndValidate } = await import("@MaiaOS/validation/validation.helper");
    await loadFactoryAndValidate(dbEngine?.peer || null, factoryName, init, "createCoList", {
      dataEngine: dbEngine,
      resolve: authoringResolve
    });
  }
  const meta = createFactoryMeta2(factoryName, nanoid);
  const colist = group.createList(init, meta);
  return colist;
}
var init_coList = () => {};

// _cojson_src/cotypes/coMap.js
import {
  createFactoryMeta as createFactoryMeta3,
  EXCEPTION_FACTORIES as EXCEPTION_FACTORIES2,
  FACTORY_REGISTRY as FACTORY_REGISTRY3,
  isExceptionFactory as isExceptionFactory3
} from "@MaiaOS/validation/peer-factory-registry";

async function authoringResolve2(peer, identifier, options) {
  const { resolve: resolve2 } = await Promise.resolve().then(() => (init_authoring_resolver(), exports_authoring_resolver));
  return resolve2(peer, identifier, options);
}
async function createCoMap(accountOrGroup, init = {}, factoryName, _node = null, dbEngine = null, nanoid = null) {
  let group = accountOrGroup;
  if (accountOrGroup && typeof accountOrGroup.createMap === "function") {
    group = accountOrGroup;
  } else if (accountOrGroup && typeof accountOrGroup.get === "function") {
    const profileId = accountOrGroup.get("profile");
    if (profileId) {
      const peer = dbEngine?.peer;
      if (!peer) {
        throw new Error("[createCoMap] dbEngine.peer required when passing account (to resolve °maia spark group)");
      }
      const { getSparkGroup: getSparkGroup2 } = await Promise.resolve().then(() => (init_groups(), exports_groups));
      group = await getSparkGroup2(peer, "°maia");
      if (!group) {
        throw new Error("[createCoMap] °maia spark group not found. Ensure bootstrap has run.");
      }
    }
  }
  if (factoryName === EXCEPTION_FACTORIES2.META_SCHEMA) {
    const peer = dbEngine?.peer;
    let metaFactoryRef = EXCEPTION_FACTORIES2.META_SCHEMA;
    if (peer) {
      const { getSparkOsMetaFactoryCoId: getSparkOsMetaFactoryCoId2 } = await Promise.resolve().then(() => (init_groups(), exports_groups));
      const metaCoId = await getSparkOsMetaFactoryCoId2(peer);
      if (metaCoId)
        metaFactoryRef = metaCoId;
    }
    return group.createMap(init, createFactoryMeta3(metaFactoryRef, nanoid));
  }
  if (!factoryName || typeof factoryName !== "string") {
    throw new Error("[createCoMap] Schema name is REQUIRED.");
  }
  if (!isExceptionFactory3(factoryName) && !factoryName.startsWith("co_z") && !(factoryName in FACTORY_REGISTRY3)) {
    throw new Error(`[createCoMap] Schema '${factoryName}' not found. Use a co_z factory co-id or AccountFactory|ProfileFactory.`);
  }
  if (!isExceptionFactory3(factoryName)) {
    const { loadFactoryAndValidate } = await import("@MaiaOS/validation/validation.helper");
    await loadFactoryAndValidate(dbEngine?.peer || null, factoryName, init, "createCoMap", {
      dataEngine: dbEngine,
      resolve: authoringResolve2
    });
  }
  const meta = createFactoryMeta3(factoryName, nanoid);
  const comap = group.createMap(init, meta);
  return comap;
}
var init_coMap = () => {};

// _cojson_src/cotypes/coStream.js
import {
  createFactoryMeta as createFactoryMeta4,
  FACTORY_REGISTRY as FACTORY_REGISTRY4,
  isExceptionFactory as isExceptionFactory4
} from "@MaiaOS/validation/peer-factory-registry";

async function createCoStream(accountOrGroup, factoryName, _node = null, dbEngine = null) {
  let group = accountOrGroup;
  if (accountOrGroup && typeof accountOrGroup.get === "function") {
    const profileId = accountOrGroup.get("profile");
    if (profileId) {
      const peer = dbEngine?.peer;
      if (!peer) {
        throw new Error("[createCoStream] dbEngine.peer required when passing account");
      }
      const { getSparkGroup: getSparkGroup2 } = await Promise.resolve().then(() => (init_groups(), exports_groups));
      group = await getSparkGroup2(peer, "°maia");
      if (!group) {
        throw new Error("[createCoStream] °maia spark group not found. Ensure bootstrap has run.");
      }
    }
  }
  if (!factoryName || typeof factoryName !== "string") {
    throw new Error("[createCoStream] Schema name is REQUIRED.");
  }
  if (!isExceptionFactory4(factoryName) && !factoryName.startsWith("co_z") && !(factoryName in FACTORY_REGISTRY4)) {
    throw new Error(`[createCoStream] Schema '${factoryName}' not found. Available: AccountFactory, ProfileFactory`);
  }
  const meta = createFactoryMeta4(factoryName);
  return group.createStream(undefined, "private", meta);
}
var init_coStream = () => {};

// _cojson_src/covalue/create-covalue-for-spark.js
var exports_create_covalue_for_spark = {};
__export(exports_create_covalue_for_spark, {
  createCoValueForSpark: () => createCoValueForSpark
});

import { normalizeCoValueData as normalizeCoValueData2 } from "../primitives/data-extraction.js";

async function resolveContext(context, spark) {
  if (context.node && context.account && context.guardian) {
    return {
      node: context.node,
      account: context.account,
      guardian: context.guardian
    };
  }
  if (context.node && context.account && spark) {
    const guardian = await getSparkGroup(context, spark);
    return { node: context.node, account: context.account, guardian };
  }
  throw new Error("[createCoValueForSpark] Invalid context. Provide peer (with node, account) + spark, or { node, account, guardian }.");
}
async function createCoValueForSpark(context, spark, options) {
  const { factory, cotype, data, dataEngine, isFactoryDefinition, nanoid } = options;
  if (!factory || typeof factory !== "string") {
    throw new Error("[createCoValueForSpark] options.factory is required");
  }
  if (!cotype || !["comap", "colist", "costream", "cobinary"].includes(cotype)) {
    throw new Error("[createCoValueForSpark] options.cotype must be comap, colist, costream, or cobinary");
  }
  if (isFactoryDefinition && cotype !== "comap") {
    throw new Error(`[createCoValueForSpark] Factory definitions must be CoMap, not ${cotype}. ` + "The cotype in factory JSON describes instances (inbox instances are CoStreams), not the factory document.");
  }
  const { node, account, guardian } = await resolveContext(context, spark);
  if (!account) {
    throw new Error("[createCoValueForSpark] Account required");
  }
  const group = node.createGroup();
  group.extend(guardian, "admin");
  let coValue;
  switch (cotype) {
    case "comap":
      coValue = await createCoMap(group, normalizeCoValueData2(data ?? {}), factory, node, dataEngine, nanoid);
      break;
    case "colist":
      coValue = await createCoList(group, Array.isArray(data) ? data.map((item) => normalizeCoValueData2(item)) : [], factory, node, dataEngine, nanoid);
      break;
    case "costream":
      coValue = await createCoStream(group, factory, node, dataEngine);
      break;
    case "cobinary":
      coValue = await createCoBinary(group, factory, node, dataEngine);
      break;
    default:
      throw new Error(`[createCoValueForSpark] Unsupported cotype: ${cotype}`);
  }
  const memberIdToRemove = typeof node.getCurrentAccountOrAgentID === "function" ? node.getCurrentAccountOrAgentID() : account?.id ?? account?.$jazz?.id;
  try {
    await removeGroupMember(group, memberIdToRemove);
  } catch (e) {
    throw new Error(`[createCoValueForSpark] Failed to remove account from group: ${e.message}`);
  }
  return { coValue };
}
var init_create_covalue_for_spark = __esm(() => {
  init_coBinary();
  init_coList();
  init_coMap();
  init_coStream();
  init_groups();
});

// _cojson_src/crud/create.js
import { perfEnginesChat } from "@MaiaOS/logs";
import { extractCoValueData } from "../primitives/data-extraction.js";
import { determineCotypeAndFlag } from "../primitives/ensure-covalue-core.js";

async function create(peer, schema, data, options = {}) {
  const spark = options.spark ?? peer.systemSparkCoId;
  if (!spark?.startsWith?.("co_z")) {
    throw new Error("[MaiaDB] create: options.spark or peer.systemSparkCoId (co_z) required");
  }
  const { cotype, isSchemaDefinition } = await determineCotypeAndFlag(peer, schema, data);
  if (!peer.account) {
    throw new Error("[MaiaDB] Account required for create");
  }
  if (cotype === "comap" && (!data || typeof data !== "object" || Array.isArray(data))) {
    throw new Error("[MaiaDB] Data must be object for comap");
  }
  if (cotype === "colist" && !Array.isArray(data)) {
    throw new Error("[MaiaDB] Data must be array for colist");
  }
  const isChatMessage = data && "role" in data && "content" in data;
  const t0 = isChatMessage ? perfEnginesChat.now() : 0;
  const { coValue } = await createCoValueForSpark(peer, spark, {
    factory: schema,
    cotype,
    data: cotype === "comap" ? data : cotype === "colist" ? data : undefined,
    dataEngine: peer.dbEngine,
    isFactoryDefinition: isSchemaDefinition && cotype === "comap"
  });
  if (isChatMessage) {
    perfEnginesChat.timing("create.createCoValueForSpark", Math.round((perfEnginesChat.now() - t0) * 100) / 100);
  }
  const coValueCore = peer.getCoValue?.(coValue?.id) ?? coValue;
  if (coValueCore && peer.isAvailable(coValueCore)) {
    const extracted2 = extractCoValueData(peer, coValueCore, schema);
    if (extracted2 && !extracted2.error) {
      return { id: coValue.id, ...data, ...extracted2 };
    }
    return { id: coValue.id, ...data, type: cotype, schema };
  }
  const store = await peer.read(null, coValue.id, null, null, { deepResolve: false });
  const { waitForStoreReady: waitForStoreReady2 } = await Promise.resolve().then(() => exports_read_operations);
  const t1 = isChatMessage ? perfEnginesChat.now() : 0;
  try {
    await waitForStoreReady2(store, coValue.id, 5000);
  } catch (_e) {
    return { id: coValue.id, ...data, type: cotype, schema };
  }
  if (isChatMessage) {
    perfEnginesChat.timing("create.waitForStoreReady", Math.round((perfEnginesChat.now() - t1) * 100) / 100);
  }
  const extracted = store.value;
  if (extracted && !extracted.error) {
    return { id: coValue.id, ...data, ...extracted };
  }
  return { id: coValue.id, ...data, type: cotype, schema };
}
var init_create = __esm(() => {
  init_create_covalue_for_spark();
});

// _cojson_src/indexing/factory-index-headers.js
function extractHeaderFromStorageMessage(msg) {
  if (!msg || typeof msg !== "object")
    return;
  let header = msg.header;
  if (!header && msg.new && typeof msg.new === "object") {
    for (const sessionId of Object.keys(msg.new)) {
      const session = msg.new[sessionId];
      if (session?.header) {
        header = session.header;
        break;
      }
      const txs = session?.newTransactions;
      if (Array.isArray(txs) && txs.length > 0 && txs[0]?.header) {
        header = txs[0].header;
        break;
      }
    }
  }
  return header;
}
function readHeaderAndContent(peer, core) {
  if (!core) {
    return { header: null, content: null, core: null };
  }
  const header = peer.getHeader?.(core) ?? null;
  if (!core.hasVerifiedContent?.()) {
    return { header, content: null, core };
  }
  try {
    const content = peer.getCurrentContent?.(core) ?? core.getCurrentContent?.() ?? null;
    return { header, content, core };
  } catch {
    return { header, content: null, core };
  }
}

// _cojson_src/indexing/factory-index-warm-load.js
import { createLogger } from "@MaiaOS/logs/subsystem-logger";
import { ensureCoValueLoaded as ensureCoValueLoaded4 } from "../primitives/ensure-covalue-core.js";

async function ensureCoValueReadyForIndex(peer, coId, timeoutMs) {
  try {
    await ensureCoValueLoaded4(peer, coId, { waitForAvailable: true, timeoutMs });
    const core = peer.getCoValue(coId);
    return Boolean(core && peer.isAvailable(core));
  } catch {
    return false;
  }
}
async function resolveFactoryAuthoring(peer, identifier, options) {
  const { resolve: resolve2 } = await Promise.resolve().then(() => (init_authoring_resolver(), exports_authoring_resolver));
  return resolve2(peer, identifier, options);
}
async function loadIndexColistContent(peer, indexColistId, timeoutMs = 8000) {
  const start = Date.now();
  let core;
  try {
    core = await ensureCoValueLoaded4(peer, indexColistId, { waitForAvailable: true, timeoutMs });
  } catch {
    return null;
  }
  if (!core?.isAvailable?.())
    return null;
  const content = peer.getCurrentContent?.(core) ?? core.getCurrentContent?.();
  if (!content)
    return null;
  const contentType = content.cotype || content.type;
  if (contentType !== "colist")
    return null;
  if (typeof process !== "undefined" && process.env?.DEBUG && Date.now() - start > 2000) {
    log.debug("[DEBUG loadIndexColistContent] slow", indexColistId, Date.now() - start, "ms");
  }
  return content;
}
var log, bootstrapWarnState;
var init_factory_index_warm_load = __esm(() => {
  log = createLogger("maia-db");
  bootstrapWarnState = { registriesMissing: false };
});

// _cojson_src/indexing/factory-index-schema.js
import { createLogger as createLogger2 } from "@MaiaOS/logs";
import { FACTORY_REF_PATTERN } from "@MaiaOS/validation";
import { EXCEPTION_FACTORIES as EXCEPTION_FACTORIES3 } from "@MaiaOS/validation/peer-factory-registry";
import { determineCotypeAndFlag as determineCotypeAndFlag2 } from "../primitives/ensure-covalue-core.js";

async function ensureOsCoMap(peer, spark) {
  const effectiveSpark = spark ?? peer?.systemSparkCoId ?? "°maia";
  if (!peer.account) {
    throw new Error("[SchemaIndexManager] Account required");
  }
  const osId = await getSparkOsId(peer, effectiveSpark);
  if (osId) {
    try {
      if (!await ensureCoValueReadyForIndex(peer, osId, 1e4))
        return null;
      const osCore = peer.getCoValue(osId);
      if (!osCore?.isAvailable())
        return null;
      const osContent = osCore.getCurrentContent?.();
      if (!osContent)
        return null;
      const contentType = osContent.cotype || osContent.type;
      const header = peer.getHeader(osCore);
      const headerMeta = header?.meta || null;
      const _schema = headerMeta?.$factory || null;
      const isCoMap = contentType === "comap" && typeof osContent.get === "function";
      if (!isCoMap)
        return null;
      return osContent;
    } catch (_e) {
      return null;
    }
  }
  const sparksTop = peer.account?.get?.("sparks");
  if (!sparksTop?.startsWith("co_z")) {
    if (!bootstrapWarnState.registriesMissing) {
      bootstrapWarnState.registriesMissing = true;
      log2.warn("[SchemaIndexManager] account.sparks not set yet (bootstrap). Indexing deferred until account.sparks is anchored.");
    }
  }
  return null;
}
async function ensureIndexesCoMap(peer) {
  const osCoMap = await ensureOsCoMap(peer);
  if (!osCoMap) {
    return null;
  }
  const indexesId = osCoMap.get("indexes");
  if (indexesId) {
    try {
      if (!await ensureCoValueReadyForIndex(peer, indexesId, 1e4))
        return null;
      const indexesCore = peer.getCoValue(indexesId);
      if (!indexesCore?.isAvailable())
        return null;
      const indexesContent = indexesCore.getCurrentContent?.();
      if (!indexesContent)
        return null;
      const contentType = indexesContent.cotype || indexesContent.type;
      const header = peer.getHeader(indexesCore);
      const headerMeta = header?.meta || null;
      const _schema = headerMeta?.$factory || null;
      const isCoMap = contentType === "comap" && typeof indexesContent.get === "function";
      if (!isCoMap)
        return null;
      return indexesContent;
    } catch (_e) {
      return null;
    }
  }
  if (peer.dbEngine?.resolveSystemFactories)
    await peer.dbEngine.resolveSystemFactories();
  const indexesSchemaCoId = peer.infra?.indexesRegistry;
  let indexesCoMapId;
  if (indexesSchemaCoId && typeof indexesSchemaCoId === "string" && indexesSchemaCoId.startsWith("co_z") && peer.dbEngine) {
    const { cotype, isSchemaDefinition } = await determineCotypeAndFlag2(peer, indexesSchemaCoId, {});
    const { coValue } = await createCoValueForSpark(peer, peer.systemSparkCoId, {
      factory: indexesSchemaCoId,
      cotype,
      data: cotype === "comap" ? {} : cotype === "colist" ? [] : undefined,
      dataEngine: peer.dbEngine,
      isFactoryDefinition: isSchemaDefinition && cotype === "comap"
    });
    indexesCoMapId = coValue.id;
  } else {
    const { coValue: indexesCoMap } = await createCoValueForSpark(peer, peer.systemSparkCoId, {
      factory: EXCEPTION_FACTORIES3.META_SCHEMA,
      cotype: "comap",
      data: {}
    });
    indexesCoMapId = indexesCoMap.id;
  }
  osCoMap.set("indexes", indexesCoMapId);
  try {
    if (await ensureCoValueReadyForIndex(peer, indexesCoMapId, 5000)) {
      const indexesCore = peer.getCoValue(indexesCoMapId);
      if (indexesCore && peer.isAvailable(indexesCore)) {
        const indexesContent = indexesCore.getCurrentContent?.();
        if (indexesContent && typeof indexesContent.get === "function") {
          return indexesContent;
        }
      }
    }
  } catch (_e) {}
  return null;
}
async function createNanoidsCoMapId(peer) {
  if (peer.dbEngine?.resolveSystemFactories)
    await peer.dbEngine.resolveSystemFactories();
  const indexesSchemaCoId = peer.infra?.indexesRegistry;
  if (indexesSchemaCoId && typeof indexesSchemaCoId === "string" && indexesSchemaCoId.startsWith("co_z") && peer.dbEngine) {
    const { cotype, isSchemaDefinition } = await determineCotypeAndFlag2(peer, indexesSchemaCoId, {});
    const { coValue } = await createCoValueForSpark(peer, peer.systemSparkCoId, {
      factory: indexesSchemaCoId,
      cotype,
      data: cotype === "comap" ? {} : cotype === "colist" ? [] : undefined,
      dataEngine: peer.dbEngine,
      isFactoryDefinition: isSchemaDefinition && cotype === "comap"
    });
    return coValue.id;
  }
  const { coValue: nanoidsCoMap } = await createCoValueForSpark(peer, peer.systemSparkCoId, {
    factory: EXCEPTION_FACTORIES3.META_SCHEMA,
    cotype: "comap",
    data: {}
  });
  return nanoidsCoMap.id;
}
async function loadNanoidCoMapContentById(peer, coId) {
  if (typeof coId !== "string" || !coId.startsWith("co_z"))
    return null;
  try {
    if (!await ensureCoValueReadyForIndex(peer, coId, 1e4))
      return null;
    const core = peer.getCoValue(coId);
    if (!core?.isAvailable())
      return null;
    const nanoidsContent = core.getCurrentContent?.();
    if (!nanoidsContent)
      return null;
    const contentType = nanoidsContent.cotype || nanoidsContent.type;
    const isCoMap = contentType === "comap" && typeof nanoidsContent.get === "function";
    if (!isCoMap)
      return null;
    return nanoidsContent;
  } catch (_e) {
    return null;
  }
}
async function ensureNanoidIndexCoMap(peer) {
  const osCoMap = await ensureOsCoMap(peer);
  if (!osCoMap)
    return null;
  const indexesContent = await ensureIndexesCoMap(peer);
  if (!indexesContent || typeof indexesContent.get !== "function")
    return null;
  const existingId = indexesContent.get(NANOID_INDEX_KEY);
  if (existingId) {
    const loaded = await loadNanoidCoMapContentById(peer, existingId);
    if (loaded)
      return loaded;
  }
  const nanoidsCoMapId = await createNanoidsCoMapId(peer);
  if (!nanoidsCoMapId?.startsWith?.("co_z"))
    return null;
  indexesContent.set(NANOID_INDEX_KEY, nanoidsCoMapId);
  try {
    if (await ensureCoValueReadyForIndex(peer, nanoidsCoMapId, 5000)) {
      const nanoidsCore = peer.getCoValue(nanoidsCoMapId);
      if (nanoidsCore && peer.isAvailable(nanoidsCore)) {
        const nanoidsContent = nanoidsCore.getCurrentContent?.();
        if (nanoidsContent && typeof nanoidsContent.get === "function") {
          return nanoidsContent;
        }
      }
    }
  } catch (_e) {}
  return null;
}
async function loadNanoidIndex(peer) {
  return ensureNanoidIndexCoMap(peer);
}
async function getMetafactoryCoId(peer) {
  if (peer.infra?.meta?.startsWith("co_z")) {
    return peer.infra.meta;
  }
  const spark = peer?.systemSparkCoId;
  const osId = await getSparkOsId(peer, spark);
  if (!osId)
    return null;
  const osCore = peer.node.getCoValue(osId);
  if (!osCore || osCore.type !== "comap")
    return null;
  const osContent = osCore.getCurrentContent?.();
  if (!osContent || typeof osContent.get !== "function")
    return null;
  const metaSchemaCoId = osContent.get(SPARK_OS_META_FACTORY_CO_ID_KEY);
  if (metaSchemaCoId && typeof metaSchemaCoId === "string" && metaSchemaCoId.startsWith("co_z")) {
    return metaSchemaCoId;
  }
  return null;
}
async function ensureSchemaSpecificIndexColistSchema(peer, factoryCoId, metaSchemaCoId = null) {
  if (!factoryCoId?.startsWith("co_z")) {
    throw new Error(`[SchemaIndexManager] Invalid schema co-id: ${factoryCoId}`);
  }
  const schemaCoValueCore = peer.getCoValue(factoryCoId);
  let schemaMapContent = null;
  if (schemaCoValueCore) {
    const sLoaded = readHeaderAndContent(peer, schemaCoValueCore);
    schemaMapContent = sLoaded?.content ?? null;
    if (schemaMapContent && typeof schemaMapContent.get === "function") {
      const existingIdx = schemaMapContent.get("indexColistFactoryCoId");
      if (typeof existingIdx === "string" && existingIdx.startsWith("co_z")) {
        return existingIdx;
      }
    }
  }
  if (!metaSchemaCoId) {
    if (schemaCoValueCore) {
      const header = peer.getHeader(schemaCoValueCore);
      const headerMeta = header?.meta;
      metaSchemaCoId = headerMeta?.$factory;
      if (metaSchemaCoId && !metaSchemaCoId.startsWith("co_z")) {
        metaSchemaCoId = peer.infra?.meta ?? null;
      }
    }
    if (!metaSchemaCoId?.startsWith("co_z")) {
      metaSchemaCoId = await getMetafactoryCoId(peer) || peer.infra?.meta;
    }
  }
  if (!metaSchemaCoId?.startsWith("co_z"))
    return null;
  const factoryDef = await resolveFactoryAuthoring(peer, factoryCoId, { returnType: "factory" });
  if (!factoryDef) {
    if (typeof process !== "undefined" && process.env?.DEBUG)
      log2.error("factoryDef missing");
    return null;
  }
  const factoryTitle = factoryDef.title || factoryDef.$id;
  if (!factoryTitle || typeof factoryTitle !== "string" || !FACTORY_REF_PATTERN.test(factoryTitle)) {
    return null;
  }
  const match = factoryTitle.match(SCHEMA_REF_MATCH);
  if (!match)
    return null;
  const [, prefix, path] = match;
  const indexColistFactoryTitle = `${prefix}/factory/index/${path}`;
  const indexColistFactoryDef = {
    title: indexColistFactoryTitle,
    description: `Factory-specific index colist for ${factoryTitle} - only allows instances of this factory`,
    cotype: "colist",
    indexing: false,
    items: {
      $co: factoryCoId
    }
  };
  try {
    const { cotype, isSchemaDefinition } = await determineCotypeAndFlag2(peer, metaSchemaCoId, indexColistFactoryDef);
    const { coValue: createdFactory } = await createCoValueForSpark(peer, peer.systemSparkCoId, {
      factory: metaSchemaCoId,
      cotype,
      data: cotype === "comap" ? indexColistFactoryDef : cotype === "colist" ? [] : undefined,
      dataEngine: peer.dbEngine,
      isFactoryDefinition: isSchemaDefinition && cotype === "comap"
    });
    const indexColistFactoryCoId = createdFactory.id;
    if (schemaMapContent && typeof schemaMapContent.set === "function") {
      try {
        schemaMapContent.set("indexColistFactoryCoId", indexColistFactoryCoId);
      } catch (_e) {}
    }
    return indexColistFactoryCoId;
  } catch (_error) {
    return null;
  }
}
async function ensureFactoryIndexColist(peer, factoryCoId, metaSchemaCoId = null) {
  if (!factoryCoId || typeof factoryCoId !== "string" || !factoryCoId.startsWith("co_z")) {
    throw new Error(`[SchemaIndexManager] Invalid schema co-id: expected string starting with 'co_z', got ${typeof factoryCoId}: ${factoryCoId}`);
  }
  const factoryDef = await resolveFactoryAuthoring(peer, factoryCoId, { returnType: "factory" });
  if (!factoryDef)
    return null;
  if (factoryDef.indexing !== true) {
    return null;
  }
  const indexesCoMap = await ensureIndexesCoMap(peer);
  if (!indexesCoMap) {
    return null;
  }
  let indexColistId = indexesCoMap.get(factoryCoId);
  if (indexColistId) {
    const indexColistContent = await loadIndexColistContent(peer, indexColistId, 8000);
    if (indexColistContent && typeof indexColistContent.append === "function") {
      return indexColistContent;
    }
    return null;
  }
  const indexSchemaCoId = await ensureSchemaSpecificIndexColistSchema(peer, factoryCoId, metaSchemaCoId);
  if (!indexSchemaCoId)
    return null;
  const { createCoValueForSpark: createCoValueForSpark2 } = await Promise.resolve().then(() => (init_create_covalue_for_spark(), exports_create_covalue_for_spark));
  const { coValue: indexColistRaw } = await createCoValueForSpark2(peer, peer.systemSparkCoId, {
    factory: indexSchemaCoId,
    cotype: "colist",
    data: [],
    dataEngine: peer.dbEngine
  });
  indexColistId = indexColistRaw.id;
  indexesCoMap.set(factoryCoId, indexColistId);
  const indexColistCore = peer.node.getCoValue(indexColistId);
  if (indexColistCore && indexColistCore.type === "colist") {
    const indexColistContent = indexColistCore.getCurrentContent?.();
    if (indexColistContent && typeof indexColistContent.append === "function") {
      return indexColistContent;
    }
  }
  return indexColistRaw;
}
var log2, SCHEMA_REF_MATCH, NANOID_INDEX_KEY = "@nanoids";
var init_factory_index_schema = __esm(() => {
  init_create_covalue_for_spark();
  init_groups();
  init_factory_index_warm_load();
  log2 = createLogger2("maia-db");
  SCHEMA_REF_MATCH = /^([°@][a-zA-Z0-9_-]+)\/factory\/(.+)$/;
});

// _cojson_src/indexing/factory-index-manager.js
var exports_factory_index_manager = {};
__export(exports_factory_index_manager, {
  shouldIndexCoValue: () => shouldIndexCoValue,
  removeFromIndex: () => removeFromIndex,
  registerFactoryCoValue: () => registerFactoryCoValue,
  reconcileIndexes: () => reconcileIndexes,
  readHeaderAndContent: () => readHeaderAndContent,
  loadNanoidIndex: () => loadNanoidIndex,
  isFactoryCoValue: () => isFactoryCoValue,
  indexFromMessage: () => indexFromMessage,
  indexCoValue: () => indexCoValue,
  indexByNanoid: () => indexByNanoid,
  getMetafactoryCoId: () => getMetafactoryCoId,
  factoryDefAllowsInstanceIndexing: () => factoryDefAllowsInstanceIndexing,
  extractHeaderFromStorageMessage: () => extractHeaderFromStorageMessage,
  ensureUnknownColist: () => ensureUnknownColist,
  ensureNanoidIndexCoMap: () => ensureNanoidIndexCoMap,
  ensureIndexesCoMap: () => ensureIndexesCoMap,
  ensureFactoryIndexColist: () => ensureFactoryIndexColist,
  applyPersistentCoValueIndexing: () => applyPersistentCoValueIndexing,
  appendFactoryDefinitionToCatalog: () => appendFactoryDefinitionToCatalog,
  NANOID_INDEX_KEY: () => NANOID_INDEX_KEY
});

import { FACTORY_REF_PATTERN as FACTORY_REF_PATTERN2 } from "@MaiaOS/validation";
import { EXCEPTION_FACTORIES as EXCEPTION_FACTORIES4 } from "@MaiaOS/validation/peer-factory-registry";
import { removeIdFields as removeIdFields2 } from "@MaiaOS/validation/remove-id-fields";
import { ensureCoValueLoaded as ensureCoValueLoaded5 } from "../primitives/ensure-covalue-core.js";

async function ensureUnknownColist(peer) {
  const osCoMap = await ensureOsCoMap(peer);
  if (!osCoMap)
    return null;
  const unknownColistId = osCoMap.get("unknown");
  if (unknownColistId) {
    const unknownColistCore = peer.node.getCoValue(unknownColistId);
    if (unknownColistCore && unknownColistCore.type === "colist") {
      const unknownColistContent = unknownColistCore.getCurrentContent?.();
      if (unknownColistContent && typeof unknownColistContent.append === "function") {
        return unknownColistContent;
      }
    }
  }
  const { createCoValueForSpark: createCoValueForSpark2 } = await Promise.resolve().then(() => (init_create_covalue_for_spark(), exports_create_covalue_for_spark));
  const { coValue: unknownColist } = await createCoValueForSpark2(peer, peer.systemSparkCoId, {
    factory: EXCEPTION_FACTORIES4.META_SCHEMA,
    cotype: "colist",
    data: []
  });
  osCoMap.set("unknown", unknownColist.id);
  return unknownColist;
}
async function isInternalCoValue(peer, coId) {
  if (!peer.account || !coId) {
    return false;
  }
  const osId = await getSparkOsId(peer, peer?.systemSparkCoId);
  if (coId === osId) {
    return true;
  }
  if (osId) {
    const osCore = peer.node.getCoValue(osId);
    if (osCore && osCore.type === "comap") {
      const osContent = osCore.getCurrentContent?.();
      if (osContent && typeof osContent.get === "function") {
        const unknownId = osContent.get("unknown");
        if (coId === unknownId) {
          return true;
        }
        const indexesId = osContent.get("indexes");
        if (coId === indexesId) {
          return true;
        }
        if (indexesId) {
          const indexesCore = peer.node.getCoValue(indexesId);
          if (indexesCore && indexesCore.type === "comap") {
            const indexesContent = indexesCore.getCurrentContent?.();
            if (indexesContent && typeof indexesContent.get === "function") {
              const keys = indexesContent.keys && typeof indexesContent.keys === "function" ? indexesContent.keys() : Object.keys(indexesContent);
              for (const key of keys) {
                if (indexesContent.get(key) === coId) {
                  return true;
                }
              }
            }
          }
        }
      }
    }
  }
  return false;
}
async function indexByNanoidFromHeader(peer, coId, header) {
  if (!coId?.startsWith("co_z") || !header)
    return;
  if (await isInternalCoValue(peer, coId))
    return;
  const nanoid = header?.meta?.$nanoid;
  if (typeof nanoid !== "string" || nanoid.length === 0)
    return;
  const nanoidsContent = await ensureNanoidIndexCoMap(peer);
  if (!nanoidsContent || typeof nanoidsContent.set !== "function")
    return;
  try {
    nanoidsContent.set(nanoid, coId);
  } catch (_e) {}
}
async function indexByNanoid(peer, coValueCore) {
  if (!coValueCore?.id || !peer.isAvailable(coValueCore))
    return;
  const header = peer.getHeader(coValueCore);
  if (!header)
    return;
  return indexByNanoidFromHeader(peer, coValueCore.id, header);
}
async function indexFromMessage(peer, msg) {
  const coId = msg?.id;
  if (!coId?.startsWith("co_z"))
    return;
  const core = peer.getCoValue(coId);
  if (!core || !peer.isAvailable(core))
    return;
  if (core.hasVerifiedContent?.()) {
    return applyPersistentCoValueIndexing(peer, core);
  }
  const fromMsg = extractHeaderFromStorageMessage(msg);
  const header = fromMsg || peer.getHeader(core);
  if (header) {
    await indexByNanoidFromHeader(peer, coId, header);
  }
}
function factoryDefAllowsInstanceIndexing(factoryDef) {
  return factoryDef != null && factoryDef.indexing === true;
}
async function shouldIndexCoValue(peer, coValueCore) {
  if (!coValueCore) {
    return { shouldIndex: false, factoryCoId: null };
  }
  const isInternal = await isInternalCoValue(peer, coValueCore.id);
  if (isInternal) {
    return { shouldIndex: false, factoryCoId: null };
  }
  const header = peer.getHeader(coValueCore);
  if (!header?.meta) {
    return { shouldIndex: false, factoryCoId: null };
  }
  const headerMeta = header.meta;
  const schema = headerMeta.$factory;
  if (EXCEPTION_FACTORIES4.ACCOUNT === schema || EXCEPTION_FACTORIES4.GROUP === schema || EXCEPTION_FACTORIES4.META_SCHEMA === schema) {
    return { shouldIndex: false, factoryCoId: null };
  }
  if (headerMeta.type === "account" || schema === EXCEPTION_FACTORIES4.ACCOUNT) {
    return { shouldIndex: false, factoryCoId: null };
  }
  const ruleset = coValueCore.ruleset || header?.ruleset;
  if (ruleset && ruleset.type === "group") {
    return { shouldIndex: false, factoryCoId: null };
  }
  if (schema && typeof schema === "string" && schema.startsWith("co_z")) {
    try {
      const factoryDef = await resolveFactoryAuthoring(peer, schema, { returnType: "factory" });
      if (!factoryDefAllowsInstanceIndexing(factoryDef)) {
        return { shouldIndex: false, factoryCoId: schema };
      }
      return { shouldIndex: true, factoryCoId: schema };
    } catch (_error) {
      return { shouldIndex: false, factoryCoId: schema };
    }
  }
  if (!schema) {
    return { shouldIndex: false, factoryCoId: null };
  }
  return { shouldIndex: false, factoryCoId: null };
}
async function ensureDefinitionCatalogColistId(peer, metaCoId) {
  const indexesCoMap = await ensureIndexesCoMap(peer);
  if (!indexesCoMap)
    return null;
  const catalogColistId = indexesCoMap.get(metaCoId);
  if (catalogColistId && typeof catalogColistId === "string" && catalogColistId.startsWith("co_z")) {
    return catalogColistId;
  }
  const metaForItems = await getMetafactoryCoId(peer) || peer?.infra?.meta;
  if (!metaForItems?.startsWith?.("co_z"))
    return null;
  const catalogSchemaDef = {
    title: "°maia/factory/index/definitions-catalog",
    description: "Colist of factory definition co_zs",
    cotype: "colist",
    indexing: false,
    items: { $co: metaForItems }
  };
  try {
    const created = await create(peer, metaCoId, removeIdFields2(catalogSchemaDef));
    const catalogSchemaCoId = created?.id;
    if (!catalogSchemaCoId?.startsWith("co_z"))
      return null;
    const colist = await create(peer, catalogSchemaCoId, []);
    const colistId = colist?.id;
    if (!colistId?.startsWith("co_z"))
      return null;
    indexesCoMap.set(metaCoId, colistId);
    return colistId;
  } catch (_e) {
    return null;
  }
}
async function appendFactoryDefinitionToCatalog(peer, defCoId) {
  if (!defCoId?.startsWith("co_z"))
    return;
  const metaCoId = await getMetafactoryCoId(peer);
  if (!metaCoId)
    return;
  const catalogColistId = await ensureDefinitionCatalogColistId(peer, metaCoId);
  if (!catalogColistId)
    return;
  const catCore = peer.getCoValue(catalogColistId);
  const loaded = readHeaderAndContent(peer, catCore);
  const colistContent = loaded?.content;
  if (!colistContent || typeof colistContent.append !== "function")
    return;
  try {
    const items = colistContent.toJSON?.() ?? [];
    if (Array.isArray(items) && items.includes(defCoId))
      return;
    colistContent.append(defCoId);
  } catch (_e) {}
}
async function registerFactoryCoValue(peer, schemaCoValueCore) {
  if (!schemaCoValueCore?.id) {
    return;
  }
  const loaded = readHeaderAndContent(peer, schemaCoValueCore);
  if (!loaded?.content || typeof loaded.content.get !== "function") {
    return;
  }
  const { core: defCore, content } = loaded;
  const title = content.get("title");
  if (!title || typeof title !== "string" || !FACTORY_REF_PATTERN2.test(title)) {
    return;
  }
  await appendFactoryDefinitionToCatalog(peer, defCore.id);
  const indexing = content.get("indexing");
  if (indexing !== true) {
    return;
  }
  const header = peer.getHeader(defCore);
  const headerMeta = header?.meta;
  let metaSchemaCoId = headerMeta?.$factory;
  if (metaSchemaCoId && !metaSchemaCoId.startsWith("co_z")) {
    metaSchemaCoId = peer.infra?.meta ?? null;
  }
  await ensureFactoryIndexColist(peer, defCore.id, metaSchemaCoId);
}
async function applyPersistentCoValueIndexing(peer, coValueCore) {
  if (!coValueCore?.id || !peer.isAvailable(coValueCore))
    return;
  await indexByNanoid(peer, coValueCore);
  if (await isFactoryCoValue(peer, coValueCore)) {
    await registerFactoryCoValue(peer, coValueCore);
    return;
  }
  const { shouldIndex } = await shouldIndexCoValue(peer, coValueCore);
  if (!shouldIndex)
    return;
  await indexCoValue(peer, coValueCore);
}
async function isFactoryCoValue(peer, coValueCore) {
  if (!coValueCore) {
    return false;
  }
  const header = peer.getHeader(coValueCore);
  if (!header?.meta) {
    return false;
  }
  const headerMeta = header.meta;
  const schema = headerMeta.$factory;
  if (!schema) {
    return false;
  }
  if (schema === EXCEPTION_FACTORIES4.META_SCHEMA) {
    const { content } = readHeaderAndContent(peer, coValueCore);
    if (content && typeof content.get === "function") {
      const title = content.get("title");
      if (title === "°maia/factory/meta.factory.maia") {
        return true;
      }
    }
    return false;
  }
  if (schema && typeof schema === "string" && schema.startsWith("co_z")) {
    try {
      let referencedCoValueCore = peer.getCoValue(schema);
      if (!referencedCoValueCore) {
        referencedCoValueCore = await ensureCoValueLoaded5(peer, schema, {
          waitForAvailable: true,
          timeoutMs: 5000
        });
      }
      if (referencedCoValueCore?.isAvailable()) {
        const { content: referencedContent } = readHeaderAndContent(peer, referencedCoValueCore);
        if (referencedContent && typeof referencedContent.get === "function") {
          const referencedTitle = referencedContent.get("title");
          if (referencedTitle === "°maia/factory/meta.factory.maia") {
            return true;
          }
        }
      }
    } catch (_e) {}
    const metaSchemaCoId = await getMetafactoryCoId(peer);
    if (metaSchemaCoId && schema === metaSchemaCoId) {
      return true;
    }
  }
  return false;
}
async function indexCoValue(peer, coValueCoreOrId) {
  let coValueCore = coValueCoreOrId;
  let coId = null;
  if (typeof coValueCoreOrId === "string") {
    coId = coValueCoreOrId;
    coValueCore = peer.getCoValue(coId);
    if (!coValueCore || !peer.isAvailable(coValueCore)) {
      if (peer.node?.loadCoValueCore) {
        await peer.node.loadCoValueCore(coId).catch(() => {});
      }
      coValueCore = peer.getCoValue(coId);
    }
    if (!coValueCore || !peer.isAvailable(coValueCore)) {
      return;
    }
  } else {
    coId = coValueCoreOrId?.id;
  }
  if (!coValueCore || !coId) {
    return;
  }
  if (indexingInProgress.has(coId)) {
    return;
  }
  indexingInProgress.add(coId);
  try {
    const { shouldIndex, factoryCoId } = await shouldIndexCoValue(peer, coValueCore);
    if (shouldIndex && factoryCoId) {
      const indexColist = await ensureFactoryIndexColist(peer, factoryCoId);
      if (!indexColist) {
        return;
      }
      try {
        const items = indexColist.toJSON ? indexColist.toJSON() : [];
        if (Array.isArray(items) && items.includes(coId)) {
          return;
        }
      } catch (_e) {}
      try {
        indexColist.append(coId);
      } catch (_e) {
        return;
      }
    } else if (!factoryCoId) {
      const unknownColist = await ensureUnknownColist(peer);
      if (!unknownColist) {
        return;
      }
      try {
        const items = unknownColist.toJSON ? unknownColist.toJSON() : [];
        if (Array.isArray(items) && items.includes(coId)) {
          return;
        }
      } catch (_e) {}
      unknownColist.append(coId);
    }
  } finally {
    indexingInProgress.delete(coId);
  }
}
async function reconcileIndexes(peer, options = {}) {
  const { batchSize: _batchSize = 100, delayMs: _delayMs = 10 } = options;
  if (!peer.account) {
    return { indexed: 0, skipped: 0, errors: 0 };
  }
  const indexesCoMap = await ensureIndexesCoMap(peer);
  if (!indexesCoMap) {
    return { indexed: 0, skipped: 0, errors: 0 };
  }
  const schemaIndexColists = new Map;
  const keys = indexesCoMap.keys && typeof indexesCoMap.keys === "function" ? indexesCoMap.keys() : [];
  for (const key of keys) {
    if (key.startsWith("co_z")) {
      const indexColistId = indexesCoMap.get(key);
      if (indexColistId) {
        const indexColistContent = await loadIndexColistContent(peer, indexColistId, 2000);
        if (indexColistContent && typeof indexColistContent.toJSON === "function") {
          schemaIndexColists.set(key, indexColistContent);
        }
      }
    }
  }
  const indexed = 0;
  const skipped = 0;
  const errors = 0;
  return { indexed, skipped, errors };
}
async function getFactoryIndexColistForRemoval(peer, factoryCoId) {
  if (!factoryCoId?.startsWith("co_z")) {
    return null;
  }
  if (!peer.account) {
    return null;
  }
  const indexesCoMap = await ensureIndexesCoMap(peer);
  if (!indexesCoMap) {
    return null;
  }
  const indexColistId = indexesCoMap.get(factoryCoId);
  if (!indexColistId || typeof indexColistId !== "string" || !indexColistId.startsWith("co_")) {
    return null;
  }
  const indexColistContent = await loadIndexColistContent(peer, indexColistId, 2000);
  if (indexColistContent && typeof indexColistContent.toJSON === "function" && typeof indexColistContent.delete === "function") {
    return indexColistContent;
  }
  return null;
}
async function removeFromIndex(peer, coId, factoryCoId = null) {
  if (!coId?.startsWith("co_z"))
    return;
  function removeAllFromColist(colist, id) {
    if (!colist?.toJSON || !colist?.delete)
      return;
    const items = colist.toJSON();
    for (let i = items.length - 1;i >= 0; i--) {
      if (items[i] === id)
        colist.delete(i);
    }
  }
  if (!factoryCoId) {
    const coValueCore = peer.getCoValue(coId);
    if (coValueCore && peer.isAvailable(coValueCore)) {
      const header = peer.getHeader(coValueCore);
      if (header?.meta) {
        factoryCoId = header.meta.$factory;
      }
    }
  }
  if (factoryCoId && typeof factoryCoId === "string" && factoryCoId.startsWith("co_z")) {
    const indexColist = await getFactoryIndexColistForRemoval(peer, factoryCoId);
    removeAllFromColist(indexColist, coId);
  } else {
    const unknownColist = await ensureUnknownColist(peer);
    removeAllFromColist(unknownColist, coId);
  }
}
var indexingInProgress;
var init_factory_index_manager = __esm(() => {
  init_create();
  init_groups();
  init_factory_index_schema();
  init_factory_index_warm_load();
  init_factory_index_schema();
  indexingInProgress = new Set;
});

// _cojson_src/crud/collection-helpers.js
import { createLogger as createLogger4 } from "@MaiaOS/logs";
import { 
  ensureCoValueAvailable,ensureCoValueLoaded as ensureCoValueLoaded6, 
  ensureCoValueLoaded as ensureCoValueLoaded7} from "../primitives/ensure-covalue-core.js";

async function getFactoryIndexColistId(peer, schema) {
  if (!schema?.startsWith?.("co_z")) {
    throw new Error(`[getFactoryIndexColistId] schema must be co_z co-id, got: ${schema}`);
  }
  const factoryCoId = schema;
  if (typeof process !== "undefined" && process.env?.DEBUG)
    log4.debug("[DEBUG getFactoryIndexColistId] schema=", schema, "factoryCoId=", factoryCoId);
  if (!factoryCoId)
    return null;
  const indexesCoMap = await ensureIndexesCoMap(peer);
  if (typeof process !== "undefined" && process.env?.DEBUG)
    log4.debug("[DEBUG getFactoryIndexColistId] indexesCoMap=", !!indexesCoMap);
  if (!indexesCoMap)
    return null;
  const indexColistId = indexesCoMap.get(factoryCoId);
  if (indexColistId && typeof indexColistId === "string" && indexColistId.startsWith("co_")) {
    if (typeof process !== "undefined" && process.env?.DEBUG)
      log4.debug("[DEBUG getFactoryIndexColistId] found indexColistId=", indexColistId);
    return indexColistId;
  }
  try {
    await ensureFactoryIndexColist(peer, factoryCoId);
    const idAfter = indexesCoMap.get(factoryCoId);
    if (idAfter && typeof idAfter === "string" && idAfter.startsWith("co_z")) {
      if (typeof process !== "undefined" && process.env?.DEBUG)
        log4.debug("[DEBUG getFactoryIndexColistId] ensured indexColistId=", idAfter);
      return idAfter;
    }
    return null;
  } catch (e) {
    if (typeof process !== "undefined" && process.env?.DEBUG)
      log4.error("[DEBUG getFactoryIndexColistId] error=", e);
    return null;
  }
}
async function getCoListId(peer, collectionNameOrSchema) {
  if (!collectionNameOrSchema || typeof collectionNameOrSchema !== "string") {
    return null;
  }
  if (!collectionNameOrSchema.startsWith("co_z")) {
    throw new Error(`[getCoListId] schema must be co_z co-id, got: ${collectionNameOrSchema}`);
  }
  const colistId = await getFactoryIndexColistId(peer, collectionNameOrSchema);
  return colistId;
}
async function waitForHeaderMetaFactory(peer, coId, options = {}) {
  const { timeoutMs = 1e4 } = options;
  if (!coId?.startsWith("co_")) {
    throw new Error(`[waitForHeaderMetaFactory] Invalid co-id: ${coId}`);
  }
  await ensureCoValueLoaded6(peer, coId, { waitForAvailable: true, timeoutMs });
  const coValueCore = peer.getCoValue(coId) ?? peer.node?.getCoValue?.(coId);
  if (!coValueCore) {
    throw new Error(`[waitForHeaderMetaFactory] CoValueCore not found: ${coId}`);
  }
  const header = peer.getHeader(coValueCore);
  const headerMeta = header?.meta || null;
  const factoryCoId = headerMeta?.$factory || null;
  if (factoryCoId && typeof factoryCoId === "string" && factoryCoId.startsWith("co_z")) {
    return factoryCoId;
  }
  return new Promise((resolve2, reject) => {
    let resolved = false;
    let unsubscribe;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (unsubscribe)
          unsubscribe();
        reject(new Error(`[waitForHeaderMetaFactory] Timeout waiting for headerMeta.$schema in CoValue ${coId} after ${timeoutMs}ms`));
      }
    }, timeoutMs);
    unsubscribe = coValueCore.subscribe((core) => {
      if (resolved)
        return;
      const updatedHeader = peer.getHeader(core);
      const updatedHeaderMeta = updatedHeader?.meta || null;
      const updatedSchemaCoId = updatedHeaderMeta?.$factory || null;
      if (updatedSchemaCoId && typeof updatedSchemaCoId === "string" && updatedSchemaCoId.startsWith("co_z")) {
        resolved = true;
        clearTimeout(timeout);
        unsubscribe();
        resolve2(updatedSchemaCoId);
      }
    });
    const currentHeader = peer.getHeader(coValueCore);
    const currentHeaderMeta = currentHeader?.meta || null;
    const currentSchemaCoId = currentHeaderMeta?.$factory || null;
    if (currentSchemaCoId && typeof currentSchemaCoId === "string" && currentSchemaCoId.startsWith("co_z")) {
      resolved = true;
      clearTimeout(timeout);
      unsubscribe();
      resolve2(currentSchemaCoId);
    }
  });
}
var log4;
var init_collection_helpers = __esm(() => {
  init_factory_index_schema();
  log4 = createLogger4("maia-db");
});

// _cojson_src/crud/filter-helpers.js
function matchesFilter(data, filter) {
  if (Array.isArray(data)) {
    return data.some((item) => {
      for (const [key, value] of Object.entries(filter)) {
        if (item[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }
  if (data && typeof data === "object") {
    for (const [key, value] of Object.entries(filter)) {
      if (data[key] !== value) {
        return false;
      }
    }
    return true;
  }
  return false;
}

// _cojson_src/crud/deep-resolution.js
import { observeCoValue as observeCoValue2 } from "../primitives/co-cache.js";
import { extractCoValueData as extractCoValueData2 } from "../primitives/data-extraction.js";

function isDeepResolvedOrResolving(coId, peer = null) {
  if (peer?.subscriptionCache) {
    return peer.subscriptionCache.isResolved(coId);
  }
  return false;
}
function extractCoValueIds(data, visited = new Set, depth = 0, maxDepth = 15) {
  const coIds = new Set;
  if (depth > maxDepth) {
    return coIds;
  }
  if (!data || typeof data !== "object") {
    return coIds;
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const itemIds = extractCoValueIds(item, visited, depth + 1, maxDepth);
      itemIds.forEach((id) => {
        if (!visited.has(id)) {
          coIds.add(id);
        }
      });
    }
    return coIds;
  }
  for (const [key, value] of Object.entries(data)) {
    if (key === "id" || key === "$factory" || key === "type" || key === "loading" || key === "error") {
      continue;
    }
    if (typeof value === "string" && value.startsWith("co_")) {
      if (!visited.has(value)) {
        coIds.add(value);
      }
    } else if (typeof value === "object" && value !== null) {
      const nestedIds = extractCoValueIds(value, visited, depth + 1, maxDepth);
      nestedIds.forEach((id) => {
        if (!visited.has(id)) {
          coIds.add(id);
        }
      });
    }
  }
  return coIds;
}
async function resolveNestedReferences(peer, data, visited = new Set, options = {}) {
  const {
    maxDepth = 15,
    timeoutMs = 5000,
    currentDepth = 0
  } = options;
  const _indent = "  ".repeat(currentDepth);
  const _depthPrefix = `[DeepResolution:depth${currentDepth}]`;
  if (currentDepth > maxDepth) {
    return;
  }
  const coIds = extractCoValueIds(data, visited, currentDepth, maxDepth);
  if (coIds.size === 0) {
    return;
  }
  const loadPromises = Array.from(coIds).map(async (coId) => {
    if (visited.has(coId)) {
      return;
    }
    visited.add(coId);
    try {
      const coValueCore = peer.getCoValue(coId);
      if (!coValueCore) {
        return;
      }
      if (!peer.isAvailable(coValueCore)) {
        ensureCoValueLoaded7(peer, coId, { waitForAvailable: false }).catch((_err) => {});
        const loadingUnsubscribe = coValueCore.subscribe(async (core) => {
          if (peer.isAvailable(core)) {
            try {
              const nestedData2 = extractCoValueData2(peer, core);
              await resolveNestedReferences(peer, nestedData2, visited, {
                maxDepth,
                timeoutMs,
                currentDepth: currentDepth + 1
              });
              observeCoValue2(peer, coId).subscribe(() => {});
              loadingUnsubscribe();
            } catch (_err) {}
          }
        });
        return;
      }
      const nestedData = extractCoValueData2(peer, coValueCore);
      await resolveNestedReferences(peer, nestedData, visited, {
        maxDepth,
        timeoutMs,
        currentDepth: currentDepth + 1
      });
      observeCoValue2(peer, coId).subscribe(async (core) => {
        if (peer.isAvailable(core)) {
          try {
            const nestedData2 = extractCoValueData2(peer, core);
            resolveNestedReferences(peer, nestedData2, visited, {
              maxDepth,
              timeoutMs,
              currentDepth: currentDepth + 1
            }).catch((_err) => {});
          } catch (_err) {}
        }
      });
    } catch (_error) {}
  });
  Promise.all(loadPromises).catch((_err) => {});
}
async function deepResolveCoValue(peer, coId, options = {}) {
  const { deepResolve = true, maxDepth = 15, timeoutMs = 5000 } = options;
  const _debugPrefix = `[deepResolveCoValue:${coId.substring(0, 12)}...]`;
  if (!deepResolve) {
    return;
  }
  const cache = peer.subscriptionCache;
  if (cache.isResolved(coId)) {
    return;
  }
  const resolutionPromise = cache.getOrCreateResolution(coId, () => {
    return (async () => {
      try {
        const _startTime = Date.now();
        await ensureCoValueLoaded7(peer, coId, { waitForAvailable: true, timeoutMs });
        const coValueCore = peer.getCoValue(coId);
        if (!coValueCore || !peer.isAvailable(coValueCore)) {
          throw new Error(`CoValue ${coId} failed to load`);
        }
        const data = extractCoValueData2(peer, coValueCore);
        const visited = new Set([coId]);
        resolveNestedReferences(peer, data, visited, {
          maxDepth,
          timeoutMs,
          currentDepth: 0
        }).catch((_err) => {});
        cache.markResolved(coId);
      } catch (error) {
        cache.destroy(`resolution:${coId}`);
        throw error;
      }
    })();
  });
  if (resolutionPromise === true) {
    return;
  }
  await resolutionPromise;
}
async function resolveNestedReferencesPublic(peer, data, options = {}) {
  return await resolveNestedReferences(peer, data, new Set, options);
}
var init_deep_resolution = __esm(() => {
  init_collection_helpers();
});

// _cojson_src/crud/read-helpers.js
import { createLogger as createLogger5 } from "@MaiaOS/logs";

async function resolveSchemaLazy(peer, identifier, options) {
  const { resolve: resolve2 } = await Promise.resolve().then(() => (init_authoring_resolver(), exports_authoring_resolver));
  return resolve2(peer, identifier, options);
}
function debugLog2(...args) {
  if (typeof process !== "undefined" && process.env?.DEBUG)
    log5.debug(...args);
}
function makeSingleCoCleanup(peer, coId, coUnsub, depUnsubs, origUnsub, extra = null, readStoreCacheKey = null, storeToMarkDead = null) {
  return () => {
    if (origUnsub)
      origUnsub();
    if (extra)
      extra();
    coUnsub();
    for (const u of depUnsubs.values())
      u();
    depUnsubs.clear();
    peer.subscriptionCache.scheduleCleanup(`observer:${coId}`);
    if (readStoreCacheKey)
      peer.subscriptionCache.evict(readStoreCacheKey);
    if (storeToMarkDead)
      storeToMarkDead._maiaReadReactiveDead = true;
  };
}
function isFindOneFilter(filter) {
  return filter && typeof filter === "object" && Object.keys(filter).length === 1 && filter.id && typeof filter.id === "string" && filter.id.startsWith("co_z");
}
function isQueryObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !value.factory)
    return false;
  if (value.op && !["query", "read"].includes(value.op) && typeof value.factory === "string")
    return false;
  return true;
}
function getQueryFilterFromValue(value) {
  return value?.options?.filter ?? null;
}
function getQueryMapFromValue(value) {
  return value?.options?.map ?? null;
}
function ensureDerivedLifecycle(store) {
  if (!store._lifecycle) {
    store._lifecycle = {
      live: false,
      unsubscribeHooked: false,
      baseUnsubscribe: undefined,
      runState: { running: false, queued: false },
      collectionSubscribedItemIds: new Set,
      collectionSubscribedResolvedRefKeys: new Set,
      collectionSharedVisited: new Set,
      allCoValuesSubscribedIds: new Set,
      registryReaderWired: false
    };
  }
  return store._lifecycle;
}
function setMaiaReadDerivedStoreLive(store, live) {
  ensureDerivedLifecycle(store).live = live;
}
function getMapDependencyCoIds(rawData, mapConfig) {
  if (!mapConfig || typeof mapConfig !== "object" || !rawData || typeof rawData !== "object") {
    return new Set;
  }
  const deps = new Set;
  for (const expression of Object.values(mapConfig)) {
    if (typeof expression !== "string")
      continue;
    if (expression === "*")
      continue;
    const path = expression.startsWith("$$") ? expression.substring(2) : expression.startsWith("$") ? expression.substring(1) : null;
    if (!path)
      continue;
    const rootProperty = path.split(".")[0];
    if (rootProperty && rootProperty in rawData) {
      const val = rawData[rootProperty];
      if (typeof val === "string" && val.startsWith("co_z")) {
        deps.add(val);
      }
    }
  }
  return deps;
}
var log5;
var init_read_helpers = __esm(() => {
  log5 = createLogger5("maia-db");
});

// _cojson_src/crud/read-all-covalues.js
import { observeCoValue as observeCoValue3 } from "../primitives/co-cache.js";
import { extractCoValueData as extractCoValueData3 } from "../primitives/data-extraction.js";
import { ReactiveStore as ReactiveStore3 } from "../primitives/reactive-store.js";

async function readAllCoValues(peer, filter = null, options = {}) {
  const { deepResolve = true, maxDepth = 15, timeoutMs = 5000 } = options;
  const cacheKey = `allCoValues:${JSON.stringify(filter || {})}:${deepResolve}:${maxDepth}:${timeoutMs}`;
  const store = peer.subscriptionCache.getOrCreateStore(cacheKey, () => {
    const s = new ReactiveStore3([]);
    s._cacheKey = `store:${cacheKey}`;
    return s;
  });
  const allLc = ensureDerivedLifecycle(store);
  if (allLc.live) {
    return store;
  }
  const subscribedCoIds = allLc.allCoValuesSubscribedIds;
  const runState = allLc.runState;
  let updateStore = async () => {};
  const subscribeToCoValue = (coId) => {
    if (subscribedCoIds.has(coId)) {
      return;
    }
    subscribedCoIds.add(coId);
    observeCoValue3(peer, coId).subscribe(() => {
      updateStore();
    });
  };
  const runUpdateStore = async () => {
    const allCoValues = peer.getAllCoValues();
    const results = [];
    for (const [coId, coValueCore] of allCoValues.entries()) {
      if (!coId || typeof coId !== "string" || !coId.startsWith("co_")) {
        continue;
      }
      subscribeToCoValue(coId);
      if (!peer.isAvailable(coValueCore)) {
        ensureCoValueLoaded7(peer, coId).catch(debugLog2);
        continue;
      }
      const data = extractCoValueData3(peer, coValueCore);
      const dataKeys = Object.keys(data).filter((key) => !["id", "type", "$factory"].includes(key));
      if (dataKeys.length === 0 && data.type === "comap") {
        continue;
      }
      if (deepResolve) {
        try {
          await resolveNestedReferencesPublic(peer, data, { maxDepth, timeoutMs });
        } catch (_err) {}
      }
      if (!filter || matchesFilter(data, filter)) {
        results.push(data);
      }
    }
    store._set(results);
  };
  updateStore = async () => {
    if (runState.running) {
      runState.queued = true;
      return;
    }
    runState.running = true;
    try {
      await runUpdateStore();
    } finally {
      runState.running = false;
      if (runState.queued) {
        runState.queued = false;
        queueMicrotask(() => updateStore().catch(debugLog2));
      }
    }
  };
  await updateStore();
  if (!allLc.unsubscribeHooked) {
    allLc.unsubscribeHooked = true;
    const previousUnsubscribe = store._unsubscribe;
    store._unsubscribe = () => {
      allLc.live = false;
      allLc.unsubscribeHooked = false;
      setMaiaReadDerivedStoreLive(store, false);
      if (previousUnsubscribe)
        previousUnsubscribe();
      for (const coId of subscribedCoIds) {
        peer.subscriptionCache.scheduleCleanup(`observer:${coId}`);
      }
    };
  }
  setMaiaReadDerivedStoreLive(store, true);
  return store;
}
var init_read_all_covalues = __esm(() => {
  init_collection_helpers();
  init_deep_resolution();
  init_read_helpers();
});

// _cojson_src/crud/map-transform.js
import { resolveCoIdShallow } from "../primitives/data-extraction.js";

async function getValueAtPathWithResolution(peer, item, path, visited, options = {}) {
  const parts = path.split(".");
  let current = item;
  for (const part of parts) {
    if (current == null)
      return;
    const key = /^\d+$/.test(part) ? parseInt(part, 10) : part;
    let value = current[key];
    while (typeof value === "string" && value.startsWith("co_z")) {
      if (visited.has(value))
        return;
      const resolved = await resolveCoIdShallow(peer, value, options, visited);
      value = resolved;
    }
    current = value;
  }
  return current;
}
function getValueAtPathNoResolve(item, path) {
  if (!item || typeof path !== "string")
    return;
  return path.split(".").reduce((acc, key) => acc?.[key], item);
}
function parseMapExpression(expression) {
  if (typeof expression !== "string")
    return null;
  const normalized = expression.startsWith("$$") ? `$${expression.slice(2)}` : expression;
  const pathExpr = normalized.startsWith("$") ? normalized.substring(1) : normalized;
  const isResolve = normalized.startsWith("$");
  const asDataUrlSuffix = pathExpr.endsWith(":asDataUrl");
  const path = asDataUrlSuffix ? pathExpr.slice(0, -10) : pathExpr;
  return { path, isResolve, asDataUrl: false };
}
function collectKeysToDepth(obj, maxDepth, currentDepth = 0) {
  if (currentDepth >= maxDepth || !obj || typeof obj !== "object" || Array.isArray(obj)) {
    return {};
  }
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "$factory")
      continue;
    if (value != null && typeof value === "object" && !Array.isArray(value) && typeof value !== "string") {
      const nested = collectKeysToDepth(value, maxDepth, currentDepth + 1);
      result[key] = Object.keys(nested).length ? nested : value;
    } else {
      result[key] = value;
    }
  }
  return result;
}
async function applyMapTransform(peer, item, mapConfig, options = {}) {
  if (!mapConfig || typeof mapConfig !== "object") {
    return item;
  }
  const { timeoutMs = 2000 } = options;
  const visited = new Set;
  const mappedItem = { ...item };
  const coIdsToRemove = new Set;
  for (const [targetField, expression] of Object.entries(mapConfig)) {
    try {
      if (targetField === "*" && typeof expression === "string") {
        const depth = parseInt(expression, 10);
        if (depth >= 1 && depth <= 8) {
          const expanded = collectKeysToDepth(item, depth);
          for (const [k, v] of Object.entries(expanded)) {
            mappedItem[k] = v;
          }
        }
        continue;
      }
      if (typeof expression === "object" && expression !== null && Array.isArray(expression.$mapFields)) {
        mappedItem[targetField] = expression.$mapFields.map((f) => ({
          label: f?.label ?? "",
          value: f?.valuePath ? getValueAtPathNoResolve(item, f.valuePath) : ""
        }));
        continue;
      }
      const parsed = parseMapExpression(expression);
      if (!parsed) {
        mappedItem[targetField] = undefined;
        continue;
      }
      if (!parsed.isResolve) {
        mappedItem[targetField] = item[parsed.path];
        continue;
      }
      const path = parsed.path;
      const rootProperty = path.split(".")[0];
      if (rootProperty && rootProperty in item && rootProperty !== targetField) {
        const originalValue = item[rootProperty];
        if (originalValue && typeof originalValue === "string" && originalValue.startsWith("co_z")) {
          coIdsToRemove.add(rootProperty);
        }
      }
      const mappedValue = await getValueAtPathWithResolution(peer, item, path, visited, {
        timeoutMs
      });
      mappedItem[targetField] = mappedValue;
    } catch (_err) {
      mappedItem[targetField] = undefined;
    }
  }
  for (const coIdKey of coIdsToRemove) {
    delete mappedItem[coIdKey];
  }
  return mappedItem;
}
async function applyMapTransformToArray(peer, items, mapConfig, options = {}) {
  if (!Array.isArray(items)) {
    return items;
  }
  return Promise.all(items.map((item) => applyMapTransform(peer, item, mapConfig, options)));
}
var init_map_transform = () => {};

// _cojson_src/crud/read-collection.js
import { perfDbRead } from "@MaiaOS/logs";
import { observeCoValue as observeCoValue4 } from "../primitives/co-cache.js";
import { extractCoValueData as extractCoValueData4 } from "../primitives/data-extraction.js";
import { ReactiveStore as ReactiveStore4 } from "../primitives/reactive-store.js";

async function readCollection(peer, schema, filter = null, options = {}) {
  const { deepResolve = true, maxDepth = 15, timeoutMs = 5000, map = null } = options;
  const optionsKey = options?.map ? JSON.stringify({ map: options.map }) : "";
  const cacheKey = `${schema}:${JSON.stringify(filter || {})}:${optionsKey}`;
  const store = peer.subscriptionCache.getOrCreateStore(cacheKey, () => {
    const s = new ReactiveStore4([]);
    s._cacheKey = `store:${cacheKey}`;
    return s;
  });
  const lc = ensureDerivedLifecycle(store);
  if (lc.live) {
    return store;
  }
  const coListId = await getCoListId(peer, schema);
  if (typeof process !== "undefined" && process.env?.DEBUG)
    log5.debug("[DEBUG readCollection] schema=", schema, "coListId=", coListId);
  if (!coListId) {
    return store;
  }
  const coListCore = peer.getCoValue(coListId);
  if (!coListCore) {
    return store;
  }
  const subscribedItemIds = lc.collectionSubscribedItemIds;
  const subscribedResolvedRefKeys = lc.collectionSubscribedResolvedRefKeys;
  const sharedVisited = lc.collectionSharedVisited;
  const cache = peer.subscriptionCache;
  let updateStore = async () => {};
  const runState = lc.runState;
  const subscribeToResolvedRef = (refCoId, parentItemId) => {
    if (!refCoId || typeof refCoId !== "string" || !refCoId.startsWith("co_"))
      return;
    const refKey = `subscription:ref:${refCoId}:${parentItemId}`;
    if (subscribedResolvedRefKeys.has(refKey))
      return;
    subscribedResolvedRefKeys.add(refKey);
    const setupSub = () => {
      const unsub = observeCoValue4(peer, refCoId).subscribe(() => {
        cache.invalidateResolvedData(parentItemId);
        if (updateStore)
          updateStore().catch((_e) => {});
      });
      peer.subscriptionCache.getOrCreate(refKey, () => ({ unsubscribe: unsub }));
    };
    const refCore = peer.getCoValue(refCoId);
    if (refCore && peer.isAvailable(refCore)) {
      setupSub();
    } else {
      ensureCoValueLoaded7(peer, refCoId, { waitForAvailable: true, timeoutMs: 2000 }).then(() => {
        if (peer.getCoValue(refCoId))
          setupSub();
      }).catch(() => {});
    }
  };
  const onItemChange = (id) => {
    cache.invalidateResolvedData(id);
    if (updateStore)
      updateStore().catch(debugLog2);
  };
  const wireItemSubscription = (core, id) => {
    if (!core || !peer.isAvailable(core))
      return;
    observeCoValue4(peer, id).subscribe(() => onItemChange(id));
    if (updateStore)
      updateStore().catch(debugLog2);
  };
  const subscribeToItem = (itemId) => {
    if (subscribedItemIds.has(itemId))
      return;
    subscribedItemIds.add(itemId);
    const itemCore = peer.getCoValue(itemId);
    if (!itemCore || !peer.isAvailable(itemCore)) {
      ensureCoValueLoaded7(peer, itemId, { waitForAvailable: true, timeoutMs: 2000 }).then(() => wireItemSubscription(peer.getCoValue(itemId), itemId)).catch(debugLog2);
      return;
    }
    wireItemSubscription(itemCore, itemId);
  };
  const runUpdateStore = async () => {
    perfDbRead.start(`updateStore schema=${schema}`);
    let resultCount = 0;
    try {
      const results = [];
      if (!peer.isAvailable(coListCore)) {
        ensureCoValueLoaded7(peer, coListId).catch(debugLog2);
        store._set(Array.isArray(store.value) ? store.value : []);
        return;
      }
      const content = peer.getCurrentContent(coListCore);
      if (!content?.toJSON) {
        store._set(Array.isArray(store.value) ? store.value : []);
        return;
      }
      try {
        const itemIdsArray = content.toJSON();
        const seenIds = new Set;
        for (const itemId of itemIdsArray) {
          if (typeof itemId !== "string" || !itemId.startsWith("co_")) {
            continue;
          }
          if (seenIds.has(itemId))
            continue;
          seenIds.add(itemId);
          subscribeToItem(itemId);
          const itemCore = peer.getCoValue(itemId);
          if (!itemCore) {
            continue;
          }
          if (peer.isAvailable(itemCore)) {
            const itemCacheOptions = { deepResolve, map, maxDepth, timeoutMs };
            const currentItemCore = peer.getCoValue(itemId);
            if (!currentItemCore || !peer.isAvailable(currentItemCore)) {
              continue;
            }
            const itemData = await cache.getOrCreateResolvedData(itemId, itemCacheOptions, async () => {
              let processedData = extractCoValueData4(peer, currentItemCore);
              if (map) {
                const deps = getMapDependencyCoIds(processedData, map);
                for (const coId of deps) {
                  subscribeToResolvedRef(coId, itemId);
                }
              }
              const dataKeys2 = Object.keys(processedData).filter((key) => !["id", "type", "$factory"].includes(key));
              if (dataKeys2.length === 0 && processedData.type === "comap") {
                return processedData;
              }
              if (deepResolve && !map && !cache.isResolved(itemId)) {
                try {
                  await resolveNestedReferences(peer, processedData, sharedVisited, {
                    maxDepth,
                    timeoutMs,
                    currentDepth: 0
                  });
                } catch (_err) {}
              }
              if (map) {
                try {
                  processedData = await applyMapTransform(peer, processedData, map, {
                    timeoutMs
                  });
                } catch (_err) {
                  debugLog2(_err);
                }
              }
              return processedData;
            });
            const dataKeys = Object.keys(itemData).filter((key) => !["id", "type", "$factory"].includes(key));
            if (dataKeys.length === 0 && itemData.type === "comap") {
              continue;
            }
            if (!filter || matchesFilter(itemData, filter)) {
              results.push(itemData);
            }
          }
        }
      } catch (_e) {
        debugLog2(_e);
      }
      store._set(results);
      resultCount = results.length;
    } finally {
      perfDbRead.end(`updateStore results=${resultCount}`);
    }
  };
  updateStore = async () => {
    if (runState.running) {
      runState.queued = true;
      return;
    }
    runState.running = true;
    try {
      await runUpdateStore();
    } finally {
      runState.running = false;
      if (runState.queued) {
        runState.queued = false;
        queueMicrotask(() => updateStore().catch(debugLog2));
      }
    }
  };
  observeCoValue4(peer, coListId).subscribe(() => {
    updateStore().catch(debugLog2);
  });
  if (!peer.isAvailable(coListCore)) {
    ensureCoValueLoaded7(peer, coListId, { waitForAvailable: false }).catch(debugLog2);
    return store;
  }
  if (peer.isAvailable(coListCore)) {
    const content = peer.getCurrentContent(coListCore);
    if (content?.toJSON) {
      try {
        const itemIdsArray = content.toJSON();
        for (const itemId of itemIdsArray) {
          if (typeof itemId === "string" && itemId.startsWith("co_")) {
            const itemCore = peer.getCoValue(itemId);
            if (itemCore && !peer.isAvailable(itemCore)) {
              ensureCoValueLoaded7(peer, itemId).catch(debugLog2);
            }
          }
        }
      } catch (_e) {}
    }
  }
  await updateStore();
  if (!lc.unsubscribeHooked) {
    lc.unsubscribeHooked = true;
    const previousUnsubscribe = store._unsubscribe;
    store._unsubscribe = () => {
      lc.live = false;
      lc.unsubscribeHooked = false;
      setMaiaReadDerivedStoreLive(store, false);
      peer.subscriptionCache.scheduleCleanup(`store:${cacheKey}`);
      if (previousUnsubscribe)
        previousUnsubscribe();
      peer.subscriptionCache.scheduleCleanup(`observer:${coListId}`);
      for (const itemId of subscribedItemIds) {
        peer.subscriptionCache.scheduleCleanup(`observer:${itemId}`);
      }
      for (const refKey of subscribedResolvedRefKeys) {
        peer.subscriptionCache.scheduleCleanup(refKey);
      }
    };
  }
  setMaiaReadDerivedStoreLive(store, true);
  return store;
}
var init_read_collection = __esm(() => {
  init_collection_helpers();
  init_deep_resolution();
  init_map_transform();
  init_read_helpers();
});

// _cojson_src/crud/read-single-and-sparks.js
import { resolveExpressions } from "@MaiaOS/validation/expression-resolver.js";
import { observeCoValue as observeCoValue5 } from "../primitives/co-cache.js";
import { extractCoValueData as extractCoValueData5 } from "../primitives/data-extraction.js";
import { ReactiveStore as ReactiveStore5 } from "../primitives/reactive-store.js";

async function wireQueryStoreForSchema(peer, readFn, key, resolvedSchemaCoId, evaluatedFilter, value, queryStores, queryDefinitions, queryIsFindOne, enqueueUpdate, options, timeoutMs) {
  const isFindOne = isFindOneFilter(evaluatedFilter);
  const singleCoId = isFindOne ? evaluatedFilter.id : null;
  const queryMap = getQueryMapFromValue(value);
  const queryOptions = { ...options, timeoutMs, ...queryMap ? { map: queryMap } : {} };
  const queryStore = isFindOne && singleCoId ? await readFn(peer, singleCoId, resolvedSchemaCoId, null, null, queryOptions) : await readFn(peer, null, resolvedSchemaCoId, evaluatedFilter, null, queryOptions);
  queryIsFindOne.set(key, isFindOne);
  queryDefinitions.set(key, {
    factory: value.factory,
    filter: evaluatedFilter,
    ...queryMap ? { map: queryMap } : {}
  });
  const unsub = queryStore.subscribe(() => enqueueUpdate());
  queryStore._queryUnsubscribe = unsub;
  queryStores.set(key, queryStore);
  enqueueUpdate();
}
async function evaluateFilter(filter, contextValue, evaluator) {
  if (!filter || typeof filter !== "object") {
    return filter;
  }
  return resolveExpressions(filter, evaluator, { context: contextValue, item: {} });
}
async function createUnifiedStore(peer, contextStore, options = {}) {
  const universalRead = options.universalRead;
  if (typeof universalRead !== "function") {
    throw new Error("[read] universalRead required for createUnifiedStore");
  }
  const unifiedStore = new ReactiveStore5({});
  let unifiedInnerTeardownDone = false;
  const queryStores = new Map;
  const queryDefinitions = new Map;
  const queryIsFindOne = new Map;
  const lastCommittedQueryMerge = new Map;
  const { timeoutMs = 5000 } = options;
  const evaluator = peer.evaluator;
  if (!evaluator) {
    throw new Error("[read] Evaluator required for reactive resolution. Inject via DataEngine options at boot.");
  }
  let queueTimer = null;
  const flushUpdate = () => {
    const contextValue = contextStore.value || {};
    const mergedValue = { ...contextValue };
    delete mergedValue["@stores"];
    const $op = {};
    for (const [key, queryDef] of queryDefinitions.entries()) {
      $op[key] = queryDef;
    }
    if (Object.keys($op).length > 0) {
      mergedValue.$op = $op;
    }
    for (const [key, queryStore] of queryStores.entries()) {
      if (queryStore && typeof queryStore.subscribe === "function" && "value" in queryStore) {
        delete mergedValue[key];
        const isFindOne = queryIsFindOne.get(key) || false;
        const storeValue = queryStore.value;
        if (isFindOne) {
          if (Array.isArray(storeValue)) {
            mergedValue[key] = storeValue.length > 0 ? storeValue[0] : null;
          } else if (storeValue && typeof storeValue === "object") {
            mergedValue[key] = storeValue;
          } else {
            mergedValue[key] = null;
          }
        } else {
          mergedValue[key] = Array.isArray(storeValue) ? storeValue : [];
          const hasKey = `has${key.charAt(0).toUpperCase()}${key.slice(1)}`;
          if (hasKey in contextValue) {
            mergedValue[hasKey] = Array.isArray(storeValue) && storeValue.length > 0;
          }
        }
        lastCommittedQueryMerge.set(key, mergedValue[key]);
      }
    }
    for (const key of queryStores.keys()) {
      mergedValue[`${key}Loading`] = false;
    }
    for (const [key, value] of Object.entries(contextValue || {})) {
      if (key !== "$factory" && key !== "$id" && isQueryObject(value) && !queryStores.has(key)) {
        delete mergedValue[key];
        const prev = lastCommittedQueryMerge.get(key);
        if (prev !== undefined) {
          mergedValue[key] = prev;
          mergedValue[`${key}Loading`] = true;
          const hasKey = `has${key.charAt(0).toUpperCase()}${key.slice(1)}`;
          if (hasKey in contextValue) {
            mergedValue[hasKey] = Array.isArray(prev) ? prev.length > 0 : prev != null;
          }
        } else {
          mergedValue[key] = [];
          mergedValue[`${key}Loading`] = true;
          const hasKey = `has${key.charAt(0).toUpperCase()}${key.slice(1)}`;
          if (hasKey in contextValue) {
            mergedValue[hasKey] = false;
          }
        }
      }
    }
    unifiedStore._set(mergedValue);
  };
  const enqueueUpdate = () => {
    if (!queueTimer) {
      queueTimer = queueMicrotask(() => {
        queueTimer = null;
        flushUpdate();
      });
    }
  };
  let resolveChain = Promise.resolve();
  const scheduleResolve = (snapshotOverride) => {
    const run = async () => {
      const snapshot = snapshotOverride !== undefined ? snapshotOverride : contextStore.value || {};
      await runResolveQueriesImpl(snapshot);
    };
    resolveChain = resolveChain.then(run).catch((e) => {
      debugLog2(e);
    });
    return resolveChain;
  };
  const runResolveQueriesImpl = async (contextValue) => {
    if (!contextValue || typeof contextValue !== "object" || Array.isArray(contextValue)) {
      enqueueUpdate();
      return;
    }
    const currentQueryKeys = new Set;
    const scopeInject = {};
    for (const [key, value] of Object.entries(contextValue || {})) {
      if (isQueryObject(value) && value.factory === "@scope" && peer.account) {
        scopeInject[key] = {
          accountId: peer.account.id,
          profileId: peer.account.get?.("profile") ?? null
        };
        currentQueryKeys.add(key);
        const scopeStore = new ReactiveStore5(scopeInject[key]);
        queryStores.set(key, scopeStore);
        queryDefinitions.set(key, { factory: "@scope", filter: null });
        queryIsFindOne.set(key, true);
      }
    }
    const contextWithScope = { ...contextValue, ...scopeInject };
    for (const [key, value] of Object.entries(contextValue)) {
      if (key === "$factory" || key === "$id" || key === "@stores" || key === "properties" || key === "$defs" || key === "cotype" || key === "indexing" || key === "title" || key === "description")
        continue;
      if (isQueryObject(value)) {
        currentQueryKeys.add(key);
        if (value.factory === "@scope")
          continue;
        const evaluatedFilter = await evaluateFilter(getQueryFilterFromValue(value), contextWithScope, evaluator);
        const existingStore = queryStores.get(key);
        const storedQueryDef = queryDefinitions.get(key);
        const storedFilter = storedQueryDef?.filter || null;
        const filterChanged = JSON.stringify(evaluatedFilter) !== JSON.stringify(storedFilter);
        try {
          let factoryCoId = value.factory;
          if (factoryCoId && typeof factoryCoId === "object" && factoryCoId.$id) {
            factoryCoId = factoryCoId.$id;
          }
          if (typeof factoryCoId !== "string") {
            debugLog2("Invalid factoryCoId:", factoryCoId);
            continue;
          }
          if (!factoryCoId.startsWith("co_z")) {
            try {
              const resolved = await resolveSchemaLazy(peer, factoryCoId, {
                returnType: "coId",
                timeoutMs
              });
              if (resolved && typeof resolved === "string" && resolved.startsWith("co_z")) {
                factoryCoId = resolved;
              }
            } catch (_) {
              log5.error("[createUnifiedStore] Query schema must be co-id or resolve to co-id. Got:", factoryCoId);
              continue;
            }
            if (!factoryCoId.startsWith("co_z"))
              continue;
          }
          if (factoryCoId && typeof factoryCoId === "string" && factoryCoId.startsWith("co_z")) {
            if (filterChanged || !existingStore) {
              if (existingStore?._queryUnsubscribe) {
                existingStore._queryUnsubscribe();
              }
              await wireQueryStoreForSchema(peer, universalRead, key, factoryCoId, evaluatedFilter, value, queryStores, queryDefinitions, queryIsFindOne, enqueueUpdate, options, timeoutMs);
            }
          }
        } catch (_error) {
          debugLog2(_error);
        }
      }
    }
    for (const [key, store] of queryStores.entries()) {
      if (!currentQueryKeys.has(key)) {
        if (store._queryUnsubscribe) {
          store._queryUnsubscribe();
          delete store._queryUnsubscribe;
        }
        queryStores.delete(key);
        queryDefinitions.delete(key);
        queryIsFindOne.delete(key);
        lastCommittedQueryMerge.delete(key);
      }
    }
    enqueueUpdate();
  };
  const contextUnsubscribe = contextStore.subscribe(() => {
    scheduleResolve();
  }, { skipInitial: true });
  const originalUnsubscribe = unifiedStore._unsubscribe;
  unifiedStore._unsubscribe = () => {
    if (unifiedInnerTeardownDone)
      return;
    unifiedInnerTeardownDone = true;
    if (originalUnsubscribe)
      originalUnsubscribe();
    contextUnsubscribe();
    resolveChain = Promise.resolve();
    for (const store of queryStores.values()) {
      if (store._queryUnsubscribe) {
        store._queryUnsubscribe();
        delete store._queryUnsubscribe;
      }
      if (store._cacheKey && peer.subscriptionCache) {
        peer.subscriptionCache.scheduleCleanup(store._cacheKey);
      }
    }
    queryStores.clear();
    lastCommittedQueryMerge.clear();
  };
  unifiedStore._resolveQueries = (overrides) => {
    const merged = overrides !== undefined && overrides !== null ? { ...contextStore.value || {}, ...overrides } : undefined;
    return scheduleResolve(merged);
  };
  await scheduleResolve();
  flushUpdate();
  return unifiedStore;
}
async function processCoValueData(peer, coValueCore, schemaHint, options) {
  const { deepResolve = true, maxDepth = 15, timeoutMs = 5000, map = null } = options;
  let data = extractCoValueData5(peer, coValueCore, schemaHint);
  if (deepResolve) {
    try {
      deepResolveCoValue(peer, coValueCore.id, { deepResolve, maxDepth, timeoutMs }).catch((_err) => {});
    } catch (_err) {}
  }
  if (map) {
    try {
      data = await applyMapTransform(peer, data, map, { timeoutMs });
    } catch (_err) {
      debugLog2(_err);
    }
  }
  return data;
}
async function readSingleCoValue(peer, coId, schemaHint = null, options = {}) {
  if (typeof options.universalRead !== "function") {
    throw new Error("[read] universalRead required in options for readSingleCoValue");
  }
  const { deepResolve = true, maxDepth = 15, timeoutMs = 5000, map = null } = options;
  const cache = peer.subscriptionCache;
  const cacheOptions = { deepResolve, map, maxDepth, timeoutMs };
  const storeCacheKey = `readStore:${coId}:${JSON.stringify(cacheOptions)}`;
  const cachedStoreEntry = cache.get(storeCacheKey);
  if (cachedStoreEntry) {
    if (cachedStoreEntry._maiaReadReactiveDead === true) {
      cache.evict(storeCacheKey);
    } else {
      return cachedStoreEntry;
    }
  }
  const cachedData = cache.getResolvedData(coId, cacheOptions);
  if (cachedData) {
    const hasQueryObjects = cachedData && typeof cachedData === "object" && Object.values(cachedData).some(isQueryObject);
    const ctxStore = new ReactiveStore5(cachedData);
    const coValueCore2 = peer.getCoValue(coId);
    if (coValueCore2) {
      const processAndCacheCached = async (core) => {
        const newData = await processCoValueData(peer, core, schemaHint, options);
        cache.setResolvedData(coId, cacheOptions, newData);
        return newData;
      };
      const cacheDepUnsubs = new Map;
      const setupMapDepSubs = (mainCore) => {
        if (!map)
          return;
        const rawData = extractCoValueData5(peer, mainCore, schemaHint);
        const newDeps = getMapDependencyCoIds(rawData, map);
        for (const depCoId of newDeps) {
          if (cacheDepUnsubs.has(depCoId))
            continue;
          const depCore = peer.getCoValue(depCoId);
          if (!depCore)
            continue;
          const unsub = observeCoValue5(peer, depCoId).subscribe(async () => {
            if (!mainCore.isAvailable())
              return;
            cache.invalidateResolvedData(depCoId);
            const data = await processAndCacheCached(mainCore);
            ctxStore._set(data);
          });
          cacheDepUnsubs.set(depCoId, unsub);
        }
        for (const [depCoId, unsub] of cacheDepUnsubs.entries()) {
          if (!newDeps.has(depCoId)) {
            unsub();
            cacheDepUnsubs.delete(depCoId);
          }
        }
      };
      setupMapDepSubs(coValueCore2);
      const cacheCoUnsub = observeCoValue5(peer, coId).subscribe(async (core) => {
        if (core.isAvailable()) {
          const newData = await processAndCacheCached(core);
          setupMapDepSubs(core);
          ctxStore._set(newData);
        }
      });
      if (hasQueryObjects) {
        const unified = await createUnifiedStore(peer, ctxStore, options);
        unified._unsubscribe = makeSingleCoCleanup(peer, coId, cacheCoUnsub, cacheDepUnsubs, unified._unsubscribe, null, storeCacheKey, unified);
        cache.set(storeCacheKey, unified);
        return unified;
      }
      ctxStore._unsubscribe = makeSingleCoCleanup(peer, coId, cacheCoUnsub, cacheDepUnsubs, ctxStore._unsubscribe, null, storeCacheKey, ctxStore);
    }
    cache.set(storeCacheKey, ctxStore);
    return ctxStore;
  }
  const coValueCore = peer.getCoValue(coId);
  if (!coValueCore) {
    const errStore = new ReactiveStore5({ error: "CoValue not found", id: coId });
    return errStore;
  }
  const processAndCache = async (core) => {
    const processedData = await processCoValueData(peer, core, schemaHint, options);
    cache.setResolvedData(coId, cacheOptions, processedData);
    return processedData;
  };
  const depUnsubscribes = new Map;
  const store = new ReactiveStore5(null);
  let unifiedPipeUnsub = null;
  let queryCtxStore = null;
  const setupMapDependencySubscriptions = (mainCore) => {
    if (!map)
      return;
    const rawData = extractCoValueData5(peer, mainCore, schemaHint);
    const newDeps = getMapDependencyCoIds(rawData, map);
    for (const depCoId of newDeps) {
      if (depUnsubscribes.has(depCoId))
        continue;
      const depCore = peer.getCoValue(depCoId);
      if (!depCore)
        continue;
      const unsub = observeCoValue5(peer, depCoId).subscribe(async () => {
        if (!mainCore.isAvailable())
          return;
        cache.invalidateResolvedData(depCoId);
        const data = await processAndCache(mainCore);
        if (queryCtxStore)
          queryCtxStore._set(data);
        else
          store._set(data);
      });
      depUnsubscribes.set(depCoId, unsub);
    }
    for (const [depCoId, unsub] of depUnsubscribes.entries()) {
      if (!newDeps.has(depCoId)) {
        unsub();
        depUnsubscribes.delete(depCoId);
      }
    }
  };
  const coUnsubscribe = observeCoValue5(peer, coId).subscribe(async (core) => {
    if (!core.isAvailable()) {
      store._set({ id: coId, loading: true });
      return;
    }
    const data = await processAndCache(core);
    setupMapDependencySubscriptions(core);
    const hasQueryObjects = data && typeof data === "object" && Object.values(data).some(isQueryObject);
    if (hasQueryObjects) {
      if (!queryCtxStore) {
        queryCtxStore = new ReactiveStore5(data);
        const unified = await createUnifiedStore(peer, queryCtxStore, options);
        unifiedPipeUnsub = unified.subscribe((v) => store._set(v));
      } else {
        queryCtxStore._set(data);
      }
    } else {
      store._set(data);
    }
  });
  if (coValueCore.isAvailable()) {
    const data = await processAndCache(coValueCore);
    setupMapDependencySubscriptions(coValueCore);
    const hasQueryObjects = data && typeof data === "object" && Object.values(data).some(isQueryObject);
    if (hasQueryObjects) {
      queryCtxStore = new ReactiveStore5(data);
      const unified = await createUnifiedStore(peer, queryCtxStore, options);
      unified._unsubscribe = makeSingleCoCleanup(peer, coId, coUnsubscribe, depUnsubscribes, unified._unsubscribe, null, storeCacheKey, unified);
      cache.set(storeCacheKey, unified);
      return unified;
    }
    store._set(data);
    store._unsubscribe = makeSingleCoCleanup(peer, coId, coUnsubscribe, depUnsubscribes, store._unsubscribe, null, storeCacheKey, store);
    cache.set(storeCacheKey, store);
    return store;
  }
  store._set({ id: coId, loading: true });
  ensureCoValueLoaded7(peer, coId).then(() => {}).catch((err) => {
    store._set({ error: err.message, id: coId });
  });
  store._unsubscribe = makeSingleCoCleanup(peer, coId, coUnsubscribe, depUnsubscribes, store._unsubscribe, () => {
    if (unifiedPipeUnsub) {
      unifiedPipeUnsub();
      unifiedPipeUnsub = null;
    }
  }, storeCacheKey, store);
  cache.set(storeCacheKey, store);
  return store;
}
async function readSparksFromAccount(peer, options = {}) {
  if (typeof options.universalRead !== "function") {
    throw new Error("[read] universalRead required in options for readSparksFromAccount");
  }
  const { deepResolve = true, maxDepth = 15, timeoutMs = 5000 } = options;
  const store = peer.subscriptionCache.getOrCreateStore("sparks:account", () => {
    const s = new ReactiveStore5([]);
    s._cacheKey = "store:sparks:account";
    return s;
  });
  const sparksLc = ensureDerivedLifecycle(store);
  if (sparksLc.registryReaderWired) {
    return store;
  }
  const sparksId = await getSparksRegistryId(peer);
  if (!sparksId?.startsWith("co_")) {
    return store;
  }
  const updateSparks = async () => {
    const sparksStore2 = await readSingleCoValue(peer, sparksId, null, {
      deepResolve: false,
      universalRead: options.universalRead
    });
    try {
      await waitForStoreReady(sparksStore2, sparksId, timeoutMs);
    } catch {
      return;
    }
    const sparksData = sparksStore2?.value ?? {};
    if (sparksData?.error)
      return;
    const sparkCoIds = [];
    for (const k of Object.keys(sparksData)) {
      if (k === "id" || k === "loading" || k === "error" || k === "$factory" || k === "type")
        continue;
      const v = sparksData[k];
      const coId = typeof v === "string" && v.startsWith("co_") ? v : k.startsWith("co_") ? k : null;
      if (coId)
        sparkCoIds.push(coId);
    }
    const items = [];
    for (const coId of sparkCoIds) {
      try {
        const itemStore = await readSingleCoValue(peer, coId, null, {
          deepResolve,
          maxDepth,
          timeoutMs,
          universalRead: options.universalRead
        });
        await waitForStoreReady(itemStore, coId, Math.min(timeoutMs, 2000));
        const data = itemStore?.value;
        if (data && !data.error) {
          items.push({ id: coId, name: data.name ?? coId, ...data });
        }
      } catch {
        items.push({ id: coId, name: coId });
      }
    }
    store._set(items);
  };
  await updateSparks();
  const sparksStore = await readSingleCoValue(peer, sparksId, null, {
    deepResolve: false,
    universalRead: options.universalRead
  });
  const unsub = sparksStore?.subscribe?.(() => updateSparks());
  if (unsub) {
    peer.subscriptionCache.getOrCreate(`subscription:sparks:${sparksId}`, () => ({
      unsubscribe: unsub
    }));
  }
  sparksLc.registryReaderWired = true;
  return store;
}
var init_read_single_and_sparks = __esm(() => {
  init_groups();
  init_collection_helpers();
  init_deep_resolution();
  init_map_transform();
  init_read_helpers();
});

// _cojson_src/crud/read.js
import { extractCoValueData as extractCoValueData6 } from "../primitives/data-extraction.js";

async function findFirst(peer, schema, filter, options = {}) {
  const { timeoutMs = 2000 } = options;
  if (!filter || typeof filter !== "object")
    return null;
  const coListId = await getCoListId(peer, schema);
  if (!coListId)
    return null;
  const coListCore = peer.getCoValue(coListId);
  if (!coListCore)
    return null;
  await ensureCoValueLoaded7(peer, coListId, { waitForAvailable: true, timeoutMs });
  if (!peer.isAvailable(coListCore))
    return null;
  const content = peer.getCurrentContent(coListCore);
  if (!content?.toJSON)
    return null;
  const itemIds = content.toJSON();
  const seenIds = new Set;
  for (const itemId of itemIds) {
    if (typeof itemId !== "string" || !itemId.startsWith("co_") || seenIds.has(itemId))
      continue;
    seenIds.add(itemId);
    await ensureCoValueLoaded7(peer, itemId, { waitForAvailable: true, timeoutMs });
    const itemCore = peer.getCoValue(itemId);
    if (!itemCore || !peer.isAvailable(itemCore))
      continue;
    const itemData = extractCoValueData6(peer, itemCore);
    const dataKeys = Object.keys(itemData).filter((k) => !["id", "type", "$factory"].includes(k));
    if (dataKeys.length === 0 && itemData.type === "comap")
      continue;
    if (matchesFilter(itemData, filter)) {
      return { ...itemData, id: itemId };
    }
  }
  return null;
}
async function read(peer, coId = null, schema = null, filter = null, schemaHint = null, options = {}) {
  const {
    deepResolve = true,
    maxDepth = 15,
    timeoutMs = 5000,
    map = null,
    onChange = null
  } = options;
  const readOptions = { deepResolve, maxDepth, timeoutMs, map, onChange, universalRead: read };
  if (coId) {
    return readSingleCoValue(peer, coId, schemaHint || schema, readOptions);
  }
  if (schema) {
    const sparkSchemaCoId = peer.infra?.dataSpark;
    const resolvedSchema = typeof schema === "string" && schema.startsWith("co_z") ? schema : await resolveSchemaLazy(peer, schema, { returnType: "coId" });
    if (sparkSchemaCoId && resolvedSchema === sparkSchemaCoId) {
      return readSparksFromAccount(peer, readOptions);
    }
    return readCollection(peer, schema, filter, readOptions);
  }
  return readAllCoValues(peer, filter, { deepResolve, maxDepth, timeoutMs });
}
var init_read = __esm(() => {
  init_collection_helpers();
  init_read_all_covalues();
  init_read_collection();
  init_read_helpers();
  init_read_single_and_sparks();
});

// _cojson_src/crud/update.js
var exports_update = {};
__export(exports_update, {
  update: () => update
});

import { createLogger as createLogger6 } from "@MaiaOS/logs";
import { loadFactoryAndValidate } from "@MaiaOS/validation/validation.helper";
import { invalidateResolvedDataForMutatedCoValue } from "../primitives/co-cache.js";
import * as dataExtraction from "../primitives/data-extraction.js";

async function authoringResolve3(peer, identifier, options) {
  const { resolve: resolve2 } = await Promise.resolve().then(() => (init_authoring_resolver(), exports_authoring_resolver));
  return resolve2(peer, identifier, options);
}
async function update(peer, _schema, id, data, options = {}) {
  const { skipEnsureLoaded = false } = options;
  const coValueCore = skipEnsureLoaded ? peer.getCoValue(id) : await ensureCoValueLoaded7(peer, id, {
    waitForAvailable: true
  });
  if (!coValueCore) {
    throw new Error(`[MaiaDB] CoValue not found: ${id}`);
  }
  if (!peer.isAvailable(coValueCore)) {
    throw new Error(`[MaiaDB] CoValue not available: ${id}`);
  }
  const content = peer.getCurrentContent(coValueCore);
  const rawType = content?.type || "unknown";
  let factoryCoId = null;
  try {
    factoryCoId = await authoringResolve3(peer, { fromCoValue: id }, { returnType: "coId" });
  } catch (error) {
    log6.log(`[Update] Skipping validation for ${id}: ${error.message}`);
  }
  if (factoryCoId && peer.dbEngine && factoryCoId.startsWith("co_z")) {
    const { isExceptionFactory: isExceptionFactory5 } = await import("@MaiaOS/validation/peer-factory-registry");
    if (!isExceptionFactory5(factoryCoId)) {
      const existingDataRaw = await peer.getRawRecord(id);
      if (existingDataRaw) {
        const factoryDef = await authoringResolve3(peer, factoryCoId, { returnType: "factory" });
        const allowedKeys = factoryDef?.properties && typeof factoryDef.properties === "object" ? new Set(Object.keys(factoryDef.properties)) : null;
        const stripToSchema = (obj) => allowedKeys ? Object.fromEntries(Object.entries(obj).filter(([k]) => allowedKeys.has(k))) : Object.fromEntries(Object.entries(obj).filter(([k]) => ![
          "id",
          "$factory",
          "_coValueType",
          "type",
          "loading",
          "error",
          "groupInfo",
          "$schema",
          "$co",
          "$id",
          "$label",
          "$nanoid"
        ].includes(k)));
        const existingDataOnly = stripToSchema(existingDataRaw);
        const mergedData = { ...existingDataOnly, ...data };
        if (rawType === "comap" && content?.get && allowedKeys) {
          const skipJsonParsingFields = ["error", "message", "content", "addAgentError", "addAvenError"];
          for (const key of allowedKeys) {
            if (mergedData[key] !== undefined)
              continue;
            try {
              let v = content.get(key);
              if (typeof v === "string" && (v.startsWith("{") || v.startsWith("[")) && !skipJsonParsingFields.includes(key)) {
                try {
                  v = JSON.parse(v);
                  v = dataExtraction.normalizeCoValueData(v);
                } catch (_e) {}
              } else if (typeof v === "object" && v !== null) {
                v = dataExtraction.normalizeCoValueData(v);
              }
              if (v !== undefined)
                mergedData[key] = v;
            } catch (_e) {}
          }
        }
        try {
          await loadFactoryAndValidate(peer, factoryCoId, mergedData, `update for ${id}`, {
            dataEngine: peer.dbEngine,
            resolve: authoringResolve3
          });
        } catch (error) {
          throw new Error(`[Update] Validation failed: ${error.message}`);
        }
      }
    }
  }
  if (rawType === "comap" && content.set) {
    for (const [key, value] of Object.entries(data)) {
      content.set(key, value);
    }
  } else {
    throw new Error(`[MaiaDB] Update not supported for type: ${rawType}`);
  }
  invalidateResolvedDataForMutatedCoValue(peer, id);
  return dataExtraction.extractCoValueData(peer, coValueCore);
}
var log6;
var init_update = __esm(() => {
  init_collection_helpers();
  log6 = createLogger6("maia-db");
});

// _cojson_src/crud/delete.js
var exports_delete = {};
__export(exports_delete, {
  deleteRecord: () => deleteRecord
});
async function deleteRecord(peer, schema, id) {
  const coValueCore = await ensureCoValueLoaded7(peer, id, {
    waitForAvailable: true
  });
  if (!coValueCore) {
    throw new Error(`[MaiaDB] CoValue not found: ${id}`);
  }
  if (!peer.isAvailable(coValueCore)) {
    throw new Error(`[MaiaDB] CoValue not available: ${id}`);
  }
  const content = peer.getCurrentContent(coValueCore);
  const rawType = content?.cotype || content?.type;
  const itemHeader = peer.getHeader(coValueCore);
  const itemHeaderMeta = itemHeader?.meta || null;
  const itemSchemaCoId = itemHeaderMeta?.$factory || schema;
  await removeFromIndex(peer, id, itemSchemaCoId);
  let deletionSuccessful = false;
  if (rawType === "comap" && content.set) {
    if (content.keys && typeof content.keys === "function") {
      const keys = Array.from(content.keys());
      for (const key of keys) {
        if (typeof content.delete === "function") {
          content.delete(key);
        }
      }
    } else if (typeof content.delete === "function") {
      const keys = Object.keys(content);
      for (const key of keys) {
        content.delete(key);
      }
    }
    deletionSuccessful = true;
  } else if (rawType === "colist" && content.delete) {
    if (typeof content.toJSON === "function") {
      const items = content.toJSON();
      for (let i = items.length - 1;i >= 0; i--) {
        if (typeof content.delete === "function") {
          content.delete(i);
        }
      }
    }
    deletionSuccessful = true;
  } else if (rawType === "costream") {
    deletionSuccessful = true;
  } else {
    throw new Error(`[MaiaDB] Delete not supported for type: ${rawType}. Supported types: comap, colist, costream`);
  }
  if (deletionSuccessful && peer.node.storage) {
    await peer.node.syncManager.waitForStorageSync(id);
  }
  return deletionSuccessful;
}
var init_delete = __esm(() => {
  init_factory_index_manager();
  init_collection_helpers();
});

// _cojson_src/crud/process-inbox.js
var exports_process_inbox = {};
__export(exports_process_inbox, {
  shouldProcessInboxMessageForSession: () => shouldProcessInboxMessageForSession,
  processInbox: () => processInbox,
  findNewSuccessFromTarget: () => findNewSuccessFromTarget,
  collectInboxMessageCoIds: () => collectInboxMessageCoIds
});

import { createLogger as createLogger7, traceInboxFilter } from "@MaiaOS/logs";
import { extractCoValueData as extractCoValueData8 } from "../primitives/data-extraction.js";

function shouldProcessInboxMessageForSession(messageType, streamSessionId, currentSessionID) {
  if (messageType === "SUCCESS" || messageType === "ERROR")
    return true;
  if (streamSessionId == null || streamSessionId === "")
    return true;
  return streamSessionId === currentSessionID;
}
async function processInbox(peer, actorId, inboxCoId) {
  if (!peer || !actorId || !inboxCoId) {
    throw new Error("[processInbox] peer, actorId, and inboxCoId are required");
  }
  const currentSessionID = peer.getCurrentSessionID();
  if (!currentSessionID) {
    throw new Error("[processInbox] Cannot get current session ID from peer");
  }
  let messageSchemaCoId = null;
  try {
    const inboxFactory = await resolve(peer, { fromCoValue: inboxCoId }, { returnType: "factory" });
    if (inboxFactory?.items?.$co) {
      const messageFactoryRef = inboxFactory.items.$co;
      if (messageFactoryRef.startsWith("co_z")) {
        messageSchemaCoId = messageFactoryRef;
      }
    }
    if (!messageSchemaCoId) {
      messageSchemaCoId = peer.infra?.event;
    }
  } catch (_error) {}
  const inboxData = peer.readInboxWithSessions(inboxCoId);
  if (!inboxData?.sessions) {
    return { messages: [] };
  }
  const allItems = [];
  for (const items of Object.values(inboxData.sessions || {})) {
    if (Array.isArray(items))
      allItems.push(...items);
  }
  const seenCoIds = new Set;
  const allMessages = allItems.filter((m) => {
    const cid = m._coId;
    if (!cid || seenCoIds.has(cid))
      return false;
    seenCoIds.add(cid);
    return true;
  });
  const unprocessedMessages = [];
  for (const message of allMessages) {
    const isSystemMessage = message.type === "INIT" || message.from === "system";
    if (isSystemMessage) {
      continue;
    }
    const madeAt = message._madeAt || 0;
    const messageCoId = message._coId;
    if (!messageCoId) {
      throw new Error("[processInbox] Inbox stream item missing _coId (message must be a CoMap reference). Wipe storage and re-run genesis seed if needed.");
    }
    try {
      let messageData = null;
      const core = peer.getCoValue?.(messageCoId);
      if (core && peer.isAvailable(core)) {
        messageData = extractCoValueData8(peer, core, messageSchemaCoId);
      }
      if (!messageData || messageData.error) {
        const messageStore = await read(peer, messageCoId, messageSchemaCoId, null, null, {
          deepResolve: false
        });
        try {
          await waitForStoreReady(messageStore, messageCoId, 2000);
        } catch (_waitError) {
          continue;
        }
        messageData = messageStore.value;
      }
      if (!messageData || messageData.error) {
        continue;
      }
      const isProcessed = messageData.processed === true;
      if (!isProcessed) {
        const extractedMessageData = {};
        const keys = Object.keys(messageData);
        for (const key of keys) {
          if (key !== "processed" && !key.startsWith("_") && key !== "id" && key !== "$factory" && key !== "hasProperties" && key !== "properties") {
            extractedMessageData[key] = messageData[key];
          }
        }
        if (!extractedMessageData.type) {
          continue;
        }
        if (extractedMessageData.type === "REMOVE_MEMBER" && (!extractedMessageData.payload?.memberId || typeof extractedMessageData.payload.memberId !== "string" || !extractedMessageData.payload.memberId.startsWith("co_"))) {
          continue;
        }
        const streamSessionId = message._sessionID;
        const msgType = extractedMessageData.type;
        if (!shouldProcessInboxMessageForSession(msgType, streamSessionId, currentSessionID)) {
          traceInboxFilter({
            decision: "skip",
            messageType: msgType,
            messageCoId,
            messageSessionId: streamSessionId,
            currentSessionId: currentSessionID,
            actorId,
            reason: "other_session"
          });
          continue;
        }
        traceInboxFilter({
          decision: "process",
          messageType: msgType,
          messageCoId,
          messageSessionId: streamSessionId,
          currentSessionId: currentSessionID,
          actorId,
          reason: msgType === "SUCCESS" || msgType === "ERROR" ? "response_message" : streamSessionId == null || streamSessionId === "" ? "missing_session" : "same_session"
        });
        unprocessedMessages.push({
          ...extractedMessageData,
          _coId: messageCoId,
          _sessionID: streamSessionId ?? currentSessionID,
          _madeAt: madeAt
        });
      }
    } catch (_error) {}
  }
  unprocessedMessages.sort((a, b) => (a._madeAt || 0) - (b._madeAt || 0));
  const hasStatusUpdate = unprocessedMessages.some((m) => m.type === "STATUS_UPDATE");
  if (hasStatusUpdate && (typeof import.meta !== "undefined" ? import.meta?.env?.DEV : process.env?.MAIA_DEBUG)) {
    log7.debug("[processInbox] STATUS_UPDATE messages", {
      actorId,
      currentSessionID,
      count: unprocessedMessages.filter((m) => m.type === "STATUS_UPDATE").length
    });
  }
  return {
    messages: unprocessedMessages,
    messageSchemaCoId
  };
}
function collectInboxMessageCoIds(peer, inboxCoId) {
  if (!peer || !inboxCoId)
    return new Set;
  const inboxData = peer.readInboxWithSessions(inboxCoId);
  if (!inboxData?.sessions)
    return new Set;
  const allItems = [];
  for (const items of Object.values(inboxData.sessions || {})) {
    if (Array.isArray(items))
      allItems.push(...items);
  }
  const seen = new Set;
  const ids = new Set;
  for (const m of allItems) {
    const cid = m._coId;
    if (!cid || seen.has(cid))
      continue;
    seen.add(cid);
    ids.add(cid);
  }
  return ids;
}
async function findNewSuccessFromTarget(peer, inboxCoId, targetActorCoId, beforeCoIds) {
  if (!peer || !inboxCoId || !targetActorCoId || !beforeCoIds)
    return null;
  let messageSchemaCoId = null;
  try {
    const inboxFactory = await resolve(peer, { fromCoValue: inboxCoId }, { returnType: "factory" });
    if (inboxFactory?.items?.$co) {
      const messageFactoryRef = inboxFactory.items.$co;
      if (messageFactoryRef.startsWith("co_z")) {
        messageSchemaCoId = messageFactoryRef;
      }
    }
    if (!messageSchemaCoId) {
      messageSchemaCoId = peer.infra?.event;
    }
  } catch (_error) {}
  const inboxData = peer.readInboxWithSessions(inboxCoId);
  if (!inboxData?.sessions)
    return null;
  const allItems = [];
  for (const items of Object.values(inboxData.sessions || {})) {
    if (Array.isArray(items))
      allItems.push(...items);
  }
  const seenCoIds = new Set;
  const allMessages = allItems.filter((m) => {
    const cid = m._coId;
    if (!cid || seenCoIds.has(cid))
      return false;
    seenCoIds.add(cid);
    return true;
  });
  const candidates = allMessages.filter((m) => m._coId && !beforeCoIds.has(m._coId));
  candidates.sort((a, b) => (a._madeAt || 0) - (b._madeAt || 0));
  let lastSuccess = null;
  for (const message of candidates) {
    const messageCoId = message._coId;
    try {
      let messageData = null;
      const core = peer.getCoValue?.(messageCoId);
      if (core && peer.isAvailable(core)) {
        messageData = extractCoValueData8(peer, core, messageSchemaCoId);
      }
      if (!messageData || messageData.error) {
        const messageStore = await read(peer, messageCoId, messageSchemaCoId, null, null, {
          deepResolve: false
        });
        try {
          await waitForStoreReady(messageStore, messageCoId, 2000);
        } catch (_waitError) {
          continue;
        }
        messageData = messageStore.value;
      }
      if (!messageData || messageData.error)
        continue;
      if (messageData.type === "SUCCESS" && messageData.source === targetActorCoId) {
        lastSuccess = { payload: messageData.payload };
      }
    } catch (_error) {}
  }
  return lastSuccess;
}
var log7;
var init_process_inbox = __esm(() => {
  init_authoring_resolver();
  init_read();
  log7 = createLogger7("maia-db");
});

// _cojson_src/crud/message-helpers.js
var exports_message_helpers = {};
__export(exports_message_helpers, {
  createAndPushMessage: () => createAndPushMessage
});

import { perfDbUpload } from "@MaiaOS/logs";
import { containsExpressions } from "@MaiaOS/validation/expression-resolver.js";

async function createAndPushMessage(dbEngine, inboxCoId, messageData) {
  if (!dbEngine) {
    throw new Error("[createAndPushMessage] dbEngine is required");
  }
  if (!inboxCoId?.startsWith("co_z")) {
    throw new Error(`[createAndPushMessage] inboxCoId must be a valid co-id (co_z...), got: ${inboxCoId}`);
  }
  if (!messageData || typeof messageData !== "object") {
    throw new Error("[createAndPushMessage] messageData must be an object");
  }
  const peer = dbEngine.peer;
  if (!peer) {
    throw new Error("[createAndPushMessage] dbEngine.peer is required");
  }
  let t0 = perfDbUpload.now();
  let messageFactoryCoId = null;
  let inboxFactory = null;
  try {
    inboxFactory = await resolve(peer, { fromCoValue: inboxCoId }, { returnType: "factory" });
    if (inboxFactory?.items?.$co) {
      const messageFactoryRef = inboxFactory.items.$co;
      if (messageFactoryRef.startsWith("co_z")) {
        messageFactoryCoId = messageFactoryRef;
      }
    }
    if (!messageFactoryCoId) {
      messageFactoryCoId = peer.infra?.event;
    }
    if (!messageFactoryCoId?.startsWith("co_z")) {
      throw new Error(`[createAndPushMessage] Failed to get message factory co-id. Inbox factory items.$co: ${inboxFactory?.items?.$co || "not found"}`);
    }
  } catch (error) {
    throw new Error(`[createAndPushMessage] Failed to get message schema co-id: ${error.message}`);
  }
  perfDbUpload.timing("createAndPushMessage.getFactory", Math.round((perfDbUpload.now() - t0) * 100) / 100);
  const messageFactory = await resolve(peer, messageFactoryCoId, { returnType: "factory" });
  if (!messageFactory) {
    throw new Error(`[createAndPushMessage] Message factory not found: ${messageFactoryCoId}`);
  }
  const messageDataWithDefaults = {
    processed: false,
    ...messageData
  };
  if (messageDataWithDefaults.payload && containsExpressions(messageDataWithDefaults.payload)) {
    throw new Error(`[createAndPushMessage] Payload contains unresolved expressions. Only resolved values can be persisted to CoJSON. Payload: ${JSON.stringify(messageDataWithDefaults.payload).substring(0, 200)}`);
  }
  t0 = perfDbUpload.now();
  const createResult = await dbEngine.execute({
    op: "create",
    factory: messageFactoryCoId,
    data: messageDataWithDefaults
  });
  perfDbUpload.timing("createAndPushMessage.create", Math.round((perfDbUpload.now() - t0) * 100) / 100);
  if (!createResult.ok) {
    const msgs = createResult.errors?.map((e) => e.message).join("; ") || "Create failed";
    throw new Error(`[createAndPushMessage] Failed to create message: ${msgs}`);
  }
  const created = createResult.data;
  if (!created?.id) {
    throw new Error("[createAndPushMessage] Failed to create message CoMap - create operation returned no id");
  }
  const messageCoId = created.id;
  if (!messageCoId.startsWith("co_z")) {
    throw new Error(`[createAndPushMessage] Invalid message co-id returned: ${messageCoId}`);
  }
  t0 = perfDbUpload.now();
  const pushResult = await dbEngine.execute({
    op: "push",
    coId: inboxCoId,
    item: messageCoId
  });
  perfDbUpload.timing("createAndPushMessage.push", Math.round((perfDbUpload.now() - t0) * 100) / 100);
  if (!pushResult.ok) {
    const msgs = pushResult.errors?.map((e) => e.message).join("; ") || "Push failed";
    throw new Error(`[createAndPushMessage] Failed to push message to inbox: ${msgs}`);
  }
  return messageCoId;
}
var init_message_helpers = __esm(() => {
  init_authoring_resolver();
});

// _cojson_src/groups/create.js
var exports_create2 = {};
__export(exports_create2, {
  createProfile: () => createProfile,
  createGroup: () => createGroup,
  createChildGroup: () => createChildGroup
});

import { createLogger as createLogger8 } from "@MaiaOS/logs";
import { createFactoryMeta as createFactoryMeta5 } from "@MaiaOS/validation/peer-factory-registry";

function createGroup(node, { name = null } = {}) {
  const group = node.createGroup();
  if (name) {
    group.set("name", name);
  }
  log8.log("✅ Group created:", group.id);
  if (name) {
    log8.log("   Name:", name);
  }
  log8.log("   Type:", group.type);
  log8.log("   HeaderMeta:", group.headerMeta);
  return group;
}
function createChildGroup(node, parentGroup, { name = null } = {}) {
  const childGroup = node.createGroup();
  if (parentGroup && typeof parentGroup.extend === "function") {
    try {
      childGroup.extend(parentGroup, "admin");
    } catch (_error) {}
  }
  if (name) {
    childGroup.set("name", name);
  }
  log8.log("✅ Child group created:", childGroup.id);
  if (name)
    log8.log("   Name:", name);
  log8.log("   Owner:", parentGroup?.id);
  return childGroup;
}
function createProfile(group, { name = "User" } = {}) {
  const meta = createFactoryMeta5("ProfileFactory");
  const profile = group.createMap({ name }, meta);
  log8.log("✅ Profile created:", profile.id);
  log8.log("   Name:", name);
  log8.log("   HeaderMeta:", profile.headerMeta);
  return profile;
}
var log8;
var init_create2 = __esm(() => {
  log8 = createLogger8("maia-db");
});

// _cojson_src/core/MaiaDB.js
init_authoring_resolver();

import { wrapSyncManagerWithValidation } from "@MaiaOS/validation/validation-hook-wrapper";
import { getGlobalCoCache } from "../primitives/co-cache.js";
import { ReactiveStore as ReactiveStore6 } from "../primitives/reactive-store.js";

// _cojson_src/indexing/storage-hook-wrapper.js
init_groups();
init_factory_index_manager();

import { createLogger as createLogger3, debugLog } from "@MaiaOS/logs";
import {
  extractSchemaFromMessage,
  isAccountGroupOrProfile,
  shouldSkipValidation
} from "@MaiaOS/validation/co-value-detection";
import { EXCEPTION_FACTORIES as EXCEPTION_FACTORIES5 } from "@MaiaOS/validation/peer-factory-registry";

var log3 = createLogger3("maia-db");
var pendingIndexing = new Set;
function wrapStorageWithIndexingHooks(storage, peer) {
  if (!storage || !peer) {
    return storage;
  }
  const originalStore = storage.store.bind(storage);
  const wrappedStorage = new Proxy(storage, {
    get(target, prop) {
      if (prop === "store") {
        return (msg, correctionCallback) => wrappedStore.call(target, msg, correctionCallback, originalStore);
      }
      const value = target[prop];
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    }
  });
  function wrappedStore(msg, correctionCallback, originalStore2) {
    const coId = msg.id;
    const header = msg.header || extractHeaderFromStorageMessage(msg);
    const normalizedMsg = header && !msg.header ? { ...msg, header } : msg;
    const detection = isAccountGroupOrProfile(normalizedMsg, peer, coId);
    if (!detection.isAccount && !detection.isGroup && !detection.isProfile) {
      const ruleset = header?.ruleset ?? msg.ruleset;
      const isGroupByRuleset = ruleset?.type === "group" || header?.type === "group";
      if (isGroupByRuleset) {
        return originalStore2(msg, correctionCallback);
      }
      if (msg.new && typeof msg.new === "object" && Object.keys(msg.new).length > 0) {
        if (!extractSchemaFromMessage(normalizedMsg)) {
          return originalStore2(msg, correctionCallback);
        }
      }
      if (header && header.meta === null) {
        return originalStore2(msg, correctionCallback);
      }
      if (!header?.meta) {
        throw new Error(`[StorageHook] Co-value ${coId} missing header.meta. Every co-value MUST have headerMeta.$factory (except groups, accounts, and profiles during account creation).`);
      }
      if (header.meta.type === "binary") {
        return originalStore2(msg, correctionCallback);
      }
      const schema = extractSchemaFromMessage(normalizedMsg);
      if (!schema && !detection.isException) {
        throw new Error(`[StorageHook] Co-value ${coId} missing $factory in headerMeta. Every co-value MUST have a schema (except @account, @group, @metaSchema, and groups/accounts).`);
      }
    }
    let shouldSkipIndexing = shouldSkipValidation(normalizedMsg, peer, coId);
    if (shouldSkipIndexing) {
      const schema = extractSchemaFromMessage(normalizedMsg);
      if (schema === EXCEPTION_FACTORIES5.META_SCHEMA) {
        shouldSkipIndexing = false;
      }
    }
    if (!shouldSkipIndexing && peer.account) {
      const osId = peer._cachedMaiaOsId;
      if (coId === osId) {
        shouldSkipIndexing = true;
      } else if (osId) {
        const osCore = peer.node.getCoValue(osId);
        if (osCore && peer.isAvailable(osCore) && osCore.type === "comap") {
          const osContent = osCore.getCurrentContent?.();
          if (osContent && typeof osContent.get === "function") {
            const unknownId = osContent.get("unknown");
            if (coId === unknownId) {
              shouldSkipIndexing = true;
            }
            const nanoidsId = osContent.get("nanoids");
            if (coId === nanoidsId) {
              shouldSkipIndexing = true;
            }
            const indexesId = osContent.get("indexes");
            if (coId === indexesId) {
              shouldSkipIndexing = true;
            }
            if (indexesId && !shouldSkipIndexing) {
              const indexesCore = peer.node.getCoValue(indexesId);
              if (indexesCore && peer.isAvailable(indexesCore) && indexesCore.type === "comap") {
                const indexesContent = indexesCore.getCurrentContent?.();
                if (indexesContent && typeof indexesContent.get === "function") {
                  try {
                    const keys = indexesContent.keys && typeof indexesContent.keys === "function" ? indexesContent.keys() : Object.keys(indexesContent);
                    for (const key of keys) {
                      const valueId = indexesContent.get(key);
                      if (valueId === coId) {
                        shouldSkipIndexing = true;
                        break;
                      }
                    }
                  } catch (_e) {
                    shouldSkipIndexing = true;
                  }
                }
              }
            }
          }
        }
      }
    }
    const storeResult = originalStore2(msg, correctionCallback);
    if (shouldSkipIndexing) {
      return storeResult;
    }
    if (peer._indexingEnabled === false) {
      return storeResult;
    }
    return Promise.resolve(storeResult).then(async () => {
      if (pendingIndexing.has(coId)) {
        return;
      }
      pendingIndexing.add(coId);
      try {
        if (!peer._cachedMaiaOsId && peer.account) {
          await getSparkOsId(peer, peer.systemSparkCoId);
        }
        await indexFromMessage(peer, normalizedMsg);
        debugLog("db", "storageHook", "indexed coId=", coId);
      } catch (error) {
        const isFactoryCompilationError = error?.message?.includes("Failed to compile factory");
        if (!isFactoryCompilationError) {
          log3.error("[StorageHook] Indexing failed", coId, error);
        }
      } finally {
        pendingIndexing.delete(coId);
      }
    }).then(() => storeResult);
  }
  return wrappedStorage;
}

// _cojson_src/core/maia-db-data-plane.js
init_create();
init_read();
init_authoring_resolver();
async function maiaDbRead(db, schema, key, keys, filter, options = {}) {
  const {
    deepResolve = true,
    maxDepth = 15,
    timeoutMs = 5000,
    map = null,
    onChange = null
  } = options;
  const readOptions = { deepResolve, maxDepth, timeoutMs, map, onChange };
  if (keys && Array.isArray(keys)) {
    const stores = await Promise.all(keys.map((coId) => read(db, coId, schema, null, schema, readOptions)));
    return stores;
  }
  if (key)
    return await read(db, key, schema, null, schema, readOptions);
  if (!schema)
    return await read(db, null, null, filter, null, readOptions);
  return await read(db, null, schema, filter, null, readOptions);
}
async function maiaDbFindFirst(db, schema, filter, options = {}) {
  return await findFirst(db, schema, filter, options);
}
async function maiaDbCreate(db, schema, data, options = {}) {
  return await create(db, schema, data, options);
}
async function maiaDbUpdate(db, schema, id, data) {
  const crudUpdate = await Promise.resolve().then(() => (init_update(), exports_update));
  return await crudUpdate.update(db, schema, id, data);
}
async function maiaDbDelete(db, schema, id) {
  const crudDelete = await Promise.resolve().then(() => (init_delete(), exports_delete));
  return await crudDelete.deleteRecord(db, schema, id);
}
async function maiaDbGetRawRecord(db, id) {
  const store = await read(db, id, null, null, null, { deepResolve: false });
  try {
    await waitForStoreReady(store, id, 5000);
  } catch (_e) {
    return null;
  }
  const data = store.value;
  if (!data || data.error)
    return null;
  return data;
}
async function maiaDbSeed(db, configs, schemas, data, options = {}) {
  if (!db.account)
    throw new Error("[MaiaDB] Account required for seed");
  const { seed: runSeed } = await import("@MaiaOS/seed/orchestration");
  return await runSeed(db.account, db.node, configs, schemas, data || {}, db, options);
}
async function maiaDbResolve(db, identifier, opts = {}) {
  return resolve(db, identifier, opts);
}
async function maiaDbCheckCotype(db, factoryCoId, expectedCotype) {
  return checkCotype(db, factoryCoId, expectedCotype);
}
function maiaDbResolveReactive(db, identifier, opts = {}) {
  return resolveReactive(db, identifier, opts);
}
async function maiaDbWaitForReactiveResolution(_db, store, opts = {}) {
  return waitForReactiveResolution(store, opts);
}
async function maiaDbProcessInbox(db, actorId, inboxCoId) {
  const { processInbox: processInboxFn } = await Promise.resolve().then(() => (init_process_inbox(), exports_process_inbox));
  return processInboxFn(db, actorId, inboxCoId);
}
async function maiaDbCreateAndPushMessage(db, inboxCoId, messageData) {
  if (!db.dbEngine) {
    throw new Error("[MaiaDB.createAndPushMessage] dbEngine required (set via DataEngine)");
  }
  const { createAndPushMessage: createAndPushMessageFn } = await Promise.resolve().then(() => (init_message_helpers(), exports_message_helpers));
  return createAndPushMessageFn(db.dbEngine, inboxCoId, messageData);
}

// _cojson_src/core/maia-db-groups.js
init_groups();

import { extractCoStreamWithSessions } from "../primitives/data-extraction.js";

function maiaDbReadInboxWithSessions(db, inboxCoId) {
  const coValueCore = db.getCoValue(inboxCoId);
  if (!coValueCore || !db.isAvailable(coValueCore))
    return null;
  return extractCoStreamWithSessions(db, coValueCore);
}
async function maiaDbGetMaiaGroup(db) {
  return getMaiaGroup(db);
}
function maiaDbGetGroupInfo(db, coValueCore) {
  if (!coValueCore || !db.isAvailable(coValueCore))
    return null;
  try {
    const header = db.getHeader(coValueCore);
    const content = db.getCurrentContent(coValueCore);
    const ruleset = coValueCore.ruleset || header?.ruleset;
    if (!ruleset)
      return null;
    let ownerGroupId = null;
    let ownerGroupCore = null;
    let ownerGroupContent = null;
    if (ruleset.type === "group") {
      ownerGroupId = coValueCore.id;
      ownerGroupCore = coValueCore;
      ownerGroupContent = content;
    } else if (ruleset.type === "ownedByGroup" && ruleset.group) {
      ownerGroupId = ruleset.group;
      ownerGroupCore = db.getCoValue(ownerGroupId);
      if (ownerGroupCore && db.isAvailable(ownerGroupCore)) {
        ownerGroupContent = db.getCurrentContent(ownerGroupCore);
      }
    } else if (content?.group) {
      const groupRef = content.group;
      ownerGroupId = typeof groupRef === "string" ? groupRef : groupRef.id || groupRef.$jazz?.id;
      if (ownerGroupId) {
        ownerGroupCore = db.getCoValue(ownerGroupId);
        if (ownerGroupCore && db.isAvailable(ownerGroupCore)) {
          ownerGroupContent = db.getCurrentContent(ownerGroupCore);
        }
      }
    } else
      return null;
    if (!ownerGroupContent || typeof ownerGroupContent.addMember !== "function")
      return null;
    const groupInfo = getGroupInfoFromGroup(ownerGroupContent);
    if (groupInfo && ownerGroupId)
      groupInfo.groupId = ownerGroupId;
    return groupInfo;
  } catch (_error) {
    return null;
  }
}
async function maiaDbGetGroup(db, groupId) {
  return await getGroup(db.node, groupId);
}
function maiaDbGetGroupInfoFromGroup(_db, group) {
  return getGroupInfoFromGroup(group);
}
function maiaDbAddGroupMember(db, group, accountCoId, role) {
  return addGroupMember(db.node, group, accountCoId, role, db);
}
function maiaDbRemoveGroupMember(_db, group, memberId) {
  return removeGroupMember(group, memberId);
}
function maiaDbSetGroupMemberRole(db, group, memberId, role) {
  return setGroupMemberRole(db.node, group, memberId, role);
}
function maiaDbGetSparkCapabilityGroupIdFromSparkCoId(db, sparkCoId, capabilityName = "guardian") {
  return getSparkCapabilityGroupIdFromSparkCoId(db, sparkCoId, capabilityName);
}

// _cojson_src/core/maia-db-spark.js
init_delete();
init_update();
init_authoring_resolver();

// _cojson_src/core/maia-db-constants.js
var SYSTEM_SPARK_REGISTRY_KEY = "°maia";
function normalizeSparkLogicalName(raw) {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) {
    throw new Error("[MaiaDB] createSpark: name is required (short label or full °… logical ref)");
  }
  if (trimmed.startsWith("°"))
    return trimmed;
  let slug = trimmed.replace(/[^\p{L}\p{N}_-]/gu, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  slug = slug.slice(0, 80);
  if (!slug) {
    const suffix = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "").slice(0, 8) : String(Math.random()).slice(2, 10);
    slug = `spark-${suffix}`;
  }
  return `°${slug.toLowerCase()}`;
}

// _cojson_src/core/maia-db-spark.js
async function maiaDbCreateSpark(db, name) {
  if (!db.account)
    throw new Error("[MaiaDB] Account required for createSpark");
  if (!db.systemSparkCoId?.startsWith("co_z"))
    await db.resolveSystemSparkCoId();
  if (db.dbEngine?.resolveSystemFactories)
    await db.dbEngine.resolveSystemFactories();
  const normalizedName = normalizeSparkLogicalName(name);
  const maiaGuardian = await db.getMaiaGroup();
  if (!maiaGuardian)
    throw new Error("[MaiaDB] °maia spark group not found");
  const { createChildGroup: createChildGroup2 } = await Promise.resolve().then(() => (init_create2(), exports_create2));
  const childGroup = createChildGroup2(db.node, maiaGuardian, { name: normalizedName });
  const sparkSchemaCoId = db.infra?.dataSpark;
  const groupsSchemaCoId = db.infra?.groups;
  const osSchemaCoId = db.infra?.osRegistry;
  const vibesRegistrySchemaCoId = db.infra?.vibesRegistry;
  if (!sparkSchemaCoId || !groupsSchemaCoId || !osSchemaCoId || !vibesRegistrySchemaCoId) {
    throw new Error("[MaiaDB] Spark scaffold factories not found (peer.infra missing — call resolveSystemFactories)");
  }
  const ctx = { node: db.node, account: db.account, guardian: childGroup };
  const { createCoValueForSpark: createCoValueForSpark2 } = await Promise.resolve().then(() => (init_create_covalue_for_spark(), exports_create_covalue_for_spark));
  const { coValue: groupsCo } = await createCoValueForSpark2(ctx, null, {
    factory: groupsSchemaCoId,
    cotype: "comap",
    data: { guardian: childGroup.id },
    dataEngine: db.dbEngine
  });
  const { coValue: os } = await createCoValueForSpark2(ctx, null, {
    factory: osSchemaCoId,
    cotype: "comap",
    data: { groups: groupsCo.id },
    dataEngine: db.dbEngine
  });
  const { coValue: vibes } = await createCoValueForSpark2(ctx, null, {
    factory: vibesRegistrySchemaCoId,
    cotype: "comap",
    data: {},
    dataEngine: db.dbEngine
  });
  const { coValue: sparkCoMap } = await createCoValueForSpark2(ctx, null, {
    factory: sparkSchemaCoId,
    cotype: "comap",
    data: { name: normalizedName, os: os.id, vibes: vibes.id },
    dataEngine: db.dbEngine
  });
  return { id: sparkCoMap.id, name: normalizedName, guardian: childGroup.id };
}
async function maiaDbReadSpark(db, id, schema = null) {
  if (id)
    return await db.read(null, id);
  if (!schema?.startsWith?.("co_z")) {
    throw new Error("[MaiaDB] readSpark: id or spark schema co-id (co_z...) required");
  }
  return await db.read(schema);
}
async function maiaDbUpdateSpark(db, id, data) {
  const { group: _g, ...allowed } = data || {};
  if (typeof allowed.name === "string") {
    const t = allowed.name.trim();
    if (t)
      allowed.name = normalizeSparkLogicalName(allowed.name);
    else
      allowed.name = "";
  }
  const factoryCoId = await resolve(db, { fromCoValue: id }, { returnType: "coId" });
  return await update(db, factoryCoId, id, allowed);
}
async function maiaDbDeleteSpark(db, id) {
  const factoryCoId = await resolve(db, { fromCoValue: id }, { returnType: "coId" });
  await deleteRecord(db, factoryCoId, id);
  return { success: true, id };
}

// _cojson_src/core/maia-db-system-spark.js
init_read();
init_groups();

import { TIMEOUT_COVALUE_LOAD } from "@MaiaOS/timeouts";

async function maiaDbResolveSystemSparkCoId(db) {
  if (db.systemSparkCoId?.startsWith("co_z"))
    return db.systemSparkCoId;
  if (!db.account?.id) {
    throw new Error("[MaiaDB] resolveSystemSparkCoId: account required");
  }
  const sparksId = db.account.get?.("sparks");
  if (!sparksId?.startsWith("co_z")) {
    throw new Error(`[MaiaDB] account.sparks not set (account: ${db.account.id.slice(0, 12)}…). ` + `POST /bootstrap must run before MaiaOS.boot — see bootstrapAccountHandshake.`);
  }
  const sparksStore = await db.read(sparksId, sparksId);
  try {
    await waitForStoreReady(sparksStore, sparksId, TIMEOUT_COVALUE_LOAD);
  } catch (e) {
    throw new Error(`[MaiaDB] sparks CoMap ${sparksId.slice(0, 12)}… did not load within ${TIMEOUT_COVALUE_LOAD}ms: ${e?.message ?? e}`);
  }
  const sparksRaw = sparksStore?.value;
  const id = sparksRaw?.[SYSTEM_SPARK_REGISTRY_KEY];
  if (!id?.startsWith?.("co_z")) {
    throw new Error(`[MaiaDB] sparks CoMap ${sparksId.slice(0, 12)}… missing '${SYSTEM_SPARK_REGISTRY_KEY}' entry`);
  }
  db.systemSparkCoId = id;
  return id;
}
async function maiaDbEnsureAccountOsReady(db, options = {}) {
  const { timeoutMs = 1e4 } = options;
  if (!db.account && typeof process !== "undefined" && process.env?.DEBUG)
    return false;
  if (!db.systemSparkCoId?.startsWith("co_z"))
    await maiaDbResolveSystemSparkCoId(db);
  if (db.dbEngine?.resolveSystemFactories)
    await db.dbEngine.resolveSystemFactories();
  const osId = await getSparkOsId(db, db.systemSparkCoId);
  if (!osId || typeof osId !== "string" || !osId.startsWith("co_z")) {
    if (typeof process !== "undefined" && process.env?.DEBUG)
      return false;
  }
  const osStore = await read(db, osId, null, null, null, {
    deepResolve: false,
    timeoutMs
  });
  try {
    await waitForStoreReady(osStore, osId, timeoutMs);
  } catch (_error) {
    if (typeof process !== "undefined" && process.env?.DEBUG)
      return false;
  }
  const osData = osStore.value;
  if (!osData || osData.error) {
    if (typeof process !== "undefined" && process.env?.DEBUG)
      return false;
  }
  return true;
}

// _cojson_src/core/MaiaDB.js
class MaiaDB {
  constructor(peer, dbEngineOrOptions = null) {
    const { node, account } = peer;
    const isOptions = dbEngineOrOptions && typeof dbEngineOrOptions === "object" && !dbEngineOrOptions.peer && typeof dbEngineOrOptions.execute !== "function";
    const dbEngine = isOptions ? null : dbEngineOrOptions;
    const options = isOptions ? dbEngineOrOptions : {};
    this.node = node;
    this.account = account;
    this.dbEngine = dbEngine;
    this.systemSparkCoId = options.systemSparkCoId ?? null;
    this.infra = null;
    this.subscriptionCache = getGlobalCoCache(node);
    if (node.storage) {
      node.storage = wrapStorageWithIndexingHooks(node.storage, this);
    }
    if (node.syncManager && (dbEngine || options?.beforeAcceptWrite)) {
      wrapSyncManagerWithValidation(node.syncManager, this, dbEngine, {
        beforeAcceptWrite: options?.beforeAcceptWrite,
        resolve
      });
    }
  }
  async resolveSystemSparkCoId() {
    return maiaDbResolveSystemSparkCoId(this);
  }
  _resetCaches() {}
  getCoValue(coId) {
    return this.node.getCoValue(coId);
  }
  getAllCoValues() {
    return this.node.coValues || new Map;
  }
  isAvailable(coValueCore) {
    return coValueCore?.isAvailable() || false;
  }
  getCurrentContent(coValueCore) {
    if (!coValueCore?.isAvailable())
      return null;
    return coValueCore.getCurrentContent();
  }
  getHeader(coValueCore) {
    return coValueCore?.verified?.header || null;
  }
  getAccount() {
    return this.account;
  }
  getCurrentSessionID() {
    if (!this.node?.currentSessionID)
      return null;
    return this.node.currentSessionID;
  }
  readInboxWithSessions(inboxCoId) {
    return maiaDbReadInboxWithSessions(this, inboxCoId);
  }
  async getMaiaGroup() {
    return maiaDbGetMaiaGroup(this);
  }
  getGroupInfo(coValueCore) {
    return maiaDbGetGroupInfo(this, coValueCore);
  }
  async getGroup(groupId) {
    return await maiaDbGetGroup(this, groupId);
  }
  getGroupInfoFromGroup(group) {
    return maiaDbGetGroupInfoFromGroup(this, group);
  }
  async addGroupMember(group, accountCoId, role) {
    return await maiaDbAddGroupMember(this, group, accountCoId, role);
  }
  async removeGroupMember(group, memberId) {
    return await maiaDbRemoveGroupMember(this, group, memberId);
  }
  async setGroupMemberRole(group, memberId, role) {
    return await maiaDbSetGroupMemberRole(this, group, memberId, role);
  }
  async createSpark(name) {
    return maiaDbCreateSpark(this, name);
  }
  async readSpark(id, schema = null) {
    return maiaDbReadSpark(this, id, schema);
  }
  async updateSpark(id, data) {
    return maiaDbUpdateSpark(this, id, data);
  }
  async deleteSpark(id) {
    return maiaDbDeleteSpark(this, id);
  }
  async read(schema, key, keys, filter, options = {}) {
    return maiaDbRead(this, schema, key, keys, filter, options);
  }
  async findFirst(schema, filter, options = {}) {
    return maiaDbFindFirst(this, schema, filter, options);
  }
  async create(schema, data, options = {}) {
    return maiaDbCreate(this, schema, data, options);
  }
  async update(schema, id, data) {
    return maiaDbUpdate(this, schema, id, data);
  }
  async delete(schema, id) {
    return maiaDbDelete(this, schema, id);
  }
  async getRawRecord(id) {
    return maiaDbGetRawRecord(this, id);
  }
  async seed(configs, schemas, data, options = {}) {
    return maiaDbSeed(this, configs, schemas, data, options);
  }
  async ensureAccountOsReady(options = {}) {
    return maiaDbEnsureAccountOsReady(this, options);
  }
  async resolve(identifier, opts = {}) {
    return maiaDbResolve(this, identifier, opts);
  }
  async checkCotype(factoryCoId, expectedCotype) {
    return maiaDbCheckCotype(this, factoryCoId, expectedCotype);
  }
  createReactiveStore(initialValue) {
    return new ReactiveStore6(initialValue);
  }
  async getSparkCapabilityGroupIdFromSparkCoId(sparkCoId, capabilityName = "guardian") {
    return maiaDbGetSparkCapabilityGroupIdFromSparkCoId(this, sparkCoId, capabilityName);
  }
  resolveReactive(identifier, opts = {}) {
    return maiaDbResolveReactive(this, identifier, opts);
  }
  async waitForReactiveResolution(store, opts = {}) {
    return maiaDbWaitForReactiveResolution(this, store, opts);
  }
  async processInbox(actorId, inboxCoId) {
    return maiaDbProcessInbox(this, actorId, inboxCoId);
  }
  async createAndPushMessage(inboxCoId, messageData) {
    return maiaDbCreateAndPushMessage(this, inboxCoId, messageData);
  }
}

// cojson-bundle-entry.js
init_coList();
init_coMap();
init_coStream();
init_coBinary();
init_create_covalue_for_spark();
init_collection_helpers();
init_create();
init_delete();
init_map_transform();
init_message_helpers();
init_process_inbox();
init_reactive_resolver();
init_read();
init_read_all_covalues();
init_read_collection();
init_read_helpers();
init_read_single_and_sparks();
init_update();
init_deep_resolution();
init_authoring_resolver();

// _cojson_src/factory/infra-from-spark-os.js
init_collection_helpers();

// _cojson_src/infra-slot-manifest.js
var INFRA_SLOTS = Object.freeze([
  { slotKey: "metaFactoryCoId", basename: "meta.factory.maia", infraKey: "meta" },
  { slotKey: "actorFactoryCoId", basename: "actor.factory.maia", infraKey: "actor" },
  { slotKey: "eventFactoryCoId", basename: "event.factory.maia", infraKey: "event" },
  { slotKey: "cobinaryFactoryCoId", basename: "cobinary.factory.maia", infraKey: "cobinary" },
  { slotKey: "identityFactoryCoId", basename: "identity.factory.maia", infraKey: "identity" },
  {
    slotKey: "indexesRegistryFactoryCoId",
    basename: "indexes-registry.factory.maia",
    infraKey: "indexesRegistry"
  },
  { slotKey: "capabilityFactoryCoId", basename: "capability.factory.maia", infraKey: "capability" },
  { slotKey: "groupsFactoryCoId", basename: "groups.factory.maia", infraKey: "groups" },
  { slotKey: "osRegistryFactoryCoId", basename: "os-registry.factory.maia", infraKey: "osRegistry" },
  {
    slotKey: "vibesRegistryFactoryCoId",
    basename: "vibes-registry.factory.maia",
    infraKey: "vibesRegistry"
  },
  { slotKey: "dataSparkFactoryCoId", basename: "spark.factory.maia", infraKey: "dataSpark" }
]);

// _cojson_src/factory/infra-from-spark-os.js
async function loadInfraFromSparkOs(peer, osId, options = {}) {
  const { timeoutMs = 5000 } = options;
  if (!osId?.startsWith?.("co_z")) {
    throw new Error("[loadInfraFromSparkOs] osId must be a co_z id");
  }
  const osCore = await ensureCoValueLoaded7(peer, osId, { waitForAvailable: true, timeoutMs });
  if (!osCore || !peer.getCurrentContent) {
    throw new Error("[loadInfraFromSparkOs] spark.os not available");
  }
  const os = peer.getCurrentContent(osCore);
  const entries = {};
  for (const { slotKey, infraKey } of INFRA_SLOTS) {
    const v = os.get?.(slotKey);
    if (typeof v !== "string" || !v.startsWith("co_z")) {
      throw new Error(`[infra] spark.os slot missing or not co_z: ${slotKey}`);
    }
    entries[infraKey] = v;
  }
  peer.infra = Object.freeze(entries);
}
// _cojson_src/factory/load-factories-from-account.js
init_read();
init_authoring_resolver();

import { getGlobalCoCache as getGlobalCoCache2 } from "../primitives/co-cache.js";

async function waitForCoValueAvailable(core, timeoutMs = 5000) {
  if (!core)
    return false;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (core.isAvailable?.())
      return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}
async function resolveSparkOsIdFromNode(node, account, spark) {
  const sparksId = account.get?.("sparks");
  if (!sparksId?.startsWith("co_z"))
    return null;
  const sparksCore = node.getCoValue(sparksId) || await node.loadCoValueCore?.(sparksId);
  if (!await waitForCoValueAvailable(sparksCore))
    return null;
  const sparks = sparksCore?.getCurrentContent?.();
  if (!sparks || typeof sparks.get !== "function")
    return null;
  const sparkCoId = sparks.get(spark);
  if (!sparkCoId?.startsWith("co_z"))
    return null;
  const sparkCore = node.getCoValue(sparkCoId) || await node.loadCoValueCore?.(sparkCoId);
  if (!await waitForCoValueAvailable(sparkCore))
    return null;
  const sparkContent = sparkCore?.getCurrentContent?.();
  if (!sparkContent || typeof sparkContent.get !== "function")
    return null;
  return sparkContent.get("os") || null;
}
async function loadFactoriesFromAccount(node, account) {
  if (!node || !account) {
    throw new Error("[loadFactoriesFromAccount] Node and account required");
  }
  try {
    const peer = {
      node,
      account,
      getCoValue: (id) => node.getCoValue(id),
      isAvailable: (c) => c?.isAvailable?.() ?? false,
      getHeader: (c) => c?.verified?.header ?? null,
      getCurrentContent: (c) => c?.getCurrentContent?.() ?? null,
      subscriptionCache: getGlobalCoCache2(node),
      systemSpark: "°maia",
      read(schema, key, keys, filter, options = {}) {
        const {
          deepResolve = true,
          maxDepth = 15,
          timeoutMs = 5000,
          map = null,
          onChange = null
        } = options;
        const readOptions = { deepResolve, maxDepth, timeoutMs, map, onChange };
        if (keys && Array.isArray(keys)) {
          return Promise.all(keys.map((coId) => read(this, coId, schema, null, schema, readOptions)));
        }
        if (key)
          return read(this, key, schema, null, schema, readOptions);
        if (!schema)
          return read(this, null, null, filter, null, readOptions);
        return read(this, null, schema, filter, null, readOptions);
      }
    };
    const osId = await resolveSparkOsIdFromNode(node, account, "°maia");
    if (!osId?.startsWith("co_z"))
      return {};
    const osStore = await peer.read(null, osId, null, null, { deepResolve: false });
    await waitForStoreReady(osStore, osId, 5000);
    const osData = osStore.value;
    const metaCoId = osData?.[SPARK_OS_META_FACTORY_CO_ID_KEY];
    const indexesId = osData?.indexes;
    const factoryCoIds = [];
    if (metaCoId?.startsWith?.("co_z") && indexesId?.startsWith?.("co_z")) {
      const indexesStore = await peer.read(null, indexesId, null, null, {
        deepResolve: false
      });
      await waitForStoreReady(indexesStore, indexesId, 5000);
      const indexesData = indexesStore.value;
      const catalogColistId = indexesData?.[metaCoId];
      if (catalogColistId?.startsWith?.("co_z")) {
        const colistCore = peer.getCoValue(catalogColistId);
        if (colistCore && peer.isAvailable(colistCore)) {
          const colistContent = peer.getCurrentContent(colistCore);
          const items = colistContent?.toJSON?.() ?? [];
          if (Array.isArray(items)) {
            for (const id of items) {
              if (typeof id === "string" && id.startsWith("co_z"))
                factoryCoIds.push(id);
            }
          }
        }
      }
    }
    if (factoryCoIds.length === 0)
      return {};
    const schemas = {};
    for (const factoryCoId of factoryCoIds) {
      if (typeof factoryCoId !== "string" || !factoryCoId.startsWith("co_z"))
        continue;
      try {
        const schema = await resolve(peer, factoryCoId, { returnType: "factory", timeoutMs: 5000 });
        if (schema)
          schemas[factoryCoId] = schema;
      } catch (_error) {}
    }
    return schemas;
  } catch (_error) {
    return {};
  }
}
// _cojson_src/factory/resolver.js
init_authoring_resolver();

// cojson-bundle-entry.js
init_create2();
init_groups();

// _cojson_src/helpers/capability-grant-co-ids.js
function collectCapabilityGrantCoIdsFromColistContent(content) {
  if (!content)
    return [];
  if (content.type !== undefined && content.type !== "colist")
    return [];
  let items = content.items;
  if (items == null && typeof content.toJSON === "function") {
    try {
      const j = content.toJSON();
      if (Array.isArray(j)) {
        return j.filter((id) => typeof id === "string" && id.startsWith("co_z"));
      }
      if (j && typeof j === "object" && !(j instanceof Uint8Array) && Array.isArray(j.items)) {
        items = j.items;
      }
    } catch {
      return [];
    }
  }
  if (items == null)
    return [];
  return collectCoIdsFromItemsShape(items);
}
function collectCoIdsFromItemsShape(items) {
  const ids = [];
  if (Array.isArray(items)) {
    for (const item of items) {
      if (typeof item === "string" && item.startsWith("co_z"))
        ids.push(item);
      else if (item && typeof item.value === "string" && item.value.startsWith("co_z"))
        ids.push(item.value);
    }
    return ids;
  }
  if (typeof items === "object") {
    for (const val of Object.values(items)) {
      if (!Array.isArray(val))
        continue;
      for (const item of val) {
        if (typeof item === "string" && item.startsWith("co_z"))
          ids.push(item);
        else if (item && typeof item.value === "string" && item.value.startsWith("co_z"))
          ids.push(item.value);
      }
    }
  }
  return ids;
}
// _cojson_src/helpers/capability-grants-resolve.js
init_collection_helpers();
async function getCapabilityGrantIndexColistCoId(maia) {
  const account = maia?.id?.maiaId;
  const peer = maia?.dataEngine?.peer;
  if (!account || !peer)
    return null;
  return getCapabilityGrantIndexColistCoIdFromPeer(peer, account);
}
async function getCapabilityGrantIndexColistCoIdFromPeer(peer, _account) {
  let capSchema = peer?.infra?.capability;
  if (!capSchema?.startsWith("co_z") && peer?.dbEngine?.resolveSystemFactories) {
    await peer.dbEngine.resolveSystemFactories();
    capSchema = peer?.infra?.capability;
  }
  if (!capSchema?.startsWith("co_z"))
    return null;
  try {
    return await getFactoryIndexColistId(peer, capSchema);
  } catch {
    return null;
  }
}
async function accountHasCapabilityOnPeer(peer, account, accountId, cmd) {
  if (!accountId?.startsWith("co_z") || !cmd)
    return false;
  const colistId = await getCapabilityGrantIndexColistCoIdFromPeer(peer, account);
  if (!colistId?.startsWith("co_z"))
    return false;
  const core = peer.node.getCoValue(colistId);
  if (!core || !peer.isAvailable(core))
    return false;
  const content = peer.getCurrentContent(core);
  if (!content)
    return false;
  if (content.type !== undefined && content.type !== "colist")
    return false;
  const now = Math.floor(Date.now() / 1000);
  const allCoIds = collectCapabilityGrantCoIdsFromColistContent(content);
  for (const capCoId of allCoIds) {
    let capContent;
    try {
      capContent = await loadCoMapContent(peer, capCoId, { timeout: 3000 });
    } catch {
      continue;
    }
    if (!capContent?.get)
      continue;
    const sub = capContent.get("sub");
    const capCmd = capContent.get("cmd");
    const exp = capContent.get("exp");
    if (sub !== accountId || typeof exp !== "number" || exp <= now)
      continue;
    if (capCmd === cmd || capCmd === "/admin")
      return true;
  }
  return false;
}
async function loadCoMapContent(peer, coId, opts = {}) {
  const { timeout = 5000 } = opts;
  const store = await peer.read(null, coId);
  await waitForStoreReady(store, coId, timeout);
  const core = peer.node.getCoValue(coId);
  if (!core || !peer.isAvailable(core))
    return null;
  return peer.getCurrentContent(core);
}
// _cojson_src/helpers/invite-validate.js
function validateInvite(_peer, _inviteCoId, _opts) {
  return { ok: true, reason: "permissive" };
}

// _cojson_src/helpers/load-capabilities-grants.js
import { createLogger as createLogger9 } from "@MaiaOS/logs";

var log9 = createLogger9("maia-db");
async function loadCapabilitiesGrants(maia) {
  if (!maia?.do)
    return [];
  const account = maia?.id?.maiaId;
  if (!account)
    return [];
  try {
    const devCap = typeof globalThis !== "undefined" && globalThis.window?.__MAIA_DEV_ENV__?.DEV === true;
    const tCap0 = devCap ? performance.now() : 0;
    const capLog = (label) => {
      if (devCap) {
        log9.info(`[MaiaDB capabilities path] ${label} +${(performance.now() - tCap0).toFixed(0)}ms`);
      }
    };
    const colistId = await getCapabilityGrantIndexColistCoId(maia);
    if (!colistId?.startsWith("co_z"))
      return [];
    capLog("capability index colist id resolved");
    const colistStore = await maia.do({ op: "read", factory: null, key: colistId });
    await waitForStore(colistStore, 5000);
    capLog("capability index colist hydrated");
    const colistData = colistStore?.value ?? colistStore;
    const capCoIds = collectCapabilityGrantCoIdsFromColistContent(colistData);
    capLog(`colist grant refs=${capCoIds.length}`);
    const grantRows = await Promise.all(capCoIds.map(async (capCoId) => {
      try {
        const capStore = await maia.do({ op: "read", factory: null, key: capCoId });
        await waitForStore(capStore, 3000);
        const cap = capStore?.value ?? capStore;
        if (!cap || cap?.error || cap?.loading)
          return null;
        return {
          id: cap.id ?? capCoId,
          sub: cap.sub,
          cmd: cap.cmd,
          pol: Array.isArray(cap.pol) ? cap.pol : [],
          exp: typeof cap.exp === "number" ? cap.exp : 0,
          ...cap.iss && { iss: cap.iss },
          ...cap.nbf != null && { nbf: cap.nbf }
        };
      } catch (_e) {
        return null;
      }
    }));
    const grants = grantRows.filter(Boolean);
    capLog(`grants loaded count=${grants.length}`);
    return grants;
  } catch (_e) {
    return [];
  }
}
async function waitForStore(store, timeoutMs = 5000) {
  const val = store?.value ?? store;
  if (!val?.loading)
    return;
  await new Promise((resolve2, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout")), timeoutMs);
    const unsub = store?.subscribe?.((v) => {
      const s = v ?? store?.value ?? store;
      if (!s?.loading) {
        clearTimeout(timeout);
        unsub?.();
        resolve2();
      }
    });
    const current = store?.value ?? store;
    if (!current?.loading) {
      clearTimeout(timeout);
      unsub?.();
      resolve2();
    }
  });
}
// _cojson_src/helpers/resolve-account-profile.js
init_read();
async function waitForStore2(store, timeoutMs = 5000) {
  const val = store?.value ?? store;
  if (!val?.loading)
    return;
  await new Promise((resolve2, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout waiting for store")), timeoutMs);
    const unsubscribe = store.subscribe?.((v) => {
      const s = v ?? store?.value ?? store;
      if (!s?.loading) {
        clearTimeout(timeout);
        unsubscribe?.();
        resolve2();
      }
    });
    const current = store?.value ?? store;
    if (!current?.loading) {
      clearTimeout(timeout);
      unsubscribe?.();
      resolve2();
    }
  });
}
function travelerFallback(accountCoId) {
  const shortId = typeof accountCoId === "string" ? accountCoId.slice(-12) : "";
  return `Traveler ${shortId}`;
}
async function resolveAccountToProfileCoIdViaIdentity(maia, accountCoId) {
  try {
    const peer = maia?.dataEngine?.peer;
    if (!peer)
      return null;
    if (peer.dbEngine?.resolveSystemFactories) {
      await peer.dbEngine.resolveSystemFactories();
    }
    const identitySchemaCoId = peer.infra?.identity;
    if (!identitySchemaCoId?.startsWith("co_z"))
      return null;
    const row = await findFirst(peer, identitySchemaCoId, { account: accountCoId }, { timeoutMs: 8000 });
    const profileCoId = row?.profile;
    return profileCoId?.startsWith("co_z") ? profileCoId : null;
  } catch (_e) {
    return null;
  }
}
async function resolveSelfAccountProfileFromLiveAccount(maia, accountCoId) {
  const acc = maia?.id?.maiaId;
  const selfId = acc?.id ?? acc?.$jazz?.id;
  if (selfId !== accountCoId || typeof acc?.get !== "function")
    return null;
  const profileCoId = acc.get("profile");
  if (!profileCoId?.startsWith("co_z"))
    return null;
  const profileStore = await maia.do({ op: "read", factory: null, key: profileCoId });
  await waitForStore2(profileStore, 5000);
  const profileData = profileStore?.value ?? profileStore;
  const name = profileData?.name;
  const image = typeof profileData?.avatar === "string" && profileData.avatar.startsWith("co_z") ? profileData.avatar : null;
  return {
    id: profileCoId,
    name: typeof name === "string" && name.length > 0 ? name : travelerFallback(accountCoId),
    image
  };
}
async function resolveOneToProfile(maia, accountCoId) {
  try {
    const selfProfile = await resolveSelfAccountProfileFromLiveAccount(maia, accountCoId);
    if (selfProfile)
      return selfProfile;
    let profileCoId = await resolveAccountToProfileCoIdViaIdentity(maia, accountCoId);
    if (!profileCoId) {
      const accountStore = await maia.do({ op: "read", factory: "@account", key: accountCoId });
      await waitForStore2(accountStore, 5000);
      const accountData = accountStore?.value ?? accountStore;
      profileCoId = accountData?.profile?.startsWith("co_") ? accountData.profile : null;
    }
    if (!profileCoId) {
      return { id: null, name: travelerFallback(accountCoId), image: null };
    }
    const profileStore = await maia.do({ op: "read", factory: null, key: profileCoId });
    await waitForStore2(profileStore, 5000);
    const profileData = profileStore?.value ?? profileStore;
    const name = profileData?.name;
    const image = typeof profileData?.avatar === "string" && profileData.avatar.startsWith("co_z") ? profileData.avatar : null;
    return {
      id: profileCoId,
      name: typeof name === "string" && name.length > 0 ? name : travelerFallback(accountCoId),
      image
    };
  } catch (_e) {
    return { id: null, name: travelerFallback(accountCoId), image: null };
  }
}
async function resolveAccountCoIdsToProfiles(maia, accountCoIds) {
  const result = new Map;
  if (!maia?.do || !Array.isArray(accountCoIds))
    return result;
  result.set("everyone", { id: null, name: "Everyone", image: null });
  const toResolve = [...new Set(accountCoIds)].filter((id) => typeof id === "string" && id.startsWith("co_z"));
  if (toResolve.length === 0)
    return result;
  const resolved = await Promise.all(toResolve.map(async (coId) => {
    const profile = await resolveOneToProfile(maia, coId);
    return [coId, profile];
  }));
  for (const [coId, profile] of resolved) {
    result.set(coId, profile);
  }
  return result;
}
// _cojson_src/helpers/resolve-capability-group.js
function truncate(str, maxLen = 16) {
  if (typeof str !== "string")
    return str;
  if (str.length <= maxLen)
    return str;
  return `${str.substring(0, maxLen)}...`;
}
function capitalizeCapability(str) {
  if (!str || typeof str !== "string")
    return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
async function waitForStore3(store, timeoutMs = 5000) {
  const val = store?.value ?? store;
  if (!val?.loading)
    return;
  await new Promise((resolve2, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout")), timeoutMs);
    const unsubscribe = store.subscribe?.((v) => {
      const s = v ?? store?.value ?? store;
      if (!s?.loading) {
        clearTimeout(timeout);
        unsubscribe?.();
        resolve2();
      }
    });
    const current = store?.value ?? store;
    if (!current?.loading) {
      clearTimeout(timeout);
      unsubscribe?.();
      resolve2();
    }
  });
}
async function buildCapabilityGroupMap(maia, accountId) {
  const result = new Map;
  if (!maia?.db || !accountId?.startsWith("co_"))
    return result;
  try {
    const accountStore = await maia.do({ op: "read", factory: "@account", key: accountId });
    await waitForStore3(accountStore, 5000);
    const accountData = accountStore?.value ?? accountStore;
    const sparksId = accountData?.sparks;
    if (!sparksId || typeof sparksId !== "string" || !sparksId.startsWith("co_"))
      return result;
    const sparksStore = await maia.do({ op: "read", factory: null, key: sparksId });
    await waitForStore3(sparksStore, 5000);
    const sparksRaw = sparksStore?.value ?? sparksStore;
    if (!sparksRaw || sparksRaw.error)
      return result;
    const sparksData = sparksRaw;
    const skipKeys = new Set(["id", "loading", "error", "$factory", "type", "cotype"]);
    for (const key of Object.keys(sparksData)) {
      if (skipKeys.has(key))
        continue;
      const sparkCoId = typeof sparksData[key] === "string" && sparksData[key].startsWith("co_") ? sparksData[key] : key.startsWith("co_") ? key : null;
      if (!sparkCoId)
        continue;
      try {
        const sparkStore = await maia.do({ op: "read", factory: null, key: sparkCoId });
        await waitForStore3(sparkStore, 3000);
        const sparkRaw = sparkStore?.value ?? sparkStore;
        const sparkData = sparkRaw;
        const osId = sparkData?.os;
        if (!osId?.startsWith("co_"))
          continue;
        const sparkName = sparkData?.name ?? key;
        if (typeof sparkData?.name === "string" && sparkData.name.trim() !== "" && !sparkData.name.startsWith("°")) {
          throw new Error("[resolveCapabilityGroup] spark name must be a full logical ref starting with °");
        }
        const displaySparkName = typeof sparkName === "string" ? sparkName : String(key ?? "");
        const osStore = await maia.do({ op: "read", factory: null, key: osId });
        await waitForStore3(osStore, 3000);
        const osRaw = osStore?.value ?? osStore;
        const osData = osRaw;
        const groupsId = osData?.groups;
        if (!groupsId?.startsWith("co_"))
          continue;
        const groupsStore = await maia.do({ op: "read", factory: null, key: groupsId });
        await waitForStore3(groupsStore, 3000);
        const groupsRaw = groupsStore?.value ?? groupsStore;
        if (!groupsRaw || groupsRaw.error)
          continue;
        const groupsData = groupsRaw;
        for (const capKey of Object.keys(groupsData)) {
          if (skipKeys.has(capKey))
            continue;
          const groupCoId = typeof groupsData[capKey] === "string" && groupsData[capKey].startsWith("co_") ? groupsData[capKey] : null;
          if (!groupCoId)
            continue;
          const capDisplay = capitalizeCapability(capKey);
          result.set(groupCoId, `${displaySparkName}/${capDisplay}`);
        }
      } catch (_e) {}
    }
  } catch (_e) {}
  return result;
}
async function resolveGroupCoIdsToCapabilityNames(maia, groupCoIds, accountId = null) {
  const result = new Map;
  if (!maia?.db || !Array.isArray(groupCoIds))
    return result;
  const toResolve = [...new Set(groupCoIds)].filter((id) => typeof id === "string" && id.startsWith("co_z"));
  if (toResolve.length === 0)
    return result;
  const aid = accountId ?? maia.id?.maiaId?.id;
  const capabilityMap = await buildCapabilityGroupMap(maia, aid);
  for (const coId of toResolve) {
    const name = capabilityMap.get(coId) ?? truncate(coId, 16);
    result.set(coId, name);
  }
  return result;
}

// cojson-bundle-entry.js
init_factory_index_manager();

// _cojson_src/indexing/factory-index-rebuild.js
import { createLogger as createLogger10 } from "@MaiaOS/logs";

var log10 = createLogger10("maia-db");
async function rebuildAllIndexes(peer) {
  const { applyPersistentCoValueIndexing: applyPersistentCoValueIndexing2 } = await Promise.resolve().then(() => (init_factory_index_manager(), exports_factory_index_manager));
  const map = peer.getAllCoValues?.() ?? peer.node?.coValues;
  if (!map || typeof map.entries !== "function")
    return;
  for (const [coId, core] of map.entries()) {
    if (!coId?.startsWith("co_z") || !core)
      continue;
    if (!peer.isAvailable?.(core))
      continue;
    if (!core.hasVerifiedContent?.())
      continue;
    try {
      await applyPersistentCoValueIndexing2(peer, core);
    } catch (error) {
      const isFactoryCompilationError = error?.message?.includes("Failed to compile factory");
      if (!isFactoryCompilationError) {
        log10.error("[rebuildAllIndexes] failed for", coId, error);
      }
    }
  }
}

// cojson-bundle-entry.js
init_factory_index_schema();
init_factory_index_warm_load();

// _cojson_src/registry/ensure-identity.js
init_collection_helpers();
init_groups();

import { extractCoValueData as extractCoValueData9 } from "../primitives/data-extraction.js";

var MAP_TIMEOUT_MS = 25000;
async function findIdentity(peer, identitySchemaCoId, accountId, type) {
  const coListId = await getCoListId(peer, identitySchemaCoId);
  if (!coListId?.startsWith("co_z"))
    return null;
  const coListCore = peer.getCoValue(coListId);
  if (!coListCore)
    return null;
  await ensureCoValueLoaded7(peer, coListId, { waitForAvailable: true, timeoutMs: MAP_TIMEOUT_MS });
  if (!peer.isAvailable(coListCore))
    return null;
  const content = peer.getCurrentContent(coListCore);
  if (!content?.toJSON)
    return null;
  const itemIds = content.toJSON();
  const filter = { account: accountId, type };
  const seenIds = new Set;
  for (const itemId of itemIds) {
    if (typeof itemId !== "string" || !itemId.startsWith("co_") || seenIds.has(itemId))
      continue;
    seenIds.add(itemId);
    await ensureCoValueLoaded7(peer, itemId, { waitForAvailable: true, timeoutMs: MAP_TIMEOUT_MS });
    const itemCore = peer.getCoValue(itemId);
    if (!itemCore || !peer.isAvailable(itemCore))
      continue;
    const itemData = extractCoValueData9(peer, itemCore);
    if (matchesFilter(itemData, filter))
      return itemId;
  }
  return null;
}
async function ensureIdentity({ peer, dataEngine, type, accountId, profileId }) {
  if (!accountId?.startsWith("co_z") || !profileId?.startsWith("co_z")) {
    throw new Error("ensureIdentity: accountId and profileId (co_z) required");
  }
  if (!["human", "aven"].includes(type)) {
    throw new Error("ensureIdentity: type must be human or aven");
  }
  if (!dataEngine?.execute) {
    throw new Error("ensureIdentity: dataEngine.execute required");
  }
  if (!dataEngine.resolveSystemFactories) {
    throw new Error("ensureIdentity: resolveSystemFactories missing on dataEngine");
  }
  await dataEngine.resolveSystemFactories();
  const identitySchemaCoId = peer.infra?.identity;
  if (!identitySchemaCoId?.startsWith("co_z")) {
    throw new Error("Identity schema not found — resolve system factories / peer.infra");
  }
  const existingId = await findIdentity(peer, identitySchemaCoId, accountId, type);
  if (existingId) {
    return { ok: true, alreadyRegistered: true, identityCoMapId: existingId };
  }
  const guardian = await peer.getMaiaGroup();
  if (!guardian)
    throw new Error("Guardian not found");
  const node = peer.node;
  const identityGroup = node.createGroup();
  identityGroup.extend(guardian, "extend");
  identityGroup.addMember("everyone", "reader");
  const identityCoMap = identityGroup.createMap({ type, account: accountId, profile: profileId }, { $factory: identitySchemaCoId });
  const memberIdToRemove = typeof node.getCurrentAccountOrAgentID === "function" ? node.getCurrentAccountOrAgentID() : peer.account?.id ?? peer.account?.$jazz?.id;
  try {
    await removeGroupMember(identityGroup, memberIdToRemove);
  } catch (_e) {}
  return { ok: true, identityCoMapId: identityCoMap.id };
}
async function listAccountIdsFromIdentityIndex(peer, type) {
  if (!["human", "aven"].includes(type))
    return [];
  if (peer.dbEngine?.resolveSystemFactories) {
    await peer.dbEngine.resolveSystemFactories();
  }
  const identitySchemaCoId = peer.infra?.identity;
  if (!identitySchemaCoId?.startsWith("co_z"))
    return [];
  const coListId = await getCoListId(peer, identitySchemaCoId);
  if (!coListId?.startsWith("co_z"))
    return [];
  await ensureCoValueLoaded7(peer, coListId, { waitForAvailable: true, timeoutMs: MAP_TIMEOUT_MS });
  const coListCore = peer.getCoValue(coListId);
  if (!coListCore || !peer.isAvailable(coListCore))
    return [];
  const content = peer.getCurrentContent(coListCore);
  if (!content?.toJSON)
    return [];
  const itemIds = content.toJSON();
  const accounts = [];
  const seen = new Set;
  for (const itemId of itemIds) {
    if (typeof itemId !== "string" || !itemId.startsWith("co_"))
      continue;
    await ensureCoValueLoaded7(peer, itemId, { waitForAvailable: true, timeoutMs: 8000 });
    const itemCore = peer.getCoValue(itemId);
    if (!itemCore || !peer.isAvailable(itemCore))
      continue;
    const itemData = extractCoValueData9(peer, itemCore);
    if (itemData?.type !== type)
      continue;
    const acc = itemData?.account;
    if (acc?.startsWith("co_z") && !seen.has(acc)) {
      seen.add(acc);
      accounts.push(acc);
    }
  }
  return accounts;
}
// _cojson_src/resolve-helpers.js
init_collection_helpers();
async function readStore(dataEngine, coId) {
  if (!dataEngine?.peer)
    return null;
  if (!coId || typeof coId !== "string")
    return null;
  if (!coId.startsWith("co_z")) {
    throw new Error(`[StoreReader] Expected co-id (co_z...), got ref: ${coId}. ` + `Refs must be transformed to co-ids during seeding. Re-run sync genesis (PEER_SYNC_SEED=true once) or wipe local storage and re-seed.`);
  }
  const factoryCoId = await dataEngine.peer.resolve({ fromCoValue: coId }, { returnType: "coId" });
  if (!factoryCoId)
    return null;
  return dataEngine.execute({ op: "read", factory: factoryCoId, key: coId });
}
async function resolveToCoId(_peer, ref) {
  if (!ref || typeof ref !== "string")
    return null;
  if (ref.startsWith("co_z"))
    return ref;
  throw new Error(`[resolveToCoId] Expected co-id (co_z...), got: ${ref}`);
}
async function resolveFactoryFromCoValue(peer, coId) {
  if (!peer || !coId?.startsWith("co_z"))
    return null;
  try {
    const coValueCore = peer.getCoValue(coId);
    if (coValueCore?.isAvailable()) {
      const readFactory = () => {
        const meta = coValueCore.meta;
        if (meta?.$factory && typeof meta.$factory === "string" && meta.$factory.startsWith("co_z"))
          return meta.$factory;
        const header = peer.getHeader(coValueCore);
        const factory2 = header?.meta?.$factory;
        if (factory2 && typeof factory2 === "string" && factory2.startsWith("co_z"))
          return factory2;
        return null;
      };
      let factory = readFactory();
      if (factory)
        return factory;
      for (let i = 0;i < 10; i++) {
        await new Promise((r) => setTimeout(r, 100 + i * 50));
        factory = readFactory();
        if (factory)
          return factory;
      }
    }
    return await peer.resolve({ fromCoValue: coId }, { returnType: "coId" });
  } catch {
    return null;
  }
}
async function loadContextStore(dataEngine, ref, options = {}) {
  if (!ref?.startsWith("co_z"))
    return { store: null, coId: null, factoryCoId: null };
  const peer = dataEngine?.peer;
  const coId = ref;
  if (options.ensureLoaded && peer) {
    await ensureCoValueLoaded7(peer, coId, options.ensureLoaded).catch(() => {});
  }
  let store = await readStore(dataEngine, coId);
  const retries = options.retries ?? 0;
  for (let i = 0;!store && i < retries; i++) {
    await new Promise((r) => setTimeout(r, 150 + i * 100));
    store = await readStore(dataEngine, coId);
  }
  if (!store)
    return { store: null, coId, factoryCoId: null };
  if (options.waitForStoreReadyMs) {
    await waitForStoreReady(store, coId, options.waitForStoreReadyMs).catch(() => {});
  }
  const factoryCoId = await resolveFactoryFromCoValue(peer, coId);
  return { store, coId, factoryCoId };
}

export {
  accountHasCapabilityOnPeer,
  addGroupMember,
  appendFactoryDefinitionToCatalog,
  applyMapTransform,
  applyMapTransformToArray,
  applyPersistentCoValueIndexing,
  bootstrapWarnState,
  checkCotype,
  collectCapabilityGrantCoIdsFromColistContent,
  collectInboxMessageCoIds,
  create,
  createAndPushMessage,
  createChildGroup,
  createCoBinary,
  createCoList,
  createCoMap,
  createCoStream,
  createCoValueForSpark,
  createGroup,
  createProfile,
  createUnifiedStore,
  debugLog2 as debugLog,
  deepResolveCoValue,
  deleteRecord,
  ensureCoValueAvailable,
  ensureCoValueLoaded7 as ensureCoValueLoaded,
  ensureCoValueReadyForIndex,
  ensureDerivedLifecycle,
  ensureFactoryIndexColist,
  ensureIdentity,
  ensureIndexesCoMap,
  ensureNanoidIndexCoMap,
  ensureOsCoMap,
  ensureUnknownColist,
  extractAccountMembers,
  extractEveryoneRole,
  extractGroupMembers,
  extractHeaderFromStorageMessage,
  factoryDefAllowsInstanceIndexing,
  findFirst,
  findNewSuccessFromTarget,
  getCapabilityGrantIndexColistCoId,
  getCapabilityGrantIndexColistCoIdFromPeer,
  getCapabilityGroupIdFromOsId,
  getCoListId,
  getFactoryIndexColistId,
  getGroup,
  getGroupInfoFromGroup,
  getMaiaGroup,
  getMapDependencyCoIds,
  getMetafactoryCoId,
  getQueryFilterFromValue,
  getQueryMapFromValue,
  getSparkCapabilityGroupId,
  getSparkCapabilityGroupIdFromSparkCoId,
  getSparkGroup,
  getSparkOsId,
  getSparkOsMetaFactoryCoId,
  getSparksRegistryContent,
  getSparksRegistryId,
  getSparkVibesId,
  INFRA_SLOTS, 
  indexByNanoid,
  indexCoValue,
  indexFromMessage,
  isDeepResolvedOrResolving,
  isFactoryCoValue,
  isFindOneFilter,
  isQueryObject,
  listAccountIdsFromIdentityIndex,
  loadCapabilitiesGrants,
  loadContextStore,
  loadFactoriesFromAccount,
  loadIndexColistContent,
  loadInfraFromSparkOs,
  loadNanoidIndex,
  log5 as log,
  MaiaDB,
  maiaDbAddGroupMember,
  maiaDbCheckCotype,
  maiaDbCreate,
  maiaDbCreateAndPushMessage,
  maiaDbCreateSpark,
  maiaDbDelete,
  maiaDbDeleteSpark,
  maiaDbEnsureAccountOsReady,
  maiaDbFindFirst,
  maiaDbGetGroup,
  maiaDbGetGroupInfo,
  maiaDbGetGroupInfoFromGroup,
  maiaDbGetMaiaGroup,
  maiaDbGetRawRecord,
  maiaDbGetSparkCapabilityGroupIdFromSparkCoId,
  maiaDbProcessInbox,
  maiaDbRead,
  maiaDbReadInboxWithSessions,
  maiaDbReadSpark,
  maiaDbRemoveGroupMember,
  maiaDbResolve,
  maiaDbResolveReactive,
  maiaDbResolveSystemSparkCoId,
  maiaDbSeed,
  maiaDbSetGroupMemberRole,
  maiaDbUpdate,
  maiaDbUpdateSpark,
  maiaDbWaitForReactiveResolution,
  makeSingleCoCleanup,
  matchesFilter,
  NANOID_INDEX_KEY,
  normalizeSparkLogicalName,
  processInbox,
  read,
  readAllCoValues,
  readCollection,
  readCoMapCoIdField,
  readHeaderAndContent,
  readLiveSparksRegistryEntries,
  readSingleCoValue,
  readSparksFromAccount,
  readStore,
  rebuildAllIndexes,
  reconcileIndexes,
  registerFactoryCoValue,
  removeFromIndex,
  removeGroupMember,
  resolve,
  resolveAccountCoIdsToProfiles,
  resolveCoValueReactive,
  resolveFactoryAuthoring,
  resolveFactoryDefFromPeer,
  resolveFactoryFromCoValue,
  resolveFactoryReactive,
  resolveGroupCoIdsToCapabilityNames,
  resolveNestedReferences,
  resolveNestedReferencesPublic,
  resolveQueryReactive,
  resolveReactive,
  resolveReactiveDependency,
  resolveSchemaLazy,
  resolveSparkCoId,
  resolveToCoId,
  SPARK_OS_META_FACTORY_CO_ID_KEY,
  SYSTEM_SPARK_REGISTRY_KEY,
  setGroupMemberRole,
  setMaiaReadDerivedStoreLive,
  setSparkVibesId,
  shouldIndexCoValue,
  shouldProcessInboxMessageForSession,
  update,
  validateInvite,
  waitForHeaderMetaFactory,
  waitForReactiveResolution,
  waitForStoreReady,
  wouldLeaveNoAdmins,
  wrapStorageWithIndexingHooks
};
