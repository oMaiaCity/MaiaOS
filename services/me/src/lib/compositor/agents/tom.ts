/**
 * Agent @Tom Configuration
 * Agent with access to todo skills
 */

import type { AgentConfig } from "./types";

export const tomAgentConfig: AgentConfig = {
    id: "@Tom",
    name: "Tom",
    description: "Agent with access to todo management skills",
    skills: [
        "@todo/validateTodo",
        "@todo/addTodo",
        "@todo/toggleTodo",
        "@todo/removeTodo",
        "@ui/updateInput",
        "@ui/clearInput",
    ],
    config: {
        // Agent-specific configuration can go here
    },
};

