/**
 * Transaction List Composite Configuration
 */

import type { CompositeConfig } from "../../../compositor/view/types";
import { transactionListLeaf } from "../leafs";

export const transactionListComposite: CompositeConfig = {
  type: "stack",
  container: {
    padding: "1.5rem 0",
  },
  children: [
    {
      slot: "title",
      leaf: {
        tag: "h2",
        classes: ["text-xl", "font-bold", "text-slate-900", "mb-4", "px-4"],
        children: ["Recent Transactions"],
      },
    },
    {
      slot: "list",
      leaf: transactionListLeaf,
    },
  ],
};

