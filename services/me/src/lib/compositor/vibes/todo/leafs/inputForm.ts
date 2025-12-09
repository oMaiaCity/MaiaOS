/**
 * Input Form Leaf Component
 */

import type { LeafNode } from "../../../view/leaf-types";

export const inputFormLeaf: LeafNode = {
  tag: "form",
  classes: ["mb-4", "flex", "gap-2", "items-center"],
  events: {
    submit: {
      event: "ADD_TODO",
    },
  },
  children: [
    {
      tag: "input",
      attributes: {
        type: "text",
        placeholder: "Add a new todo...",
      },
      classes: [
        "flex-1",
        "px-4",
        "py-2",
        "rounded-2xl",
        "bg-slate-100",
        "border",
        "border-white",
        "shadow-[0_0_4px_rgba(0,0,0,0.02)]",
        "focus:outline-none",
        "focus:ring-2",
        "focus:ring-slate-500",
        "focus:border-slate-300",
        "transition-all",
        "text-slate-900",
        "placeholder:text-slate-400",
      ],
      bindings: { value: "data.newTodoText" },
      events: {
        input: {
          event: "UPDATE_INPUT",
        },
      },
    },
    {
      tag: "button",
      attributes: { type: "submit" },
      classes: [
        "px-4",
        "py-2",
        "bg-[#001a42]",
        "border",
        "border-[#001a42]",
        "text-[#e6ecf7]",
        "rounded-full",
        "shadow-button-primary",
        "hover:bg-[#002662]",
        "hover:border-[#002662]",
        "hover:shadow-button-primary-hover",
        "hover:scale-[1.02]",
        "active:scale-[0.98]",
        "transition-all",
        "duration-300",
        "font-medium",
        "text-sm",
        "disabled:opacity-60",
        "disabled:cursor-not-allowed",
      ],
      bindings: {
        visible: "true", // Always show, but can be disabled via attributes
      },
      children: ["Add"],
    },
  ],
};

