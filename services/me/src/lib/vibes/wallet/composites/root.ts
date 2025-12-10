/**
 * Root Composite Configuration
 * Main container for the wallet interface
 */

import type { CompositeConfig } from "../../../compositor/view/types";
import { balanceComposite } from "./balance";
import { transactionListComposite } from "./transactionList";
import { footerComposite } from "./footer";
import { backdropLeaf } from "../leafs";

export const rootComposite: CompositeConfig = {
    type: "stack",
    container: {
        class: "h-full flex flex-col relative",
        background: "rgb(248 250 252)"
    },
    height: "100%",
    children: [
        // Balance section
        {
            slot: "balance",
            composite: balanceComposite,
        },
        // Transaction list section
        {
            slot: "transactions",
            flex: {
                grow: 1,
                shrink: 1,
                basis: "0",
            },
            overflow: "auto",
            composite: transactionListComposite,
        },
        // Footer with send button
        {
            slot: "footer",
            flex: {
                grow: 0,
                shrink: 0,
            },
            composite: footerComposite,
        },
        // Backdrop blur overlay when form is open
        {
            slot: "backdrop",
            position: {
                type: "absolute",
                top: "0",
                left: "0",
                right: "0",
                bottom: "0",
                zIndex: 1,
            },
            leaf: backdropLeaf,
        },
    ],
};

