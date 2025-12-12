/**
 * useResolvedCoValue - Svelte reactive primitive matching Jazz inspector's useResolvedCoValue
 * 
 * This is the single source of truth for resolving CoValues by ID.
 * Uses node.load() directly (like Jazz inspector) instead of accessing coValue[key].
 */

import type { CoID, LocalNode, RawCoValue, RawCoStream, RawBinaryCoStream } from "cojson";

export type CoJsonType = "comap" | "costream" | "colist" | "coplaintext";
export type ExtendedCoJsonType =
  | "image"
  | "record"
  | "account"
  | "group"
  | "file"
  | "CoPlainText"
  | "CoRichText"
  | "CoFeed";

type JSON = string | number | boolean | null | JSON[] | { [key: string]: JSON };
type JSONObject = { [key: string]: JSON };

type ResolvedImageDefinition = {
  originalSize: [number, number];
  placeholderDataURL?: string;
  [res: `${number}x${number}`]: RawBinaryCoStream["id"];
};

type ResolvedGroup = {
  readKey: string;
  [key: string]: JSON;
};

type ResolvedAccount = {
  profile: {
    name: string;
  };
  [key: string]: JSON;
};

export type ResolvedCoValueResult =
  | {
    value: RawCoValue;
    snapshot: JSONObject;
    type: CoJsonType | null;
    extendedType: ExtendedCoJsonType | undefined;
  }
  | {
    value: undefined;
    snapshot: "unavailable";
    type: null;
    extendedType: undefined;
  }
  | {
    value: undefined;
    snapshot: undefined;
    type: undefined;
    extendedType: undefined;
  };

// Type guard for browser image
function isBrowserImage(snapshot: JSONObject): snapshot is ResolvedImageDefinition {
  return "originalSize" in snapshot && "placeholderDataURL" in snapshot;
}

function isGroup(snapshot: JSONObject): snapshot is ResolvedGroup {
  return "readKey" in snapshot;
}

// Detect CoStream type (binary vs text)
function detectCoStreamType(value: RawCoStream | RawBinaryCoStream): {
  type: "binary" | "text" | "unknown";
} {
  const firstKey = Object.keys(value.items)[0];
  if (!firstKey) {
    return { type: "unknown" };
  }

  const items = (value.items as any)[firstKey]?.map((v: any) => v.value);

  if (!items || items.length === 0) {
    return { type: "unknown" };
  }

  const firstItem = items[0];
  if (
    typeof firstItem === "object" &&
    firstItem !== null &&
    "type" in firstItem &&
    firstItem.type === "start"
  ) {
    return { type: "binary" };
  }

  return { type: "text" };
}

/**
 * Resolve a CoValue by ID (matches inspector's resolveCoValue)
 */
export async function resolveCoValue(
  coValueId: CoID<RawCoValue>,
  node: LocalNode,
): Promise<ResolvedCoValueResult> {
  const value = await node.load(coValueId);

  if (value === "unavailable") {
    return {
      value: undefined,
      snapshot: "unavailable",
      type: null,
      extendedType: undefined,
    };
  }

  const snapshot = value.toJSON() as JSONObject;
  const type = value.type as CoJsonType;

  // Determine extended type
  let extendedType: ExtendedCoJsonType | undefined;

  if (type === "comap") {
    if (isBrowserImage(snapshot)) {
      extendedType = "image";
    } else if (value.headerMeta?.type === "account") {
      extendedType = "account";
    } else if (value.core.isGroup()) {
      extendedType = "group";
    }
  } else if (type === "costream") {
    const coStream = detectCoStreamType(value as RawCoStream);
    if (coStream.type === "binary") {
      extendedType = "file";
    } else if (coStream.type === "text") {
      // Check if it's CoPlainText or CoRichText
      if (typeof snapshot === "string") {
        extendedType = "CoPlainText";
      } else {
        extendedType = "CoRichText";
      }
    }
  } else if (type === "coplaintext") {
    extendedType = "CoPlainText";
  } else if (type === "colist") {
    // Check if it's a CoFeed (has perAccount, perSession, byMe)
    if (
      snapshot &&
      (snapshot.perAccount || snapshot.perSession || snapshot.byMe)
    ) {
      extendedType = "CoFeed";
    }
  }

  return {
    value,
    snapshot,
    type,
    extendedType,
  };
}

/**
 * Subscribe to CoValue updates (matches inspector's subscribeToCoValue)
 */
function subscribeToCoValue(
  coValueId: CoID<RawCoValue>,
  node: LocalNode,
  callback: (result: ResolvedCoValueResult) => void,
): () => void {
  return node.subscribe(coValueId, (value: any) => {
    if (value === "unavailable") {
      callback({
        value: undefined,
        snapshot: "unavailable",
        type: null,
        extendedType: undefined,
      });
    } else {
      const snapshot = value.toJSON() as JSONObject;
      const type = value.type as CoJsonType;
      let extendedType: ExtendedCoJsonType | undefined;

      if (type === "comap") {
        if (isBrowserImage(snapshot)) {
          extendedType = "image";
        } else if (value.headerMeta?.type === "account") {
          extendedType = "account";
        } else if (value.core.isGroup()) {
          extendedType = "group";
        }
      } else if (type === "costream") {
        const coStream = detectCoStreamType(value as RawCoStream);
        if (coStream.type === "binary") {
          extendedType = "file";
        } else if (coStream.type === "text") {
          if (typeof snapshot === "string") {
            extendedType = "CoPlainText";
          } else {
            extendedType = "CoRichText";
          }
        }
      } else if (type === "coplaintext") {
        extendedType = "CoPlainText";
      } else if (type === "colist") {
        if (
          snapshot &&
          (snapshot.perAccount || snapshot.perSession || snapshot.byMe)
        ) {
          extendedType = "CoFeed";
        }
      }

      callback({
        value,
        snapshot,
        type,
        extendedType,
      });
    }
  });
}

import { writable, type Readable } from 'svelte/store';

/**
 * Create a reactive store for a resolved CoValue
 * To be used in Svelte components like this:
 * 
 * ```svelte
 * <script>
 *   const resolved = createResolvedCoValue(coValueId, node);
 *   $: value = $resolved;
 * </script>
 * ```
 * 
 * This sets up a subscription that automatically updates when the CoValue changes.
 * Note: When coValueId or node changes, you should create a new store.
 */
export function createResolvedCoValue(
  coValueId: CoID<RawCoValue> | string | undefined,
  node: LocalNode | undefined,
): Readable<ResolvedCoValueResult> {
  const initialValue: ResolvedCoValueResult = {
    value: undefined,
    snapshot: undefined,
    type: undefined,
    extendedType: undefined,
  };

  const store = writable<ResolvedCoValueResult>(initialValue);

  // Set up subscription if we have both coValueId and node
  if (coValueId && node) {
    subscribeToCoValue(coValueId as CoID<RawCoValue>, node, (newResult) => {
      store.set(newResult);
    });
  } else {
    // Reset to initial value if inputs are invalid
    store.set(initialValue);
  }

  return store;
}

/**
 * Svelte reactive primitive for resolving a single CoValue
 * Matches inspector's useResolvedCoValue hook
 * 
 * Returns a store that components can subscribe to using $resolved
 */
export function useResolvedCoValue(
  coValueId: CoID<RawCoValue> | string | undefined,
  node: LocalNode | undefined,
): Readable<ResolvedCoValueResult> {
  return createResolvedCoValue(coValueId, node);
}

/**
 * Create reactive resolved CoValues store for multiple CoValues
 * To be used in Svelte components like this:
 * 
 * ```svelte
 * <script>
 *   const resolved = createResolvedCoValues(coValueIds, node);
 *   $: values = $resolved;
 * </script>
 * ```
 */
export function createResolvedCoValues(
  coValueIds: (CoID<RawCoValue> | string)[],
  node: LocalNode | undefined,
): Readable<ResolvedCoValueResult[]> {
  const initialValue: ResolvedCoValueResult[] = coValueIds.map(() => ({
    value: undefined,
    snapshot: undefined,
    type: undefined,
    extendedType: undefined,
  }));

  const store = writable<ResolvedCoValueResult[]>(initialValue);

  if (node && coValueIds.length > 0) {
    let isMounted = true;
    const unsubscribes: (() => void)[] = [];

    coValueIds.forEach((coValueId, index) => {
      const unsubscribe = subscribeToCoValue(
        coValueId as CoID<RawCoValue>,
        node,
        (newResult) => {
          if (isMounted) {
            store.update((results) => {
              const updated = [...results];
              updated[index] = newResult;
              return updated;
            });
          }
        },
      );
      unsubscribes.push(unsubscribe);
    });

    // Note: Cleanup happens when store is unsubscribed
    // Components using this should handle cleanup via Svelte's automatic cleanup
  }

  return store;
}

/**
 * Svelte reactive primitive for resolving multiple CoValues
 * Matches inspector's useResolvedCoValues hook
 * 
 * Returns a store that components can subscribe to using $resolved
 */
export function useResolvedCoValues(
  coValueIds: (CoID<RawCoValue> | string)[],
  node: LocalNode | undefined,
): Readable<ResolvedCoValueResult[]> {
  return createResolvedCoValues(coValueIds, node);
}

/**
 * Helper to get node from a wrapped CoValue
 */
export function getNodeFromCoValue(coValue: any): LocalNode | undefined {
  return coValue?.$jazz?.raw?.core?.node;
}






