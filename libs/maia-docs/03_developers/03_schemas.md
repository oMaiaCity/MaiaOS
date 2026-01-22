# JSON Schema System

MaiaOS uses a centralized JSON Schema validation system to ensure all `.maia` files conform to their expected structure. This provides:

- **Runtime validation** - Catch malformed data early
- **Clear error messages** - Know exactly what's wrong and where
- **Type safety** - Consistent data structures across the system
- **Documentation** - Schemas serve as authoritative documentation

## Overview

All schemas are located in `src/schemata/` and use JSON Schema Draft 2020-12. The validation engine uses AJV for fast, cached validation.

## Validation Engine

The `ValidationEngine` class provides a unified API for validating all MaiaOS data types:

```javascript
import { ValidationEngine, getSchema } from '../schemata/index.js';

const engine = new ValidationEngine();

// Load a schema
const actorSchema = getSchema('actor');
engine.loadSchema('actor', actorSchema);

// Validate data
const result = engine.validate('actor', actorData);
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

## Using Validation Helper

For most use cases, use the validation helper which automatically loads all schemas:

```javascript
import { validateOrThrow } from '../schemata/validation.helper.js';

// Validate and throw on error
try {
  validateOrThrow('actor', actorData, 'path/to/actor.maia');
} catch (error) {
  console.error('Validation failed:', error.message);
}
```

## Schema Types

### Actor Schema

Validates actor definitions (`.actor.maia` files).

**Required fields:**
- `$type`: Must be `"actor"`
- `$id`: Unique identifier (pattern: `^actor_`)

**Optional fields:**
- `contextRef`, `stateRef`, `viewRef`, `interfaceRef`, `brandRef`, `styleRef`
- `children`: Object mapping child names to actor IDs
- `subscriptions`: Array of actor IDs to receive messages from
- `inbox`: Array of messages
- `inboxWatermark`: Number (default: 0)

**Example:**
```json
{
  "$type": "actor",
  "$id": "actor_todo_001",
  "contextRef": "todo",
  "viewRef": "todo",
  "stateRef": "todo"
}
```

### Context Schema

Validates context definitions (`.context.maia` files).

**Required fields:**
- `$type`: Must be `"context"`
- `$id`: Unique identifier (pattern: `^context_`)

**Additional properties:** Any additional fields are allowed (flexible structure).

**Example:**
```json
{
  "$type": "context",
  "$id": "context_todo_001",
  "todos": [],
  "newTodoText": ""
}
```

### State Schema

Validates state machine definitions (`.state.maia` files).

**Required fields:**
- `$type`: Must be `"state"`
- `$id`: Unique identifier (pattern: `^state_`)
- `initial`: Initial state name
- `states`: Object mapping state names to state definitions

**State definition properties:**
- `entry`: Action or array of actions to execute on entry
- `exit`: Action or array of actions to execute on exit
- `on`: Object mapping event names to transitions

**Example:**
```json
{
  "$type": "state",
  "$id": "state_todo_001",
  "initial": "idle",
  "states": {
    "idle": {
      "on": {
        "CREATE_TODO": "creating"
      }
    }
  }
}
```

### View Schema

Validates view definitions (`.view.maia` files).

**Required fields:**
- `$type`: Must be `"view"`
- `$id`: Unique identifier (pattern: `^co_view_`)

**Properties:**
- `root`: Root DOM node (for leaf views)
- `container`: Container node (for composite views)

**View node properties:**
- `tag`: HTML tag name
- `class`: CSS class name
- `text`: Text content (can be expression)
- `value`: Input value (can be expression)
- `attrs`: HTML attributes object
- `children`: Array of child nodes
- `$on`: Event handlers object
- `$each`: Loop definition
- `$slot`: Slot reference (expression)

**Example:**
```json
{
  "$type": "view",
  "$id": "co_view_todo_001",
  "root": {
    "tag": "div",
    "text": "$title",
    "children": []
  }
}
```

### Style Schema

Validates style definitions (`.style.maia` files).

**Required fields:**
- `$type`: Must be `"actor.style"`

**Properties:**
- `tokens`: Design tokens object
- `components`: Component-specific styles object

**Example:**
```json
{
  "$type": "actor.style",
  "tokens": {
    "colors": {
      "primary": "#8fa89b"
    }
  },
  "components": {
    "button": {
      "background": "{colors.primary}"
    }
  }
}
```

### Brand Style Schema

Validates brand style definitions (`brand.style.maia` files).

**Required fields:**
- `$type`: Must be `"brand.style"`
- `$id`: Unique identifier (pattern: `^co_brand_`)

**Properties:**
- `tokens`: Design tokens (colors, spacing, typography, radii, shadows)
- `components`: Component-specific styles
- `selectors`: CSS selector-based styles

**Example:**
```json
{
  "$type": "brand.style",
  "$id": "co_brand_001",
  "tokens": {
    "colors": {
      "primary": "#8fa89b"
    }
  },
  "components": {
    "button": {
      "background": "{colors.primary}"
    }
  }
}
```

### Interface Schema

Validates interface definitions (`.interface.maia` files).

**Required fields:**
- `$type`: Must be `"actor.interface"`

**Properties:**
- `inbox`: Object mapping message types to payload schemas
- `publishes`: Object mapping message types to payload schemas
- `subscriptions`: Array of actor IDs
- `watermark`: Number (default: 0)

**Example:**
```json
{
  "$type": "actor.interface",
  "inbox": {
    "CREATE_TODO": {
      "payload": {
        "text": "string"
      }
    }
  },
  "publishes": {
    "TODO_CREATED": {
      "payload": {
        "id": "string"
      }
    }
  }
}
```

### Tool Schema

Validates tool definitions (`.tool.maia` files).

**Required fields:**
- `$type`: Must be `"tool"`
- `$id`: Unique identifier (pattern: `^tool_`)
- `name`: Tool identifier (pattern: `^@`)
- `description`: Tool description
- `parameters`: JSON Schema for tool parameters

**Example:**
```json
{
  "$type": "tool",
  "$id": "tool_create_001",
  "name": "@mutation/create",
  "description": "Creates a new entity",
  "parameters": {
    "type": "object",
    "properties": {
      "schema": {
        "type": "string"
      },
      "data": {
        "type": "object"
      }
    },
    "required": ["schema", "data"]
  }
}
```

### Skill Schema

Validates skill definitions (`.skill.maia` files).

**Required fields:**
- `$type`: Must be `"skill"`
- `$id`: Unique identifier (pattern: `^skill_`)
- `actorType`: Actor type this skill describes
- `description`: High-level capability summary
- `stateEvents`: Events the actor can handle
- `queryableContext`: Context fields AI can read

**Optional fields:**
- `version`: Skill version
- `capabilities`: High-level capability categories
- `bestPractices`: Guidelines for AI agents
- `commonPatterns`: Reusable interaction sequences
- `examples`: Usage examples

**Example:**
```json
{
  "$type": "skill",
  "$id": "skill_todo_001",
  "actorType": "todo",
  "description": "Todo list manager",
  "stateEvents": {
    "CREATE_TODO": {
      "description": "Create a new todo",
      "payload": {
        "text": {
          "type": "string",
          "required": true
        }
      }
    }
  },
  "queryableContext": {
    "todos": {
      "type": "array",
      "description": "List of todos"
    }
  }
}
```

### Vibe Schema

Validates vibe definitions (`.vibe.maia` files).

**Required fields:**
- `$type`: Must be `"vibe"`
- `$id`: Unique identifier (pattern: `^vibe_`)
- `name`: Vibe name
- `description`: Vibe description
- `actor`: Path to actor definition file

**Example:**
```json
{
  "$type": "vibe",
  "$id": "vibe_todos_001",
  "name": "Todo List",
  "description": "A todo list application",
  "actor": "./vibe/vibe.actor.maia"
}
```

### Message Schema

Validates messages passed between actors.

**Required fields:**
- `type`: Message type/event name
- `timestamp`: Unix timestamp (number, minimum: 0)

**Optional fields:**
- `payload`: Message payload data (object)
- `from`: Sender actor ID (string)
- `id`: Optional message ID for deduplication (string)

**Example:**
```json
{
  "type": "CREATE_TODO",
  "payload": {
    "text": "Buy milk"
  },
  "from": "actor_user_001",
  "timestamp": 1234567890
}
```

### Data Schemas

Validates application data (todos, notes, etc.) stored in IndexedDB. These schemas are dynamically seeded into the database and used for runtime validation of create/update operations.

**Location:** `src/schemata/data/`

**Required fields:**
- `$id`: Unique schema identifier (e.g., `"https://maiaos.dev/schemas/data/todos"`)
- `$schema`: JSON Schema version (e.g., `"http://json-schema.org/draft-07/schema#"`)
- `type`: Must be `"object"`
- `properties`: Object defining field schemas
- `required`: Array of required field names

**Example - Todos Schema:**
```json
{
  "$id": "https://maiaos.dev/schemas/data/todos",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique identifier for the todo item"
    },
    "text": {
      "type": "string",
      "minLength": 1,
      "description": "The todo item text content"
    },
    "done": {
      "type": "boolean",
      "description": "Whether the todo item is completed"
    }
  },
  "required": ["text", "done"],
  "additionalProperties": false
}
```

**How It Works:**

1. **Schema Definition**: Create a JSON Schema file in `src/schemata/data/` (e.g., `todos.schema.json`)
2. **Automatic Seeding**: Schemas are automatically seeded into IndexedDB during `MaiaOS.boot()` via the `schemata` module
3. **Runtime Validation**: When creating or updating data, the operation loads the schema from IndexedDB and validates the data
4. **Storage**: Schemas are stored in IndexedDB's `schemas` store with keys like `@schema/data/todos`

**Adding a New Data Schema:**

1. Create `src/schemata/data/yourtype.schema.json` following JSON Schema format
2. Export it in `src/schemata/index.js`:
   ```javascript
   import yourtypeSchema from './data/yourtype.schema.json';
   const DATA_SCHEMAS = {
     'data/todos': todosSchema,
     'data/yourtype': yourtypeSchema  // Add here
   };
   ```
3. The schema will be automatically seeded and used for validation

**Validation Points:**
- **Create operations**: Full validation (all required fields must be present)
- **Update operations**: Partial validation (only validates fields being updated, doesn't require all fields)
- **Toggle operations**: Validates field exists and is boolean type

## Common Definitions

The `common.schema.json` file defines shared patterns used across multiple schemas:

- **Expression**: Context reference (`$field`), item reference (`$$field`), or literal value
- **Guard**: Guard condition for state machine transitions
- **Action**: Tool invocation or context update
- **Transition**: State machine transition definition
- **MessagePayload**: Message payload definition

## Integration

Validation is automatically integrated into all engines:

- **ActorEngine**: Validates actor, context, and interface files on load
- **StateEngine**: Validates state machine files on load
- **ViewEngine**: Validates view files on load
- **StyleEngine**: Validates style files on load
- **ToolEngine**: Validates tool definition files on load
- **Kernel**: Validates vibe manifest files on load

## Error Messages

Validation errors include:

- `instancePath`: JSON path to the invalid field (e.g., `/properties/name`)
- `schemaPath`: JSON path in the schema (e.g., `/properties/name/type`)
- `keyword`: Validation keyword that failed (e.g., `required`, `type`)
- `message`: Human-readable error message
- `params`: Additional error parameters

**Example error:**
```json
{
  "instancePath": "/properties/name",
  "schemaPath": "#/properties/name/type",
  "keyword": "type",
  "message": "must be string",
  "params": {
    "type": "string"
  }
}
```

## Performance

- Schemas are compiled once and cached
- Validation is fast (< 1ms per file typically)
- Validation only occurs on file load, not at runtime

## Extending Schemas

To add a new schema:

1. Create `src/schemata/newtype.schema.json`
2. Add schema to `src/schemata/index.js` exports
3. Update `validation.helper.js` to load the new schema
4. Add validation calls in the appropriate engine

## Best Practices

1. **Be permissive initially**: Start with schemas that accept current data, tighten later
2. **Use clear descriptions**: Add `title` and `description` fields for better error messages
3. **Reuse common definitions**: Extract shared patterns into `common.schema.json`
4. **Test against real data**: Use integration tests to validate all existing files
5. **Version schemas**: Include `$schema` field pointing to JSON Schema spec
