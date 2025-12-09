/**
 * Input Section Composite Configuration
 */

import type { CompositeConfig } from "../../../view/types";
import { inputFormLeaf, errorLeaf } from "../leafs";

export const inputSectionComposite: CompositeConfig = {
    type: "stack",
    container: {
        padding: "1.5rem 0 0 0",
        background: "rgb(248 250 252)", // slate-50 - match container background
    },
    children: [
        {
            slot: "input.value",
            leaf: inputFormLeaf,
            size: {
                height: "auto",
            },
        },
        {
            slot: "error",
            leaf: errorLeaf,
            size: {
                height: "auto",
            },
        },
    ],
};

