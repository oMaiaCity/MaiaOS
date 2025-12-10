/**
 * Vibes Skills - Skill functions for vibe selection
 */

import type { Skill } from "./types";
import type { Data } from "../dataStore";

const selectVibeSkill: Skill = {
  metadata: {
    id: "@vibes/selectVibe",
    name: "Select Vibe",
    description: "Selects a vibe by ID",
    category: "vibes",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The vibe ID to select",
          required: true,
        },
      },
      required: ["id"],
    },
  },
  execute: (data: Data, payload?: unknown) => {
    const id = (payload as { id?: string })?.id;
    if (id) {
      data.selectedVibeId = id;
    }
  },
};

export const vibesSkills: Record<string, Skill> = {
  "@vibes/selectVibe": selectVibeSkill,
};
