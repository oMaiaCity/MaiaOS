/**
 * Send Money Button Leaf Component
 * Toggles between "Send Money" button and close (X) button based on modal state
 */

import type { LeafNode } from "../../../compositor/view/leaf-types";

// Send Money button - shown when modal is closed
const sendButtonOpenLeaf: LeafNode = {
  tag: "button",
  attributes: { type: "button" },
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
    "flex",
    "items-center",
    "justify-center",
    "gap-2",
    "mx-auto",
  ],
  bindings: {
    visible: "!data.showSendModal",
  },
  events: {
    click: {
      event: "OPEN_SEND_MODAL",
    },
  },
  children: [
    {
      tag: "icon",
      icon: {
        name: "solar:wallet-money-bold",
        classes: ["w-5", "h-5", "pointer-events-none"],
      },
    },
    {
      tag: "span",
      classes: ["pointer-events-none"],
      children: ["Send Money"],
    },
  ],
};

// Close button (X icon) - shown when modal is open
const sendButtonCloseLeaf: LeafNode = {
  tag: "button",
  attributes: { type: "button" },
  classes: [
    "w-12",
    "h-12",
    "rounded-full",
    "bg-slate-100",
    "border",
    "border-slate-300",
    "text-slate-700",
    "hover:bg-slate-200",
    "hover:border-slate-400",
    "flex",
    "items-center",
    "justify-center",
    "transition-all",
    "duration-300",
    "mx-auto",
    "relative",
    "z-[3]",
  ],
  bindings: {
    visible: "data.showSendModal",
  },
  events: {
    click: {
      event: "CLOSE_SEND_MODAL",
    },
  },
  children: [
    {
      tag: "icon",
      icon: {
        name: "mingcute:close-line",
        classes: ["w-6", "h-6", "pointer-events-none"],
      },
    },
  ],
};

// Combined button wrapper
export const sendButtonLeaf: LeafNode = {
  tag: "div",
  classes: ["relative"],
  children: [
    sendButtonOpenLeaf,
    sendButtonCloseLeaf,
  ],
};

