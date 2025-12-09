/**
 * View Buttons Leaf Components
 */

import type { LeafNode } from "../../../view/leaf-types";

export const viewButtonList: LeafNode = {
    tag: "button",
    attributes: { type: "button" },
    classes: [
        "px-4",
        "py-2",
        "rounded-full",
        "border",
        "transition-all",
        "duration-300",
        "font-medium",
        "text-sm",
    ],
    bindings: {
        visible: "true", // Always visible, but we'll handle active state via classes
    },
    events: {
        click: {
            event: "SET_VIEW",
            payload: { viewMode: "list" },
        },
    },
    children: ["List"],
};

export const viewButtonKanban: LeafNode = {
    tag: "button",
    attributes: { type: "button" },
    classes: [
        "px-4",
        "py-2",
        "rounded-full",
        "border",
        "transition-all",
        "duration-300",
        "font-medium",
        "text-sm",
    ],
    events: {
        click: {
            event: "SET_VIEW",
            payload: { viewMode: "kanban" },
        },
    },
    children: ["Kanban"],
};

export const viewButtonTimeline: LeafNode = {
    tag: "button",
    attributes: { type: "button" },
    classes: [
        "px-4",
        "py-2",
        "rounded-full",
        "border",
        "transition-all",
        "duration-300",
        "font-medium",
        "text-sm",
    ],
    events: {
        click: {
            event: "SET_VIEW",
            payload: { viewMode: "timeline" },
        },
    },
    children: ["Timeline"],
};

export const viewButtonConfig: LeafNode = {
    tag: "button",
    attributes: { type: "button" },
    classes: [
        "px-4",
        "py-2",
        "rounded-full",
        "border",
        "transition-all",
        "duration-300",
        "font-medium",
        "text-sm",
    ],
    events: {
        click: {
            event: "SET_VIEW",
            payload: { viewMode: "config" },
        },
    },
    children: ["Config"],
};

