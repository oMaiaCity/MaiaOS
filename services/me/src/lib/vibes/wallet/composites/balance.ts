/**
 * Balance Composite Configuration
 */

import type { CompositeConfig } from "../../../compositor/view/types";
import { balanceLeaf } from "../leafs";

export const balanceComposite: CompositeConfig = {
  type: "stack",
  container: {
    padding: "0",
  },
  children: [
    {
      slot: "balance",
      leaf: balanceLeaf,
    },
  ],
};









