# @MaiaOS/actors

MaiaOS actors package - centralized registry for all actor definitions and functions.

## Overview

This package contains all actor definitions and implementations for MaiaOS. Actors are organized by namespace (core, db, ai, sparks) and provide reusable functionality for MaiaScript expressions.

## Installation

```bash
# In workspace package
"dependencies": {
  "@MaiaOS/actors": "workspace:*"
}
```

## Usage

```javascript
import { getActor, getAllActorDefinitions } from '@MaiaOS/actors';

// Get an actor by namespace path
const actor = getActor('db/db');
// Returns: { definition: {...}, function: execute(...) }

// Get all actor definitions
const definitions = getAllActorDefinitions();
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

### `getActor(namespacePath)`

Get an actor by its namespace path (e.g., `"db/db"`).

Returns: `{ definition: Object, function: Function }` or `null`

### `getAllActorDefinitions()`

Get all actor definitions (useful for seeding, LLM tools).

Returns: `Object` mapping namespace paths to actor definitions

## License

MIT
