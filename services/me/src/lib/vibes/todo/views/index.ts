/**
 * View Configuration
 * Main view that combines root composite and modal leaf
 */

import type { ViewConfig } from "../../../compositor/view/types";
import { rootComposite } from "../composites";
import { modalLeaf } from "../leafs";

export const todoView: ViewConfig = {
    composite: {
        ...rootComposite,
        children: [
            ...rootComposite.children,
            // Modal Leaf - Popup modal for todo details
            {
                slot: "modal",
                leaf: modalLeaf,
            },
        ],
    },
};

