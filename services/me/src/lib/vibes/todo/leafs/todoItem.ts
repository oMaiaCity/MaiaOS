/**
 * Todo Item Leaf Component
 */

import type { LeafNode } from "../../../compositor/view/leaf-types";

export const todoItemLeaf: LeafNode = {
  tag: "div",
  classes: [
    "flex",
    "items-center",
    "gap-3",
    "px-4",
    "py-3",
    "rounded-2xl",
    "bg-slate-100",
    "border",
    "border-white",
    "shadow-[0_0_4px_rgba(0,0,0,0.02)]",
  ],
  children: [
    // Unchecked checkbox button
    {
      tag: "button",
      attributes: { type: "button" },
      classes: [
        "w-6",
        "h-6",
        "rounded-full",
        "border-2",
        "flex",
        "items-center",
        "justify-center",
        "transition-all",
        "duration-200",
        "focus:outline-none",
        "focus:ring-2",
        "focus:ring-[#001a42]",
        "focus:ring-offset-1",
        "cursor-pointer",
        "border-slate-300",
        "bg-slate-100",
        "hover:border-slate-400",
        "hover:bg-slate-200",
      ],
      bindings: {
        visible: "item.status !== 'done'",
      },
      events: {
        click: {
          event: "TOGGLE_TODO",
          payload: "item.id",
        },
      },
      children: [
        {
          tag: "icon",
          icon: {
            name: "solar:circle-bold",
            classes: ["w-4", "h-4", "text-slate-600", "pointer-events-none"],
          },
        },
      ],
    },
    // Checked checkbox button
    {
      tag: "button",
      attributes: { type: "button" },
      classes: [
        "w-6",
        "h-6",
        "rounded-full",
        "border-2",
        "border-green-500",
        "bg-green-100",
        "flex",
        "items-center",
        "justify-center",
        "transition-all",
        "duration-200",
        "hover:border-green-600",
        "hover:bg-green-200",
        "focus:outline-none",
        "focus:ring-2",
        "focus:ring-[#001a42]",
        "focus:ring-offset-1",
        "cursor-pointer",
        "relative",
      ],
      bindings: {
        visible: "item.status === 'done'",
      },
      events: {
        click: {
          event: "TOGGLE_TODO",
          payload: "item.id",
        },
      },
      children: [
        {
          tag: "icon",
          icon: {
            name: "mingcute:check-2-line",
            classes: ["w-4", "h-4", "text-green-500", "pointer-events-none"],
          },
        },
      ],
    },
    // Todo text for done status
    {
      tag: "span",
      classes: [
        "flex-1",
        "text-sm",
        "font-medium",
        "transition-all",
        "duration-200",
        "line-through",
        "text-slate-400",
      ],
      bindings: {
        text: "item.text",
        visible: "item.status === 'done'",
      },
    },
    // Todo text for todo status
    {
      tag: "span",
      classes: [
        "flex-1",
        "text-sm",
        "text-slate-700",
        "font-medium",
        "transition-all",
        "duration-200",
      ],
      bindings: {
        text: "item.text",
        visible: "item.status !== 'done'",
      },
    },
    // Done badge
    {
      tag: "span",
      classes: [
        "px-2",
        "py-0.5",
        "text-xs",
        "font-medium",
        "rounded-full",
        "border",
        "border-white",
        "shrink-0",
        "bg-green-100",
        "text-green-700",
      ],
      bindings: {
        visible: "item.status === 'done'",
      },
      children: ["done"],
    },
    // Todo badge
    {
      tag: "span",
      classes: [
        "px-2",
        "py-0.5",
        "text-xs",
        "font-medium",
        "rounded-full",
        "border",
        "border-white",
        "shrink-0",
        "bg-slate-100",
        "text-slate-700",
      ],
      bindings: {
        visible: "item.status === 'todo'",
      },
      children: ["todo"],
    },
    // In-progress badge
    {
      tag: "span",
      classes: [
        "px-2",
        "py-0.5",
        "text-xs",
        "font-medium",
        "rounded-full",
        "border",
        "border-white",
        "shrink-0",
        "bg-blue-100",
        "text-blue-700",
      ],
      bindings: {
        visible: "item.status === 'in-progress'",
      },
      children: ["in-progress"],
    },
    // Detail button
    {
      tag: "button",
      attributes: { type: "button" },
      classes: [
        "px-2",
        "py-1",
        "text-xs",
        "text-slate-700",
        "bg-slate-200",
        "hover:text-slate-900",
        "hover:bg-slate-300",
        "rounded-full",
        "transition-all",
      ],
      events: {
        click: {
          event: "OPEN_MODAL",
          payload: "item.id",
        },
      },
      children: ["Detail"],
    },
    // Delete button
    {
      tag: "button",
      attributes: { type: "button" },
      classes: [
        "px-2",
        "py-1",
        "text-sm",
        "text-slate-500",
        "hover:text-slate-700",
        "hover:bg-slate-200",
        "rounded-full",
        "transition-all",
        "duration-200",
        "w-6",
        "h-6",
        "flex",
        "items-center",
        "justify-center",
      ],
      events: {
        click: {
          event: "REMOVE_TODO",
          payload: "item.id",
        },
      },
      children: ["✕"],
    },
  ],
};

