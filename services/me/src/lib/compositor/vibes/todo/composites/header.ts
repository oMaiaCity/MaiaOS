/**
 * Header Composite Configuration
 */

import type { CompositeConfig } from "../../../view/types";
import { titleLeaf, descriptionLeaf } from "../leafs";
import {
    viewButtonList,
    viewButtonKanban,
    viewButtonTimeline,
    viewButtonConfig,
} from "../leafs/viewButtons";

export const headerComposite: CompositeConfig = {
    type: "stack",
    container: {
        padding: "0",
        background: "transparent",
    },
    children: [
        {
            slot: "title",
            leaf: titleLeaf,
            size: {
                height: "auto",
            },
        },
        {
            slot: "description",
            leaf: descriptionLeaf,
            size: {
                height: "auto",
            },
        },
        {
            slot: "viewButtons",
            composite: {
                type: "flex",
                flex: {
                    direction: "row",
                    justify: "center",
                    align: "center",
                    gap: "0.5rem",
                    wrap: "nowrap",
                },
                container: {
                    padding: "0 0 1rem 0",
                },
                children: [
                    {
                        slot: "viewButton.list",
                        leaf: viewButtonList,
                    },
                    {
                        slot: "viewButton.kanban",
                        leaf: viewButtonKanban,
                    },
                    {
                        slot: "viewButton.timeline",
                        leaf: viewButtonTimeline,
                    },
                    {
                        slot: "viewButton.config",
                        leaf: viewButtonConfig,
                    },
                ],
            },
        },
    ],
};

