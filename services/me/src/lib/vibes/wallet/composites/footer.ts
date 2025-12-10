/**
 * Footer Composite Configuration
 */

import type { CompositeConfig } from "../../../compositor/view/types";
import { sendButtonLeaf, sendFormLeaf } from "../leafs";

export const footerComposite: CompositeConfig = {
  type: "stack",
  container: {
    padding: "1.5rem 0 0 0",
    class: "relative",
  },
  children: [
    {
      slot: "sendForm",
      position: {
        type: "relative",
        zIndex: 2,
      },
      leaf: sendFormLeaf,
    },
    {
      slot: "sendButton",
      position: {
        type: "sticky",
        bottom: "0",
        zIndex: 10,
      },
      leaf: sendButtonLeaf,
    },
  ],
};

