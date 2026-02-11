# MaiaOS Documentation for maia-tools

**Auto-generated:** 2026-02-11T14:34:27.281Z
**Purpose:** Complete context for LLM agents working with MaiaOS

---

# README

*Source: developers/README.md*

# maia-tools: Tool Registry and Definitions

## Overview

The `@MaiaOS/tools` package provides a centralized registry for all MaiaScript tools. Think of it as a toolbox where all available tools are stored, organized, and ready to use.

**What it is:**
- ✅ **Tool registry** - Central catalog of all available tools
- ✅ **Tool definitions** - JSON schema definitions for each tool
- ✅ **Tool implementations** - JavaScript functions that execute tools

**What it isn't:**
- ❌ **Not the tool engine** - Tool execution is in `maia-script` (ToolEngine)
- ❌ **Not tool registration** - Tools are registered by modules in `maia-script`
- ❌ **Not business logic** - Tools are generic, reusable operations

---

## The Simple Version

Think of `maia-tools` like a hardware store:

- **Tool Registry** = The catalog (lists all available tools)
- **Tool Definition** = The instruction manual (what the tool does, what it needs)
- **Tool Function** = The actual tool (the thing that does the work)

**Analogy:**
Imagine you're building a house:
- Tool definitions are like product descriptions (what each tool does)
- Tool functions are like the actual tools (hammer, saw, drill)
- The registry is like the store's inventory system (knows where everything is)

---

## Package Structure

```
libs/maia-tools/src/
├── index.js                    # Main exports (registry, getTool, etc.)
├── core/                       # Core UI tools
│   ├── noop.tool.maia         # Tool definition (JSON schema)
│   ├── noop.tool.js           # Tool implementation (function)
│   ├── publishMessage.tool.maia
│   ├── publishMessage.tool.js
│   └── computeMessageNames.tool.maia
│   └── computeMessageNames.tool.js
├── db/                         # Database tools (deprecated - use @db unified API)
│   ├── db.tool.maia
│   └── db.tool.js
├── memory/                     # Memory tools
│   ├── memory.tool.maia
│   └── memory.tool.js
└── agent/                      # Agent tools
    ├── agent.tool.maia
    └── agent.tool.js
```

---

## Key Components

### 1. Tool Registry

Central registry that maps namespace paths to tool definitions and functions.

**What it does:**
- Imports all tool definitions as JSON modules
- Imports all tool functions as JavaScript modules
- Provides lookup functions (`getTool`, `getToolsByNamespace`)

**Structure:**
```javascript
export const TOOLS = {
  'core/noop': { 
    definition: noopDef,    // JSON schema definition
    function: noopFn        // JavaScript function
  },
  'core/publishMessage': { 
    definition: publishMessageDef,
    function: publishMessageFn
  },
  // ... more tools
};
```

**See:** `libs/maia-tools/src/index.js`

### 2. Tool Definition

JSON schema that describes what a tool does and what parameters it needs.

**Structure:**
```json
{
  "$schema": "@schema/tool",
  "$id": "tool_noop_001",
  "name": "@core/noop",
  "description": "No-op tool that does nothing",
  "parameters": {
    "type": "object",
    "properties": {
      "message": {
        "type": "string",
        "description": "Optional message to log"
      }
    }
  }
}
```

**Fields:**
- `$schema` - Schema reference (`@schema/tool`)
- `$id` - Unique tool identifier
- `name` - Tool namespace path (`@core/noop`)
- `description` - What the tool does
- `parameters` - JSON Schema for tool parameters

**See:** `libs/maia-tools/src/core/noop.tool.maia`

### 3. Tool Function

JavaScript function that executes the tool logic.

**Structure:**
```javascript
export default {
  async execute(actor, payload) {
    // Tool logic here
    // actor: Actor instance (has context, state, etc.)
    // payload: Validated payload (matches tool definition parameters)
    return result;
  }
};
```

**Parameters:**
- `actor` - Actor instance executing the tool
- `payload` - Validated payload matching tool definition parameters

**See:** `libs/maia-tools/src/core/noop.tool.js`

---

## How It Works

### The Tool Execution Flow

```
1. State Machine Calls Tool
   └─> { tool: "@core/publishMessage", payload: {...} }

2. ToolEngine Looks Up Tool
   └─> getTool("@core/publishMessage")
   └─> Returns { definition, function }

3. ToolEngine Validates Payload
   └─> Validates payload against tool definition parameters
   └─> Throws error if invalid

4. ToolEngine Executes Tool
   └─> tool.function.execute(actor, payload)
   └─> Returns result

5. Result Used in State Machine
   └─> Result available as $$result in expressions
   └─> Can be used in updateContext or other actions
```

### The Registration Flow

```
1. Module Registers Tools
   └─> Module calls toolEngine.registerTool()
   └─> Gets tool from registry: getTool("core/noop")
   └─> Registers with namespace: "@core/noop"

2. Tool Available in State Machines
   └─> Can be called via { tool: "@core/noop", payload: {...} }
   └─> ToolEngine validates and executes
```

---

## Common Patterns

### Getting a Tool

```javascript
import { getTool } from '@MaiaOS/tools';

const tool = getTool('core/noop');
// Returns: { definition: {...}, function: execute(...) }
```

### Getting All Tools in a Namespace

```javascript
import { getToolsByNamespace } from '@MaiaOS/tools';

const coreTools = getToolsByNamespace('core');
// Returns: { 'core/noop': {...}, 'core/publishMessage': {...} }
```

### Getting All Tool Definitions

```javascript
import { getAllToolDefinitions } from '@MaiaOS/tools';

const definitions = getAllToolDefinitions();
// Returns: { 'core/noop': {...}, 'core/publishMessage': {...}, ... }
// Useful for seeding tools into database
```

---

## Available Tools

### Core Tools

**`@core/noop`**
- Does nothing (useful for testing)
- Parameters: `{ message?: string }`

**`@core/publishMessage`**
- Publishes a message to a target actor
- Parameters: `{ type: string, payload: object, target: string }`
- **Note:** Topics infrastructure removed - use direct messaging with `target` parameter

**`@core/computeMessageNames`**
- Computes message names from context
- Parameters: `{ context: object }`

### Memory Tools

**`@memory/memory`**
- Manages actor memory (conversation history, etc.)
- Parameters: `{ operation: string, ... }`

### AI Tools

**`@ai/chat`**
- Unified AI chat tool using OpenAI-compatible API (RedPill)
- Parameters: `{ context: Array<Message>, model?: string, temperature?: number }`
- **Note:** LLMs are stateless - each request sends full context

### Database Tools

**`@db/*`** (Deprecated)
- Database tools have been replaced by the unified `@db` API
- Use `maia.db({ op: 'read', ... })` instead
- See: [maia-script DBEngine](../04_maia-script/engines.md#dbengine)

---

## Creating a New Tool

### Step 1: Create Tool Definition

**`src/my-namespace/myTool.tool.maia`:**
```json
{
  "$schema": "@schema/tool",
  "$id": "tool_mytool_001",
  "name": "@my-namespace/myTool",
  "description": "What my tool does",
  "parameters": {
    "type": "object",
    "properties": {
      "input": {
        "type": "string",
        "description": "Input parameter"
      }
    },
    "required": ["input"]
  }
}
```

### Step 2: Create Tool Function

**`src/my-namespace/myTool.tool.js`:**
```javascript
export default {
  async execute(actor, payload) {
    const { input } = payload;
    
    // Tool logic here
    const result = `Processed: ${input}`;
    
    return result;
  }
};
```

### Step 3: Register Tool in Index

**`src/index.js`:**
```javascript
import myToolDef from './my-namespace/myTool.tool.maia';
import myToolFn from './my-namespace/myTool.tool.js';

export const TOOLS = {
  // ... existing tools
  'my-namespace/myTool': { 
    definition: myToolDef, 
    function: myToolFn 
  },
};
```

### Step 4: Register Tool in Module

**`libs/maia-script/src/modules/my-namespace.module.js`:**
```javascript
import { getTool } from '@MaiaOS/tools';

export async function register(registry) {
  const tool = getTool('my-namespace/myTool');
  if (tool) {
    await registry._getToolEngine('my-namespace').registerTool(
      'my-namespace/myTool',
      '@my-namespace/myTool',
      {
        definition: tool.definition,
        function: tool.function
      }
    );
  }
}
```

---

## Integration Points

### With maia-script

The `maia-script` package uses tools for:
- Tool execution via ToolEngine
- Tool registration via modules
- Tool validation against definitions

**See:** `libs/maia-script/src/engines/tool.engine.js`

### With maia-schemata

The `maia-schemata` package uses tools for:
- Validating tool definitions against `@schema/tool` schema
- Validating tool parameters against tool definition parameters

**See:** `libs/maia-schemata/src/os/tool.schema.json`

---

## Key Concepts

### Tool Namespaces

Tools are organized by namespace:

- `core/` - Core UI tools (noop, publishMessage, etc.)
- `memory/` - Memory management tools
- `agent/` - Agent/LLM interaction tools
- `db/` - Database tools (deprecated, use `@db` unified API)

### Tool Execution Context

When a tool executes, it receives:

- **`actor`** - Actor instance executing the tool
  - `actor.id` - Actor ID
  - `actor.context` - Actor context (read-only)
  - `actor.actorEngine` - ActorEngine reference (for sending messages, etc.)
  - `actor.dbEngine` - DBEngine reference (for data operations)

- **`payload`** - Validated payload matching tool definition parameters

### Tool Results

Tool results are available in state machines as `$$result`:

```json
{
  "tool": "@core/publishMessage",
  "payload": { "type": "CLICK", "target": "@actor/button" }
},
{
  "updateContext": {
    "lastMessage": "$$result"
  }
}
```

---

## Troubleshooting

### Problem: "Tool not found"

**Solution:** Make sure tool is registered in module:
```javascript
// In module registration
const tool = getTool('my-namespace/myTool');
await toolEngine.registerTool('my-namespace/myTool', '@my-namespace/myTool', tool);
```

### Problem: "Tool parameter validation failed"

**Solution:** Check tool definition parameters match payload:
```json
// Tool definition
{
  "parameters": {
    "properties": {
      "input": { "type": "string" }
    },
    "required": ["input"]
  }
}

// Payload must match
{
  "input": "value"  // Required, must be string
}
```

### Problem: "Tool execution failed"

**Solution:** Check tool function implementation:
```javascript
export default {
  async execute(actor, payload) {
    // Make sure to handle errors
    try {
      // Tool logic
      return result;
    } catch (error) {
      console.error('[MyTool] Error:', error);
      throw error; // Re-throw to surface error
    }
  }
};
```

---

## Related Documentation

- [maia-script: ToolEngine](../04_maia-script/engines.md#toolengine) - How tools are executed
- [maia-script: Modules](../04_maia-script/modules.md) - How tools are registered
- [Creator Docs: Tools](../../02_creators/06-tools.md) - How to use tools as a creator

---

## Source Files

- Main entry: `libs/maia-tools/src/index.js`
- Core tools: `libs/maia-tools/src/core/`
- Memory tools: `libs/maia-tools/src/memory/`
- Agent tools: `libs/maia-tools/src/agent/`
- Database tools: `libs/maia-tools/src/db/` (deprecated)

---

