---
name: Centralized JSON Schema System
overview: Create standardized JSON schema definitions for all MaiaOS data types with centralized validation engine
todos:
  - id: milestone-1
    content: Create schemata folder structure and validation engine foundation
    status: pending
  - id: milestone-2
    content: Create JSON schemas for all core data types
    status: pending
  - id: milestone-3
    content: Integrate validation engine into all engines
    status: pending
  - id: milestone-4
    content: Add integration tests and update documentation
    status: pending
---

# Centralized JSON Schema System for MaiaOS

## Problem Statement

Currently, MaiaOS data types (actor, context, state, view, style, interface, tool, skill, vibe, message) are defined implicitly through code examples and documentation. There's no centralized validation system, making it difficult to:

- **Validate** `.maia` files at runtime
- **Ensure consistency** across different engines
- **Provide clear errors** when data structures are invalid
- **Generate type definitions** for TypeScript/IDEs
- **Document schemas** in a standard format (JSON Schema)

**How might we centralize all data type schemas into clean, standardized JSON schema definitions with a unified validation engine so that all MaiaOS types are validated consistently across the system?**

## Success Criteria

- **Desirable**: Developers and vibecreators get clear validation errors when `.maia` files are malformed
- **Feasible**: Use AJV (JSON Schema validator) which works with Bun and provides excellent error messages
- **Viable**: Centralized schemas are maintainable, versioned, and easy to extend

## Solution Approach

**Chosen Approach: Centralized Schema + Validation Engine**

1. **Create `schemata/` folder** in `libs/maia-script/src/` containing:
   - Individual JSON schema files for each data type
   - Shared/common schema definitions (reusable components)
   - Schema index file for easy imports

2. **Create Validation Engine** (`validation.engine.js`):
   - Uses AJV for JSON Schema validation
   - Provides unified `validate(type, data)` API
   - Returns detailed error messages with paths
   - Caches compiled schemas for performance

3. **Integrate into Engines**:
   - Each engine validates its input data type before processing
   - Provides clear error messages pointing to exact field issues

**Why This Approach:**
- ✅ Standard JSON Schema format (widely supported, tooling available)
- ✅ AJV is fast, well-maintained, works with Bun
- ✅ Centralized = single source of truth
- ✅ Easy to extend (add new types = add new schema file)
- ✅ Can generate TypeScript types from schemas later

## Implementation Milestones

### Milestone 1: Create Schemata Folder Structure and Validation Engine Foundation

**Tests to Write:**
- [ ] Unit test: Validation engine initializes correctly
- [ ] Unit test: Validation engine loads schemas
- [ ] Unit test: Validation engine validates valid data
- [ ] Unit test: Validation engine rejects invalid data with clear errors
- [ ] Unit test: Validation engine handles missing schemas gracefully

**Implementation:**
- [ ] Create `libs/maia-script/src/schemata/` folder
- [ ] Create `libs/maia-script/src/schemata/validation.engine.js`
- [ ] Install AJV dependency (`bun add ajv`)
- [ ] Implement basic validation engine with schema loading
- [ ] Create `libs/maia-script/src/schemata/index.js` for exports
- [ ] Ensure tests pass

**Cleanup & Migration:**
- [ ] No legacy code to clean up (new feature)

**Human Checkpoint:** ✋ Pause for feedback

### Milestone 2: Create JSON Schemas for All Core Data Types

**Data Types to Schema:**
1. **Actor** (`.actor.maia`) - References to context, state, view, interface, brand, style, children, subscriptions, inbox
2. **Context** (`.context.maia`) - Runtime data (flexible JSON structure)
3. **State Machine** (`.state.maia`) - XState-like state machine with states, transitions, guards, actions
4. **View** (`.view.maia`) - UI structure with root/container, tag, children, expressions
5. **Style** (`.style.maia` and `brand.style.maia`) - Design tokens and component styles
6. **Interface** (`.interface.maia`) - Message interface with inbox, publishes, subscriptions
7. **Tool** (`.tool.maia`) - Tool metadata with name, description, parameters
8. **Skill** (`.skill.maia`) - AI agent interface specification
9. **Vibe** (`.vibe.maia`) - Vibe manifest/metadata
10. **Message** - Messages passed between actors (type, payload, from, timestamp)

**Tests to Write:**
- [ ] Unit test: Each schema validates correct examples from `vibes/` folder
- [ ] Unit test: Each schema rejects invalid data with appropriate errors
- [ ] Integration test: Validate all existing `.maia` files in `vibes/todos/` against schemas

**Implementation:**
- [ ] Create `libs/maia-script/src/schemata/actor.schema.json`
- [ ] Create `libs/maia-script/src/schemata/context.schema.json`
- [ ] Create `libs/maia-script/src/schemata/state.schema.json`
- [ ] Create `libs/maia-script/src/schemata/view.schema.json`
- [ ] Create `libs/maia-script/src/schemata/style.schema.json`
- [ ] Create `libs/maia-script/src/schemata/brand-style.schema.json`
- [ ] Create `libs/maia-script/src/schemata/interface.schema.json`
- [ ] Create `libs/maia-script/src/schemata/tool.schema.json`
- [ ] Create `libs/maia-script/src/schemata/skill.schema.json`
- [ ] Create `libs/maia-script/src/schemata/vibe.schema.json`
- [ ] Create `libs/maia-script/src/schemata/message.schema.json`
- [ ] Create `libs/maia-script/src/schemata/common.schema.json` for shared definitions
- [ ] Update validation engine to load all schemas
- [ ] Ensure tests pass

**Cleanup & Migration:**
- [ ] No legacy code to clean up (new feature)

**Human Checkpoint:** ✋ Pause for feedback

### Milestone 3: Integrate Validation Engine into All Engines

**Tests to Write:**
- [ ] Unit test: ActorEngine validates actor data before processing
- [ ] Unit test: StateEngine validates state machine before processing
- [ ] Unit test: ViewEngine validates view before processing
- [ ] Unit test: StyleEngine validates style before processing
- [ ] Unit test: ToolEngine validates tool metadata before processing
- [ ] Integration test: All engines reject invalid data with clear errors
- [ ] Integration test: All existing `.maia` files pass validation

**Implementation:**
- [ ] Update `ActorEngine` to validate actor data on load
- [ ] Update `StateEngine` to validate state machine on load
- [ ] Update `ViewEngine` to validate view on load
- [ ] Update `StyleEngine` to validate style on load
- [ ] Update `ToolEngine` to validate tool metadata on load
- [ ] Update `Kernel` to validate vibe manifest on load
- [ ] Ensure all existing tests still pass
- [ ] Add validation error handling (throw clear errors with schema paths)

**Cleanup & Migration:**
- [ ] Remove any ad-hoc validation logic in engines (replace with centralized validation)
- [ ] Update all call sites to use validation engine
- [ ] Verify 100% migration complete

**Human Checkpoint:** ✋ Pause for feedback

### Milestone 4: Add Integration Tests and Update Documentation

**Tests to Write:**
- [ ] Integration test: Validate all `.maia` files in `vibes/` folder
- [ ] Integration test: Validation errors are clear and actionable
- [ ] Integration test: Performance test (validation doesn't slow down engine initialization)

**Implementation:**
- [ ] Create `libs/maia-script/src/schemata/validation.engine.integration.test.js`
- [ ] Auto-discover all `.maia` files in `vibes/` folder
- [ ] Validate each file against appropriate schema
- [ ] Ensure all tests pass

**Documentation Updates:**
- [ ] Update `libs/maia-script/docs/developers/dsl.md` - Document schema system
- [ ] Update `libs/maia-script/docs/developers/engines.md` - Document validation integration
- [ ] Create `libs/maia-script/docs/developers/schemas.md` - Schema reference guide
- [ ] ❌ Skip `docs/agents/LLM_*.md` (auto-generated)

**Human Checkpoint:** ✋ Final approval

## File Structure

```
libs/maia-script/src/
├── schemata/                          ← NEW FOLDER
│   ├── index.js                      ← Schema exports
│   ├── validation.engine.js          ← Validation engine (AJV wrapper)
│   ├── validation.engine.test.js     ← Unit tests
│   ├── validation.engine.integration.test.js  ← Integration tests
│   ├── actor.schema.json             ← Actor schema
│   ├── context.schema.json           ← Context schema
│   ├── state.schema.json             ← State machine schema
│   ├── view.schema.json               ← View schema
│   ├── style.schema.json             ← Style schema
│   ├── brand-style.schema.json       ← Brand style schema
│   ├── interface.schema.json         ← Interface schema
│   ├── tool.schema.json               ← Tool schema
│   ├── skill.schema.json              ← Skill schema
│   ├── vibe.schema.json               ← Vibe schema
│   ├── message.schema.json            ← Message schema
│   └── common.schema.json             ← Shared definitions (expressions, guards, etc.)
└── o/
    └── engines/
        ├── actor-engine/
        │   └── actor.engine.js        ← UPDATED: Add validation
        ├── state-engine/
        │   └── state.engine.js        ← UPDATED: Add validation
        ├── view-engine/
        │   └── view.engine.js        ← UPDATED: Add validation
        ├── style-engine/
        │   └── style.engine.js       ← UPDATED: Add validation
        ├── tool-engine/
        │   └── tool.engine.js       ← UPDATED: Add validation
        └── ...
```

## Testing Strategy

- **Unit Tests**: Test validation engine in isolation, test each schema individually
- **Integration Tests**: Validate all existing `.maia` files in `vibes/` folder against schemas
- **Test Output**: Standard Bun test output, clear error messages showing schema path and issue
- **Performance**: Schema compilation cached, validation should be fast (< 1ms per file)

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Schemas too strict (reject valid data) | Start with permissive schemas, tighten based on real-world usage |
| Schemas too loose (accept invalid data) | Test against all existing files, iterate on schemas |
| Performance impact | Cache compiled schemas, validate only on load (not runtime) |
| Breaking existing code | Validate in parallel first, then integrate gradually |
| Schema maintenance burden | Keep schemas close to actual data structures, document well |

## Documentation Updates

- [ ] `libs/maia-script/docs/developers/schemas.md` - NEW: Schema reference guide
- [ ] `libs/maia-script/docs/developers/dsl.md` - UPDATE: Document schema validation
- [ ] `libs/maia-script/docs/developers/engines.md` - UPDATE: Document validation integration
- [ ] ❌ Skip `docs/agents/LLM_*.md` (auto-generated)

## Schema Design Principles

1. **Be Permissive Initially**: Start with schemas that accept current data, tighten later
2. **Use JSON Schema Draft 2020-12**: Latest standard, best tooling support
3. **Reuse Common Definitions**: Extract shared patterns (expressions, guards, actions) into `common.schema.json`
4. **Clear Error Messages**: Use `title` and `description` fields for better error messages
5. **Version Schemas**: Include `$schema` field pointing to JSON Schema spec

## Example Schema Structure

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://maiaos.dev/schemas/actor.schema.json",
  "title": "Actor Definition",
  "description": "Pure declarative actor specification",
  "type": "object",
  "required": ["$type"],
  "properties": {
    "$type": {
      "type": "string",
      "const": "actor"
    },
    "$id": {
      "type": "string",
      "pattern": "^actor_"
    },
    "contextRef": {
      "type": "string"
    },
    "stateRef": {
      "type": "string"
    },
    "viewRef": {
      "type": "string"
    },
    "interfaceRef": {
      "type": "string"
    },
    "brandRef": {
      "type": "string"
    },
    "styleRef": {
      "type": "string"
    },
    "children": {
      "type": "object",
      "additionalProperties": {
        "type": "string"
      }
    },
    "subscriptions": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "inbox": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/message"
      }
    },
    "inboxWatermark": {
      "type": "number",
      "minimum": 0
    }
  },
  "$defs": {
    "message": {
      "$ref": "message.schema.json"
    }
  }
}
```
