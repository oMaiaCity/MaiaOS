/**
 * Balance Leaf Component
 * Displays the current wallet balance
 */

import type { LeafNode } from "../../../compositor/view/leaf-types";

export const balanceLeaf: LeafNode = {
  tag: "div",
  classes: [
    "flex",
    "flex-col",
    "items-center",
    "justify-center",
    "py-8",
    "px-4",
    "bg-[#001a42]",
    "rounded-3xl",
    "shadow-lg",
    "text-[#e6ecf7]",
  ],
  children: [
    {
      tag: "div",
      classes: ["text-sm", "font-medium", "opacity-90", "mb-2"],
      children: ["Total Balance"],
    },
    {
      tag: "div",
      classes: ["text-4xl", "font-bold", "mb-1"],
      children: [
        {
          tag: "span",
          bindings: {
            text: "data.balance",
          },
        },
        {
          tag: "span",
          classes: ["text-2xl", "ml-2", "opacity-90"],
          children: [
            {
              tag: "span",
              bindings: {
                text: "data.currency",
              },
            },
          ],
        },
      ],
    },
    {
      tag: "div",
      classes: ["text-xs", "opacity-75", "mt-2"],
      children: ["Available to spend"],
    },
  ],
};

