/**
 * CoValue Resolver - Core resolution utility following Jazz inspector pattern
 * 
 * This file provides both:
 * 1. Inspector-style resolveCoValueById (takes coId + node, uses node.load directly)
 * 2. Backward-compatible resolveCoValue (takes wrapped CoValue)
 * 
 * The new architecture uses node.load() directly (like Jazz inspector) instead of
 * accessing coValue[key] properties.
 */

import type { CoID, LocalNode, RawCoValue } from "cojson";
import { resolveCoValue as inspectorResolveCoValue, getNodeFromCoValue } from "./useResolvedCoValue.js";

export type CoJsonType = "comap" | "costream" | "colist" | "coplaintext";
export type ExtendedCoJsonType =
  | "image"
  | "file"
  | "CoPlainText"
  | "CoRichText"
  | "CoFeed"
  | "CoMap"
  | "CoList"
  | "CoValue"
  | "record"
  | "account"
  | "group";

export interface ResolvedCoValue {
  coValue: any;
  snapshot: Record<string, any> | null | "unavailable";
  type: CoJsonType | null;
  extendedType: ExtendedCoJsonType | undefined;
  isLoaded: boolean;
}

/**
 * Resolve a CoValue by ID using node.load() directly (matches inspector's resolveCoValue)
 * 
 * @param coValueId - The CoValue ID to resolve
 * @param node - The LocalNode to use for loading
 * @returns ResolvedCoValue with snapshot, type, and extendedType
 */
export async function resolveCoValueById(
  coValueId: CoID<RawCoValue> | string,
  node: LocalNode,
): Promise<ResolvedCoValue> {
  const result = await inspectorResolveCoValue(coValueId as CoID<RawCoValue>, node);

  return {
    coValue: result.value,
    snapshot: result.snapshot === "unavailable" ? "unavailable" : (result.snapshot || null),
    type: result.type,
    extendedType: result.extendedType as ExtendedCoJsonType | undefined,
    isLoaded: result.value !== undefined,
  };
}

/**
 * Backward-compatible wrapper: Resolve a wrapped CoValue
 * Extracts the CoID and node, then uses the inspector-style resolution
 * 
 * @param coValue - The wrapped CoValue to resolve
 * @returns ResolvedCoValue with snapshot, type, and extendedType
 */
export function resolveCoValue(coValue: any): ResolvedCoValue {
  if (!coValue || !coValue.$jazz) {
    return {
      coValue: null,
      snapshot: null,
      type: null,
      extendedType: undefined,
      isLoaded: false,
    };
  }

  // Check if loaded
  if (!coValue.$isLoaded) {
    return {
      coValue,
      snapshot: null,
      type: null,
      extendedType: undefined,
      isLoaded: false,
    };
  }

  try {
    // Get snapshot using $jazz.raw.toJSON() (like Jazz inspector)
    let snapshot: Record<string, any> | null = null;
    if (coValue.$jazz?.raw && typeof coValue.$jazz.raw.toJSON === "function") {
      snapshot = coValue.$jazz.raw.toJSON() as Record<string, any>;
    }

    // Get native type from $jazz.raw.type (like Jazz inspector)
    const nativeType = coValue.$jazz?.raw?.type as CoJsonType | undefined;

    if (!nativeType) {
      return {
        coValue,
        snapshot,
        type: null,
        extendedType: undefined,
        isLoaded: true,
      };
    }

    // Determine extended type based on native type and snapshot structure
    let extendedType: ExtendedCoJsonType | undefined;

    if (nativeType === "comap") {
      if (snapshot && isBrowserImage(snapshot)) {
        extendedType = "image";
      } else {
        extendedType = "CoMap";
      }
    } else if (nativeType === "colist") {
      extendedType = "CoList";
    } else if (nativeType === "costream") {
      // Check if it's a FileStream (binary stream)
      if (coValue.getChunks || coValue.toBlob || coValue.isBinaryStreamEnded) {
        extendedType = "file";
      } else if (isTextStream(coValue, snapshot)) {
        // Determine if CoPlainText or CoRichText
        if (typeof snapshot === "string") {
          extendedType = "CoPlainText";
        } else {
          extendedType = "CoRichText";
        }
      } else {
        extendedType = "CoValue";
      }
    } else if (nativeType === "coplaintext") {
      extendedType = "CoPlainText";
    } else {
      // Check for CoFeed (has perAccount, perSession, byMe)
      if (snapshot && isCoFeed(coValue, snapshot)) {
        extendedType = "CoFeed";
      } else {
        extendedType = "CoValue";
      }
    }

    return {
      coValue,
      snapshot,
      type: nativeType,
      extendedType,
      isLoaded: true,
    };
  } catch (e) {
    console.warn("[CoValue Resolver] Error resolving CoValue:", e);
    return {
      coValue,
      snapshot: null,
      type: null,
      extendedType: undefined,
      isLoaded: false,
    };
  }
}

// Helper functions for backward compatibility
function isBrowserImage(snapshot: Record<string, any>): boolean {
  return "originalSize" in snapshot && "placeholderDataURL" in snapshot;
}

function isCoFeed(coValue: any, snapshot: Record<string, any>): boolean {
  return !!(snapshot.perAccount || snapshot.perSession || snapshot.byMe || coValue.perAccount || coValue.perSession || coValue.byMe);
}

function isTextStream(coValue: any, snapshot: any): boolean {
  if (typeof snapshot === "string") {
    return true;
  }
  return typeof coValue.toString === "function" && typeof coValue.valueOf === "function";
}

/**
 * Resolve multiple CoValues
 */
export function resolveCoValues(coValues: any[]): ResolvedCoValue[] {
  return coValues.map(resolveCoValue);
}

/**
 * Get the display type string for a CoValue
 * Returns the extendedType if available, otherwise falls back to native type
 */
export function getCoValueDisplayType(coValue: any): string {
  const resolved = resolveCoValue(coValue);
  if (resolved.extendedType) {
    return resolved.extendedType;
  }
  if (resolved.type) {
    // Capitalize first letter
    return resolved.type.charAt(0).toUpperCase() + resolved.type.slice(1);
  }
  return "CoValue";
}






