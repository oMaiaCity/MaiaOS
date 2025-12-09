/**
 * Content Composite Configuration
 * Conditionally renders different views based on viewMode
 */

import type { CompositeConfig } from "../../../compositor/view/types";
import { todoListLeaf, kanbanViewLeaf, timelineViewLeaf } from "../leafs";

export const contentComposite: CompositeConfig = {
    type: "stack",
    container: {
        padding: "1.5rem 0 0 0",
    },
    children: [
        // List view
        {
            slot: "list",
            leaf: {
                ...todoListLeaf,
                bindings: {
                    ...todoListLeaf.bindings,
                    visible: "data.viewMode === 'list'",
                },
            },
            flex: {
                grow: 1,
                shrink: 1,
                basis: "0",
            },
            overflow: "auto",
        },
        // Kanban view
        {
            slot: "kanban",
            leaf: {
                ...kanbanViewLeaf,
                bindings: {
                    ...kanbanViewLeaf.bindings,
                    visible: "data.viewMode === 'kanban'",
                },
            },
            flex: {
                grow: 1,
                shrink: 1,
                basis: "0",
            },
            overflow: "auto",
        },
        // Timeline view
        {
            slot: "timeline",
            leaf: {
                ...timelineViewLeaf,
                bindings: {
                    ...timelineViewLeaf.bindings,
                    visible: "data.viewMode === 'timeline'",
                },
            },
            flex: {
                grow: 1,
                shrink: 1,
                basis: "0",
            },
            overflow: "auto",
        },
    ],
};

