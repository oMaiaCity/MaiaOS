/**
 * Root Composite Configuration
 * Main container that holds all sections
 */

import type { CompositeConfig } from "../../../view/types";
import { headerComposite } from "./header";
import { inputSectionComposite } from "./inputSection";
import { contentComposite } from "./content";

export const rootComposite: CompositeConfig = {
  type: "stack", // Stack layout (flex column)
  container: {
    class: "h-full flex flex-col",
    padding: "1.5rem",
    borderRadius: "1.5rem",
    background: "rgb(248 250 252)", // slate-50
    border: "1px solid white",
  },
  height: "calc(100vh - 5rem)", // Full height minus padding
  children: [
    // Header Composite - Fixed header containing title, description, viewToggle
    {
      slot: "header",
      position: {
        type: "sticky",
        top: "0",
        zIndex: 10,
      },
      size: {
        height: "auto",
        minHeight: "120px",
      },
      composite: headerComposite,
    },
    // Input Section Composite - Fixed input section containing input and error
    {
      slot: "inputSection",
      position: {
        type: "sticky",
        top: "0",
        zIndex: 9,
      },
      size: {
        height: "auto",
      },
      composite: inputSectionComposite,
    },
    // Content Composite - Scrollable content area containing list
    {
      slot: "content",
      flex: {
        grow: 1,
        shrink: 1,
        basis: "0",
      },
      overflow: "auto",
      composite: contentComposite,
    },
  ],
};

