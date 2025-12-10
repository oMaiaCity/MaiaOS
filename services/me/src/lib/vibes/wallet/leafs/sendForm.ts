/**
 * Send Money Form Leaf Component (Collapsible)
 * Replaces the modal with a collapsible section above the send button
 */

import type { LeafNode } from "../../../compositor/view/leaf-types";

// Recipient button leaf - selected state
const recipientButtonSelectedLeaf: LeafNode = {
  tag: "button",
  attributes: { type: "button" },
  classes: [
    "w-full",
    "px-4",
    "py-3",
    "rounded-xl",
    "border-2",
    "border-[#001a42]",
    "bg-blue-50",
    "hover:border-[#002662]",
    "hover:bg-blue-100",
    "transition-all",
    "text-left",
    "flex",
    "items-center",
    "justify-between",
  ],
  bindings: {
    visible: "data.selectedRecipient && data.selectedRecipient.id === item.id",
  },
  events: {
    click: {
      event: "SELECT_RECIPIENT",
      payload: "item.id",
    },
  },
  children: [
    {
      tag: "div",
      classes: ["flex", "flex-col", "gap-1", "pointer-events-none"],
      children: [
        {
          tag: "div",
          classes: ["font-semibold", "text-slate-900"],
          bindings: {
            text: "item.name",
          },
        },
        {
          tag: "div",
          classes: ["text-xs", "text-slate-500"],
          bindings: {
            text: "item.iban",
          },
        },
      ],
    },
    {
      tag: "icon",
      icon: {
        name: "solar:check-circle-bold",
        classes: ["w-5", "h-5", "text-[#001a42]", "pointer-events-none"],
      },
    },
  ],
};

// Recipient button leaf - unselected state
const recipientButtonUnselectedLeaf: LeafNode = {
  tag: "button",
  attributes: { type: "button" },
  classes: [
    "w-full",
    "px-4",
    "py-3",
    "rounded-xl",
    "border-2",
    "border-slate-200",
    "bg-white",
    "hover:border-[#001a42]",
    "hover:bg-blue-50",
    "transition-all",
    "text-left",
    "flex",
    "items-center",
    "justify-between",
  ],
  bindings: {
    visible: "!data.selectedRecipient || data.selectedRecipient.id !== item.id",
  },
  events: {
    click: {
      event: "SELECT_RECIPIENT",
      payload: "item.id",
    },
  },
  children: [
    {
      tag: "div",
      classes: ["flex", "flex-col", "gap-1", "pointer-events-none"],
      children: [
        {
          tag: "div",
          classes: ["font-semibold", "text-slate-900"],
          bindings: {
            text: "item.name",
          },
        },
        {
          tag: "div",
          classes: ["text-xs", "text-slate-500"],
          bindings: {
            text: "item.iban",
          },
        },
      ],
    },
  ],
};

// Combined recipient button wrapper
const recipientButtonLeaf: LeafNode = {
  tag: "div",
  classes: ["relative"],
  children: [
    recipientButtonSelectedLeaf,
    recipientButtonUnselectedLeaf,
  ],
};

export const sendFormLeaf: LeafNode = {
  tag: "div",
  classes: [
    "bg-white",
    "rounded-2xl",
    "border",
    "border-slate-200",
    "shadow-lg",
    "overflow-hidden",
    "transition-all",
    "duration-300",
    "relative",
    "z-[2]",
  ],
  bindings: {
    visible: "data.showSendModal",
  },
  children: [
    // Form content
    {
      tag: "div",
      classes: ["p-6", "flex", "flex-col", "gap-6"],
      children: [
        // Recipients list
        {
          tag: "div",
          classes: ["flex", "flex-col", "gap-2"],
          children: [
            {
              tag: "h3",
              classes: ["text-sm", "font-semibold", "text-slate-700", "mb-2"],
              children: ["Select Recipient"],
            },
            {
              tag: "div",
              classes: ["flex", "flex-col", "gap-2"],
              bindings: {
                foreach: {
                  items: "data.recipients",
                  key: "id",
                  leaf: recipientButtonLeaf,
                },
              },
            },
          ],
        },
        // Amount input
        {
          tag: "div",
          classes: ["flex", "flex-col", "gap-2"],
          children: [
            {
              tag: "label",
              classes: ["text-sm", "font-semibold", "text-slate-700"],
              children: ["Amount"],
            },
            {
              tag: "div",
              classes: ["relative"],
              children: [
                {
                  tag: "span",
                  classes: [
                    "absolute",
                    "left-4",
                    "top-1/2",
                    "-translate-y-1/2",
                    "text-slate-500",
                    "font-medium",
                  ],
                  children: [
                    {
                      tag: "span",
                      bindings: {
                        text: "data.currency",
                      },
                    },
                  ],
                },
                {
                  tag: "input",
                  attributes: {
                    type: "number",
                    placeholder: "0.00",
                    step: "0.01",
                    min: "0.01",
                  },
                  classes: [
                    "w-full",
                    "pl-12",
                    "pr-4",
                    "py-3",
                    "border",
                    "border-slate-300",
                    "rounded-xl",
                    "focus:outline-none",
                    "focus:ring-2",
                    "focus:ring-[#001a42]",
                    "focus:border-transparent",
                    "text-slate-900",
                    "bg-white",
                  ],
                  // NO bindings.value - let the input event handler manage the value
                  // This prevents the controlled input issue where Svelte resets the value
                  events: {
                    input: {
                      event: "UPDATE_SEND_AMOUNT",
                      payload: { amount: "" }, // Will be replaced with actual value
                    },
                  },
                },
              ],
            },
          ],
        },
        // Description input (optional)
        {
          tag: "div",
          classes: ["flex", "flex-col", "gap-2"],
          children: [
            {
              tag: "label",
              classes: ["text-sm", "font-semibold", "text-slate-700"],
              children: ["Description (optional)"],
            },
            {
              tag: "input",
              attributes: {
                type: "text",
                placeholder: "Add a note...",
              },
              classes: [
                "w-full",
                "px-4",
                "py-3",
                "border",
                "border-slate-300",
                "rounded-xl",
                "focus:outline-none",
                "focus:ring-2",
                "focus:ring-[#001a42]",
                "focus:border-transparent",
                "text-slate-900",
                "bg-white",
              ],
              // NO bindings.value - let the input event handler manage the value
              // This prevents the controlled input issue where Svelte resets the value
              events: {
                input: {
                  event: "UPDATE_SEND_DESCRIPTION",
                },
              },
            },
          ],
        },
        // Error message
        {
          tag: "div",
          classes: ["text-red-500", "text-sm"],
          bindings: {
            visible: "data.error !== null",
            text: "data.error",
          },
        },
        // Send button - Always visible, disabled when conditions not met
        {
          tag: "button",
          attributes: { 
            type: "button",
          },
          bindings: {
            disabled: "!selectedRecipient || !sendAmount || sendAmount === '' || sendAmount === 0 || (typeof sendAmount === 'number' && sendAmount <= 0) || (typeof sendAmount === 'string' && (sendAmount.trim() === '' || Number(sendAmount) <= 0 || isNaN(Number(sendAmount))))",
          },
          classes: [
            "w-full",
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
            "disabled:hover:bg-[#001a42]",
            "disabled:hover:border-[#001a42]",
            "disabled:hover:shadow-button-primary",
            "disabled:hover:scale-100",
          ],
          events: {
            click: {
              event: "SEND_MONEY",
            },
          },
          children: [
            {
              tag: "span",
              classes: ["pointer-events-none"],
              children: ["Send Money"],
            },
          ],
        },
      ],
    },
  ],
};

