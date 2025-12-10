/**
 * Root Composite Configuration
 * Grid layout showing available vibes
 */

import type { CompositeConfig } from "../../../compositor/view/types";
import { vibeGridComposite } from "./vibeGrid";

export const rootComposite: CompositeConfig = {
  type: "stack",
  container: {
    class: "h-full flex flex-col max-w-4xl mx-auto",
    padding: "1.5rem",
    borderRadius: "1.5rem",
    background: "rgb(248 250 252)",
    border: "1px solid white",
  },
  height: "100%",
  children: [
    {
      slot: "header",
      composite: {
        type: "flex",
        flex: {
          direction: "row",
          justify: "space-between",
          align: "center",
        },
        container: {
          padding: "0 0 1.5rem 0",
        },
        children: [
          {
            slot: "title",
            leaf: {
              tag: "h1",
              classes: ["text-3xl", "font-bold", "text-slate-900"],
              children: ["Vibes"],
            },
          },
        ],
      },
    },
    {
      slot: "grid",
      flex: {
        grow: 1,
        shrink: 1,
        basis: "0",
      },
      overflow: "auto",
      composite: vibeGridComposite,
    },
  ],
};
