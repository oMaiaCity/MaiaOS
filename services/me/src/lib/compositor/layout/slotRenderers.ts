/**
 * Slot Renderers - Render specific slot types for use in LayoutEngine
 * These are leaf renderers that work with the layout system
 */

import { HOVERABLE_STYLE } from "$lib/utils/styles";
import type { ResolvedUISlot } from "../ui-slots/types";
import type { LayoutSlot } from "./types";

/**
 * Render a slot's content based on its type
 */
export function renderSlotContent(
  slot: LayoutSlot,
  resolvedSlots: ResolvedUISlot[],
  getSlotValue: (slotId: string) => unknown,
  renderSlot: (slotId: string) => unknown,
  getSlotMapping: (slotId: string) => LayoutSlot | undefined,
  triggerEvent: (slotId: string, interaction: string, itemData?: Record<string, unknown>, additionalPayload?: Record<string, unknown>) => void,
  getListItems: (listSlotId: string) => Array<Record<string, unknown>>,
  isLoading: boolean,
  onEvent?: (event: string, payload?: unknown) => void,
): unknown {
  const slotId = slot.slot;
  const value = getSlotValue(slotId);

  // Title slot
  if (slotId === "title") {
    return String(renderSlot(slotId));
  }

  // Description slot
  if (slotId === "description") {
    return String(renderSlot(slotId));
  }

  // Input slot
  if (slotId === "input.value") {
    const inputData = renderSlot(slotId) as Record<string, unknown>;
    const inputMapping = getSlotMapping(slotId);
    return {
      type: "input",
      data: inputData,
      mapping: inputMapping,
      isLoading,
      triggerEvent,
    };
  }

  // Error slot
  if (slotId === "error") {
    return {
      type: "error",
      message: String(renderSlot(slotId)),
      mapping: getSlotMapping(slotId),
      triggerEvent,
    };
  }

  // List slot
  if (slotId === "list") {
    return {
      type: "list",
      items: getListItems(slotId),
      mapping: getSlotMapping("list.item.id"),
      triggerEvent,
    };
  }

  // Default: return raw value
  return value;
}

