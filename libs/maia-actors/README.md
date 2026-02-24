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
const actor = getActor('maia/actor/os/db');
// Returns: { definition: {...}, function: execute(...) }

// Get all actor definitions
const definitions = getAllActorDefinitions();
```

## Structure

```
src/
├── index.js          # Main entry point (actor registry)
├── seed-config.js    # Genesis seed config (actors, processes, tools)
├── shared/           # Shared utilities (api-helpers)
├── os/               # OS service actors (@maia/actor/os/*)
│   ├── ai/           # LLM chat (actor, process, tool, function)
│   ├── names/        # Compute message names
│   ├── db/           # Database operations
│   ├── spark/        # Spark CRUD
│   └── paper/        # Update paper content
└── library/         # Standalone UI actors
    └── comingSoon/   # Coming soon placeholder view
```

## API

### `getActor(namespacePath)`

Get an actor by its namespace path (e.g., `"maia/actor/os/db"`).

Returns: `{ definition: Object, function: Function }` or `null`

### `getAllActorDefinitions()`

Get all actor definitions (useful for seeding, LLM tools).

Returns: `Object` mapping namespace paths to actor definitions

## License

MIT
