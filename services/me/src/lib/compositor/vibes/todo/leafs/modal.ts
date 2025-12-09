/**
 * Modal Leaf Component
 */

import type { LeafNode } from "../../../view/leaf-types";

export const modalLeaf: LeafNode = {
    tag: "div",
    classes: [
        "fixed",
        "inset-0",
        "z-50",
        "flex",
        "items-center",
        "justify-center",
        "bg-black/50",
        "backdrop-blur-sm",
    ],
    bindings: {
        visible: "data.showModal",
    },
    events: {
        click: {
            event: "CLOSE_MODAL",
        },
    },
    children: [
        {
            tag: "div",
            classes: [
                "relative",
                "w-full",
                "max-w-2xl",
                "mx-4",
                "bg-white",
                "rounded-3xl",
                "shadow-2xl",
                "p-6",
                "max-h-[90vh]",
                "overflow-y-auto",
            ],
            // No click event - stops propagation automatically
            children: [
                {
                    tag: "button",
                    attributes: { type: "button" },
                    classes: [
                        "absolute",
                        "top-4",
                        "right-4",
                        "w-8",
                        "h-8",
                        "rounded-full",
                        "bg-slate-100",
                        "hover:bg-slate-200",
                        "flex",
                        "items-center",
                        "justify-center",
                        "transition-all",
                    ],
                    events: {
                        click: {
                            event: "CLOSE_MODAL",
                        },
                    },
                    children: [
                        {
                            tag: "svg",
                            attributes: {
                                class: "w-5 h-5 text-slate-600",
                                fill: "none",
                                viewBox: "0 0 24 24",
                                stroke: "currentColor",
                            },
                            children: [
                                {
                                    tag: "path",
                                    attributes: {
                                        "stroke-linecap": "round",
                                        "stroke-linejoin": "round",
                                        "stroke-width": "2",
                                        d: "M6 18L18 6M6 6l12 12",
                                    },
                                },
                            ],
                        },
                    ],
                },
                {
                    tag: "div",
                    classes: ["space-y-4"],
                    children: [
                        {
                            tag: "h2",
                            classes: ["text-2xl", "font-bold", "text-slate-900", "pr-8"],
                            bindings: { text: "data.selectedTodo.text" },
                        },
                    ],
                },
            ],
        },
    ],
};

