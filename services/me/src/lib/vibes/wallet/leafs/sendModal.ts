/**
 * Send Money Modal Leaf Component
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
    "border-blue-500",
    "bg-blue-50",
    "hover:border-blue-600",
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
      classes: ["flex", "flex-col", "gap-1"],
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
        classes: ["w-5", "h-5", "text-blue-500", "pointer-events-none"],
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
    "hover:border-blue-500",
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

export const sendModalLeaf: LeafNode = {
  tag: "div",
  classes: [
    "fixed",
    "inset-0",
    "bg-black",
    "bg-black",
    "bg-opacity-50",
    "flex",
    "items-center",
    "justify-center",
    "z-50",
    "p-4",
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
        tag: "div",
        classes: [
          "bg-white",
          "rounded-3xl",
          "shadow-2xl",
          "max-w-md",
          "w-full",
          "max-h-[90vh]",
          "overflow-y-auto",
          "flex",
          "flex-col",
        ],
        // No click event - LeafRenderer will stop propagation automatically
        children: [
        // Modal header
        {
          tag: "div",
          classes: [
            "flex",
            "items-center",
            "justify-between",
            "p-6",
            "border-b",
            "border-slate-200",
          ],
          children: [
            {
              tag: "h2",
              classes: ["text-2xl", "font-bold", "text-slate-900"],
              children: ["Send Money"],
            },
            {
              tag: "button",
              attributes: { type: "button" },
              classes: [
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
                  event: "CLOSE_SEND_MODAL",
                },
              },
              children: [
                {
                  tag: "icon",
                  icon: {
                    name: "mingcute:close-line",
                    classes: ["w-5", "h-5", "text-slate-600", "pointer-events-none"],
                  },
                },
              ],
            },
          ],
        },
        // Modal content
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
                        "focus:ring-blue-500",
                        "focus:border-transparent",
                        "text-slate-900",
                        "bg-white",
                      ],
                      bindings: {
                        value: "data.sendAmount",
                      },
                      events: {
                        input: {
                          event: "UPDATE_SEND_AMOUNT",
                          payload: "data.sendAmount",
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
                    "focus:ring-blue-500",
                    "focus:border-transparent",
                    "text-slate-900",
                    "bg-white",
                  ],
                  bindings: {
                    value: "data.sendDescription",
                  },
                  events: {
                    input: {
                      event: "UPDATE_SEND_DESCRIPTION",
                      payload: "data.sendDescription",
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
                disabled: "data.selectedRecipient === null || !data.sendAmount || String(data.sendAmount).trim().length === 0",
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
                  children: ["Send Money"],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

