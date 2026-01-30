# @MaiaOS/tools

MaiaOS tools package - centralized registry for all MaiaScript tools.

## Overview

This package contains all tool definitions and implementations for MaiaOS. Tools are organized by namespace (core, db, dragdrop, context) and provide reusable functionality for MaiaScript expressions.

## Installation

```bash
# In workspace package
"dependencies": {
  "@MaiaOS/tools": "workspace:*"
}
```

## Usage

```javascript
import { getTool, getAllToolDefinitions } from '@MaiaOS/tools';

// Get a specific tool
const tool = getTool('core/noop');
// Returns: { definition: {...}, function: execute(...) }

// Get all tool definitions
const definitions = getAllToolDefinitions();
```

## Structure

```
src/
├── index.js          # Main entry point (tool registry)
├── core/             # Core UI tools (noop, publishMessage, etc.)
├── db/               # Database tools
├── dragdrop/         # Drag and drop tools
└── context/          # Context update tools
```

## API

### `getTool(namespacePath)`

Get a tool by its namespace path (e.g., `"core/noop"`).

Returns: `{ definition: Object, function: Function }` or `null`

### `getToolsByNamespace(namespace)`

Get all tools for a given namespace (e.g., `"core"`).

Returns: `Object` mapping namespace paths to tools

### `getAllToolDefinitions()`

Get all tool definitions (useful for seeding into database).

Returns: `Object` mapping namespace paths to tool definitions

## License

MIT
