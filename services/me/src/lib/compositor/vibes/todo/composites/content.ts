/**
 * Content Composite Configuration
 */

import type { CompositeConfig } from "../../../view/types";
import { todoListLeaf } from "../leafs";

export const contentComposite: CompositeConfig = {
    type: "stack",
    container: {
        padding: "1.5rem 0 0 0",
    },
    children: [
        {
            slot: "list",
            leaf: todoListLeaf,
            flex: {
                grow: 1,
                shrink: 1,
                basis: "0",
            },
            overflow: "auto",
        },
    ],
};

