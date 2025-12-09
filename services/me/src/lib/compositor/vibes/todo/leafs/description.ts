/**
 * Description Leaf Component
 */

import type { LeafNode } from "../../../view/leaf-types";

export const descriptionLeaf: LeafNode = {
  tag: "div",
  classes: ["text-center", "mb-4"],
  children: [
    {
      tag: "p",
      classes: ["text-slate-600"],
      bindings: { text: "data.description" },
    },
  ],
};

