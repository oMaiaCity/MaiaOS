/**
 * UI Slot Renderer - Renders UI based on slot configuration
 * Generic renderer that works with any data structure
 */

import type { ResolvedUISlot } from "./types";
import { matchesSlotPattern } from "./resolver";

/**
 * Slot Renderer Context - Context for rendering slots
 */
export interface SlotRendererContext {
    slots: ResolvedUISlot[];
    data: Record<string, unknown>;
    onEvent?: (event: string, payload?: unknown) => void;
}

/**
 * Render a single slot by ID
 */
export function renderSlot(
    context: SlotRendererContext,
    slotId: string,
): unknown {
    const slot = context.slots.find((s) => s.slot === slotId);
    if (!slot) return null;

    const value = slot.value;
    const type = slot.type || inferSlotType(slotId, value);

    switch (type) {
        case "text":
            return renderTextSlot(value);
        case "list":
            return renderListSlot(context, slotId, value);
        case "input":
            return renderInputSlot(context, slotId, value, slot.config);
        case "button":
            return renderButtonSlot(context, slotId, value, slot.config);
        default:
            return value;
    }
}

/**
 * Infer slot type from slot ID and value
 */
function inferSlotType(slotId: string, value: unknown): string {
    if (Array.isArray(value)) return "list";
    if (typeof value === "string" || typeof value === "number") return "text";
    if (slotId.includes("input")) return "input";
    if (slotId.includes("button")) return "button";
    return "text";
}

/**
 * Render text slot
 */
function renderTextSlot(value: unknown): string {
    if (value === null || value === undefined) return "";
    return String(value);
}

/**
 * Render list slot - finds item slots and renders them
 */
function renderListSlot(
    context: SlotRendererContext,
    slotId: string,
    value: unknown,
): Array<Record<string, unknown>> {
    if (!Array.isArray(value)) return [];

    // Find item slot pattern (e.g., "list.item.*")
    const itemPattern = `${slotId}.item`;
    const itemSlots = context.slots.filter((s) =>
        s.slot.startsWith(itemPattern + "."),
    );

    return value.map((item, index) => {
        const itemData: Record<string, unknown> = { ...item, _index: index };
        const itemSlotData: Record<string, unknown> = {};

        itemSlots.forEach((slot) => {
            const itemKey = slot.slot.replace(`${itemPattern}.`, "");
            // Resolve nested paths within the item
            if (typeof item === "object" && item !== null) {
                const itemValue = (item as Record<string, unknown>)[itemKey];
                itemSlotData[itemKey] = itemValue;
            }
        });

        return { ...itemData, ...itemSlotData };
    });
}

/**
 * Render input slot
 */
function renderInputSlot(
    context: SlotRendererContext,
    slotId: string,
    value: unknown,
    config?: Record<string, unknown>,
): Record<string, unknown> {
    return {
        value: value || "",
        placeholder: config?.placeholder || "",
        type: config?.type || "text",
        slotId,
    };
}

/**
 * Render button slot
 */
function renderButtonSlot(
    context: SlotRendererContext,
    slotId: string,
    value: unknown,
    config?: Record<string, unknown>,
): Record<string, unknown> {
    return {
        label: value || config?.label || "",
        event: config?.event || "",
        slotId,
    };
}

/**
 * Get all slots matching a pattern
 */
export function getSlotsByPattern(
    slots: ResolvedUISlot[],
    pattern: string,
): ResolvedUISlot[] {
    return slots.filter((slot) => matchesSlotPattern(slot.slot, pattern));
}

