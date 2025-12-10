/**
 * Transaction List Leaf Component
 */

import type { LeafNode } from "../../../compositor/view/leaf-types";
import { transactionItemLeaf } from "./transactionItem";

export const transactionListLeaf: LeafNode = {
  tag: "div",
  classes: ["flex", "flex-col", "gap-2"],
  bindings: {
    foreach: {
      items: "data.transactions",
      key: "id",
      leaf: transactionItemLeaf,
    },
  },
};

