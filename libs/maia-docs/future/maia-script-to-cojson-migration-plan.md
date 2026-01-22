# MaiaScript to CoJSON Migration Plan

**Status**: Active Planning (Phase 1)  
**Last Updated**: 2026-01-21  
**Design Thinking Stage**: Define → Ideate

---

## Problem Statement

MaiaScript currently stores data directly into IndexedDB via the `IndexedDBBackend`. We need to upgrade it to use **CRDT-based CoJSON** as the underlying storage layer while:

1. **Preserving interfaces** - All maia-script APIs remain the same (db operations, seeding, schemas, validations)
2. **Preserving subscription architecture** - Actor-based subscription system stays intact (SubscriptionEngine unchanged), leveraging CoJSON subscriptions + caching under the hood
3. **Maintaining end-to-end reactivity** - Full reactive flow from CoJSON → Backend → QueryOperation → SubscriptionEngine → Actor → View
4. **Enabling CRDTs** - Every entity, instance and schema alike becomes a CoValue (co-map, co-list, co-stream, co-text) at its root
5. **Extending schemas** - JSON Schema gains native co-type support for root-level type enforcement

---

## Success Criteria

**Desirable** (User-facing benefits):
- ✅ Todo vibe app maintains full functionality throughout migration
- ✅ Actor-based reactive subscriptions work perfectly (end-to-end flow intact)
- ✅ Real-time sync capabilities enabled (CRDT foundation)
- ✅ Schema validation enforces CRDT types at root level
- ✅ Developers use same maia-script APIs (no breaking changes)

**Feasible** (Technical requirements):
- ✅ Swap IndexedDB backend with CoJSON backend under the hood
- ✅ SubscriptionEngine remains unchanged (no modifications to actor subscription logic)
- ✅ CoJSONBackend.subscribe() leverages CoJSON subscriptions + oSubscriptionCache
- ✅ Extend JSON Schema with co-types as native types:
  - Use `"type": "comap"` (not separate `$coType` field)
  - **Each co-type = Separate schema** (no inline co-type nesting!)
  - Properties can only be primitives or `$ref` (composition via native JSON Schema references)
  - Use native `$ref` with co-ids for references - **ZERO BOILERPLATE!**
  - Schema ref is co-id: `$schema` uses co-id (not URI)
  - Co-ids are auto-generated (content-addressable hash via `coValue.id`)
  - **Three-level validation in AJV**: Pattern + existence + schema (all automatic!)
  - Extend AJV with custom keywords for co-type validation (comap, colist, costream, cotext)
- ✅ Meta schema enforces root must be a co-type
  - Meta schema itself is a CoMap with `definition` property
  - Schema definitions enforce instances to be one of 4 root co-types
- ✅ Seed operation creates CoValues (primarily CoMaps and CoLists) instead of plain objects
- ✅ Query/Create/Update/Delete operations work with CoValues transparently
  - Focus primarily on CoMap and CoList (most common types)
  - CoText and CoStream supported but less critical for initial migration

**Viable** (Maintainability):
- ✅ No legacy backwards compatibility layers (100% migration each step)
- ✅ Each milestone is fully functional and testable
- ✅ Clear documentation for developers using upgraded system
- ✅ DB viewer works with both legacy IndexedDB and new CoJSON data
- ✅ Simple group management (one default group for everything initially)
- ✅ Dependency-driven subscriptions (fine-grained, efficient, CRDT-native)

---

## Architectural Resolution: Dependency-Driven Subscriptions

### The Contradiction

**Initial confusion**: "Preserve actor-based subscriptions" vs "Subscribe to entire account" - these seemed contradictory.

**Resolution**: Actors subscribe to their **specific dependencies** (not entire account)!

### How It Works

In a CRDT world, **EVERYTHING is a CoValue**:
- Context CoMap (actor config)
- Style CoMap (styling rules)
- View CoMap (template)
- State CoMap (local state)
- Data (e.g., todos CoList)

**Each actor declares its dependencies in its context:**

```javascript
// TodoList actor context
{
  todos: {schema: "@schema/todos"},        // Data dependency
  style: {schema: "@schema/todo-style"},   // Style CoMap dependency
  view: {schema: "@schema/todo-view"},     // View CoMap dependency
  state: {schema: "@schema/todo-state"}    // State CoMap dependency
}

// SubscriptionEngine subscribes to EACH dependency
// When ANY of these CoValues change → actor re-renders
```

### Why This Is Better

**CRDT-Native Architecture:**
- ✅ **Location-transparent**: CoValues can be local, remote, synced anywhere - actor doesn't care!
- ✅ **Fine-grained reactivity**: Only re-render when YOUR dependencies change (not entire account)
- ✅ **Distributed-first**: Each CoValue syncs independently (perfect for CRDT world)
- ✅ **Runtime editable**: Change style CoMap → styled actors re-render automatically
- ✅ **Efficient**: No unnecessary re-renders from unrelated changes
- ✅ **Scalable**: Each actor manages its own dependency graph

### SubscriptionEngine Unchanged

**Critical**: SubscriptionEngine code remains **completely unchanged**!
- It already scans actor context for queries: `{schema: "@schema/..."}`
- It already subscribes via `dbEngine.execute({op: 'query', callback})`
- It already batches re-renders when data changes

**Only backend changes**:
- IndexedDBBackend.subscribe() → CoJSONBackend.subscribe()
- CoJSONBackend subscribes to individual CoValues (via oSubscriptionCache)
- When ANY subscribed CoValue changes → callback → actor re-renders

### Example Flow

```
1. Actor declares dependencies:
   context: {
     todos: {schema: "@schema/todos"},
     style: {schema: "@schema/todo-style"}
   }

2. SubscriptionEngine subscribes to each:
   dbEngine.execute({op: 'query', schema: '@schema/todos', callback})
   dbEngine.execute({op: 'query', schema: '@schema/todo-style', callback})

3. CoJSONBackend.subscribe() subscribes to matching CoValues:
   - All todos CoMaps → subscribe to each via oSubscriptionCache
   - All style CoMaps → subscribe to each via oSubscriptionCache

4. When ANY CoValue changes:
   - CoValue.subscribe callback fires
   - Aggregated callback notifies SubscriptionEngine
   - SubscriptionEngine updates actor.context[key]
   - Actor re-renders (batched)

5. Result:
   - Change todo → TodoList actor re-renders
   - Change style → Styled actors re-render
   - Change unrelated CoValue → NO re-render (efficient!)
```

---

## Current Architecture Analysis

### MaiaScript (IndexedDB Backend)

**Current Flow:**
```
maia.db({op: 'create', schema: 'todos', data: {...}})
  ↓
DBEngine.execute({op: 'create', ...})
  ↓
CreateOperation.execute() → validates schema → backend.create()
  ↓
IndexedDBBackend.create() → IndexedDB transaction → store.put()
```

**Storage Structure:**
- **configs**: All .maia configs (actors, views, styles, states, etc.)
- **schemas**: JSON Schema definitions
- **data**: Plain JavaScript objects (todos, notes, etc.)
  - Key: `@schema/todos:${id}`
  - Value: `{id, title, done, ...}` (plain object)

**Subscription Logic:**
- Observer pattern: `observers` Map tracks callbacks by schema
- Notify on create/update/delete: `backend.notifyObservers(schema, record)`
- Query operations can subscribe: `backend.subscribe(schema, filter, callback)`

---

### Maia-DB (CoJSON Backend Prototype)

**Current Flow:**
```
cojson({op: 'create', coType: 'comap', schema: 'todos', data: {...}})
  ↓
CoJSONEngine.execute({op: 'create', ...})
  ↓
CreateOperation.execute() → validates schema → createCoMap(group, data, schema)
  ↓
CoMap created with headerMeta: {$schema: 'todos', $createdAt: timestamp}
  ↓
CoJSON stores in IndexedDB via cojson internals
```

**Storage Structure:**
- **CoJSON's IndexedDB**: Managed internally by cojson library
  - Stores CoValue transactions, ops, CRDT metadata
  - NOT directly accessible (hidden implementation detail)
- **CoValues**: CRDT objects with co-ids
  - CoMap: `co_z9h5nwiNynbxnC3nTw...`
  - CoList: `co_z8g4mviMxm...`
  - CoStream: `co_z7f3luhLwl...`
  - CoText: `co_z6e2ktgKvk...`

**Subscription Logic:**
- CoJSON native subscriptions: `coValue.subscribe(callback)`
- Subscription cache: `oSubscriptionCache.js` tracks active subscriptions
- Reactive updates when CoValue changes

---

## Co-Type Architecture Summary

### Co-Types as Native JSON Schema Types

Instead of using separate `$coType` fields, co-types are **native JSON Schema types**:

```javascript
// ❌ OLD APPROACH (separate field)
{
  "$coType": "comap",
  "type": "object",
  "properties": { ... }
}

// ✅ NEW APPROACH (native type)
{
  "type": "comap",  // Co-type IS the type
  "properties": { ... }
}
```

### Nested Co-Types

Properties and items can be co-types:

```javascript
{
  "type": "comap",
  "properties": {
    "name": {"type": "string"},           // Primitive type
    "todos": {"type": "colist"},           // Nested co-type
    "metadata": {"type": "comap"},         // Nested co-type
    "description": {"type": "cotext"}      // Nested co-type
  }
}
```

### Co-Type Hierarchy

```
Root (MUST be a co-type)
  ├── CoMap (type: "comap")
  │   ├── Properties: string, number, boolean, null (primitives)
  │   ├── Properties: CoMap, CoList, CoStream, CoText (nested co-types)
  │   └── Properties: co-id (type: "co-id") - links to other CoValues
  ├── CoList (type: "colist")
  │   ├── Items: string, number, boolean, null (primitives)
  │   ├── Items: CoMap, CoList, CoStream, CoText (nested co-types)
  │   └── Items: co-id (type: "co-id") - links to other CoValues
  ├── CoStream (type: "costream")
  │   ├── Items: string, number, boolean, null (primitives)
  │   ├── Items: CoMap, CoList, CoStream, CoText (nested co-types)
  │   └── Items: co-id (type: "co-id") - append-only log references
  └── CoText (type: "cotext")
      └── Plain text string (leaf type, no children)
```

### Co-ID References (Cross-CoValue Links)

```javascript
// Project CoMap referencing Todo CoValues
{
  "type": "comap",
  "properties": {
    "name": {"type": "string"},
    "todos": {
      "type": "colist",
      "items": {
        "type": "co-id",  // Co-id type (abstracted)
        "targetSchema": "https://maia.city/schemas/todo",  // Optional hint
        "description": "References to Todo CoValues"
      }
    }
  }
}
```

**Key Insights**:
- ✅ **Universal co-id type**: One type for all references (schemas, entities, any CoValue)
- ✅ **Schema ref is co-id**: `$schema` uses co-id (no URIs)
- ✅ **Auto-generated co-ids**: Content-addressable hash (accessed via `coValue.id`)
- ✅ **NO BOILERPLATE NEEDED**: Just `{"type": "co-id"}` - that's it!
- ✅ **No `targetSchema` hints**: Co-id value carries its own schema (via HeaderMeta)
- ✅ **Pattern validation abstracted**: AJV handles `^co_z[a-zA-Z0-9]+$` validation once
- ✅ **Schemas are CoValues**: Each schema is a CoMap with its own auto-generated co-id
- ✅ **Links to outer CoValues**: Co-ids reference separate CoValues (not nested)
- ✅ **Self-describing**: Dereference co-id → get schema from HeaderMeta

---

## Key Differences & Integration Challenges

### 1. Data Model Transformation

| Aspect | IndexedDB Backend | CoJSON Backend |
|--------|-------------------|----------------|
| **Data Type** | Plain JavaScript objects | CoValues (CoMap, CoList, CoStream, CoText) |
| **Identity** | `{schema}:{id}` string key | `co_z...` co-id |
| **Storage** | Direct IndexedDB transactions | CoJSON internal (CRDT ops) |
| **Root Type** | Any object/array | MUST be one of 4 co-types |
| **Mutations** | Direct property assignment | CoValue methods (`.set()`, `.append()`, etc.) |

### 2. Schema Requirements

**Current Meta Schema:**
- Validates standard JSON Schema structure
- Allows `type: "object"` or `type: "array"` at root
- No co-type enforcement
- No support for nested co-types

**Needed Meta Schema Upgrade:**

Co-types are **native JSON Schema types** (not separate fields):
- `"type": "comap"` (CRDT map/object)
- `"type": "colist"` (CRDT list/array)
- `"type": "costream"` (CRDT append-only stream)
- `"type": "cotext"` (CRDT plain text)

Properties can be co-types (nested):
- `"items": {"type": "colist"}` (CoList of CoLists)
- `"properties": {"todos": {"type": "colist"}}` (CoMap with CoList property)

Co-id references link to outer CoValues:
- `"type": "string", "pattern": "^co_z"` (validated via referenced CoValue's schema)

**Meta Schema Structure:**
```json
{
  "$schema": "co_zMetaSchemaId123...",  // Self-reference (co-id)
  // Note: $id is auto-generated (content-addressable hash)
  "type": "comap",  // Meta schema itself is a CoMap
  "properties": {
    "$schema": {
      "type": "co-id",
      "description": "Reference to meta schema (co-id, no boilerplate)"
    },
    "type": {
      "anyOf": [
        {"$ref": "#/$defs/simpleTypes"},
        {"$ref": "#/$defs/coTypes"},
        {"type": "array", "items": {"anyOf": [
          {"$ref": "#/$defs/simpleTypes"},
          {"$ref": "#/$defs/coTypes"}
        ]}}
      ]
    },
    "properties": {
      "type": "object",
      "additionalProperties": {"$dynamicRef": "#meta"}
    },
  },
  "$defs": {
    "simpleTypes": {
      "enum": ["array", "boolean", "integer", "null", "number", "object", "string"]
    },
    "coTypes": {
      "enum": ["comap", "colist", "costream", "cotext", "co-id"],
      "description": "CRDT types + co-id reference type (can be nested)"
    }
  }
}
```

**Example Schema (Before):**
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://maia.city/schemas/todos",
  "type": "object",
  "properties": {
    "title": {"type": "string"},
    "done": {"type": "boolean"}
  }
}
```

**Example Schema (After - Simple CoMap with primitives and $ref):**
```json
{
  "$schema": "co_zMetaSchemaId123...",  // Co-id reference to meta schema
  // Note: $id is auto-generated (content-addressable hash)
  "type": "comap",  // Root MUST be a co-type
  "properties": {
    "title": {"type": "string"},           // ✅ Primitive
    "done": {"type": "boolean"},           // ✅ Primitive
    "priority": {"type": "number"},        // ✅ Primitive
    "assignee": {"$ref": "co_zUser456..."}  // ✅ $ref to User schema
  }
}
```

**Example: Composition (Two separate schemas with native $ref):**

```json
// Schema 1: TodoList (separate CoValue)
{
  "$schema": "co_zMetaSchemaId123...",
  // Note: $id is auto-generated (content-addressable)
  "type": "colist",  // Root is CoList
  "items": {"$ref": "co_zTodo012..."}  // ✅ $ref to Todo schema
}
// Creates CoValue with co-id: co_zTodoList789...

// Schema 2: Project (references TodoList via $ref)
{
  "$schema": "co_zMetaSchemaId123...",
  // Note: $id is auto-generated (content-addressable)
  "type": "comap",
  "properties": {
    "name": {"type": "string"},
    "todos": {"$ref": "co_zTodoList789..."}  // ✅ $ref to TodoList schema (not nested!)
  }
}
// Creates CoValue with co-id: co_zProject345...
```

**Key**: `todos` property uses native JSON Schema `$ref` pointing to the TodoList schema co-id. AJV handles resolution automatically!

**Key Insights:**

1. **Co-types as native types**: Use `"type": "comap"` instead of `"type": "object"` + separate `$coType` field
2. **Each co-type = Separate schema**: When a property is a co-type, it becomes its own standalone schema with its own co-id
3. **Composition via native $ref**: Properties reference co-types via `{"$ref": "co_z..."}` (native JSON Schema!)
4. **Primitives or $ref in properties**: Properties can only be primitives (`string`, `number`, etc.) or `$ref` (no inline co-types)
5. **Schema ref is co-id**: `$schema` uses co-id (not URI)
6. **Auto-generated co-ids**: Co-id is content-addressable hash (accessed via `coValue.id`)
7. **Three-level validation in AJV**: Pattern + existence + schema validation (all automatic!)
8. **No custom co-id type needed**: Use standard `$ref` with co-ids
9. **AJV extension needed**: Add custom keywords to AJV for co-type validation (comap, colist, costream, cotext)

### 3. Co-ID References and Cross-Schema Validation

**Co-ID Pattern**: All CoValue IDs follow the pattern `co_z[a-zA-Z0-9]+`

**Co-ID as Native Type**: Instead of manual pattern validation, use `"type": "co-id"` (abstracted in meta schema + AJV)

**All Schema References Are Co-IDs**:

Since **schemas themselves are CoValues** (CoMaps), all schema references use co-ids:
- `$schema: "co_zMetaSchemaId123..."` - Reference to meta schema CoMap
- Co-id is auto-generated (content-addressable hash) - accessed via `coValue.id`

**Why Universal Co-ID Type?**

Instead of separate handling for schema refs vs entity refs:
- ✅ **One type for all references**: `"type": "co-id"` works for schemas, entities, any CoValue
- ✅ **No boilerplate needed**: Just `{"type": "co-id"}` - that's it!
- ✅ **Content-addressable**: Co-ids are auto-generated (immutable hash of content)
- ✅ **No manual assignment**: System generates co-id when CoValue is created (accessed via `coValue.id`)
- ✅ **Self-describing**: Co-id value carries its own schema (via HeaderMeta)
- ✅ **Simpler validation**: Same AJV keyword handles all co-id references
- ✅ **Consistent patterns**: All refs follow same pattern (`co_z...`)
- ✅ **No special cases**: Schema refs aren't treated differently from entity refs

**How Co-IDs Work (Content-Addressable):**

1. **CoValue created**: System generates immutable co-id (hash of content)
   ```javascript
   const todo = account.createMap({title: "Setup MaiaOS"}, {$schema: todoSchemaCoId});
   console.log(todo.id);  // "co_z9h5nwiNynbxnC3nTw..." (auto-generated!)
   ```

2. **Reference stored as co-id string**: `"assignee": "co_z9h5nwiNynbxnC3nTw..."`

3. **Schema validates pattern**: `{"type": "co-id"}` (AJV checks `^co_z` pattern automatically)

4. **Dereferencing gets schema**: When dereferenced, CoValue's HeaderMeta provides its schema

5. **Validation happens at dereference time**: Validate against referenced CoValue's schema (no hints needed)

**Example: Todo with Assignee Reference**

```javascript
// Todo schema (references User CoValue)
{
  "$schema": "co_zMetaSchemaId123...",  // Co-id ref to meta schema
  // Note: $id is auto-generated (content-addressable hash)
  "type": "comap",
  "properties": {
    "title": {"type": "string"},
    "done": {"type": "boolean"},
    "assignee": {
      "type": "co-id",  // ✅ That's it! No boilerplate!
      "description": "Reference to User CoValue"
    }
  }
}

// User schema (referenced by Todo)
{
  "$schema": "co_zMetaSchemaId123...",  // Co-id ref to meta schema
  // Note: $id is auto-generated (content-addressable hash)
  "type": "comap",
  "properties": {
    "name": {"type": "string"},
    "email": {"type": "string", "format": "email"}
  }
}

// Todo instance (CoMap)
{
  "title": "Fix bug",
  "done": false,
  "assignee": "co_z9h5nwiNynbxnC3nTw..."  // Co-id reference
}

// User instance (CoMap at co_z9h5nwiNynbxnC3nTw...)
{
  "name": "Alice",
  "email": "alice@example.com"
}
```

**Validation Flow:**

1. **Format validation** (schema-level):
   - Check `assignee` matches pattern `^co_z`
   - ✅ Pass if co-id format is valid

2. **Existence validation** (optional, runtime):
   - Check if CoValue `co_z9h5nwiNynbxnC3nTw...` exists
   - ✅ Pass if CoValue found in account.Data

3. **Type validation** (optional, runtime):
   - Load referenced CoValue's schema
   - Check if schema matches hint (`$ref: "https://maia.city/schemas/user"`)
   - ✅ Pass if referenced CoValue has correct schema

**Before (Manual Pattern Validation + URIs):**
```json
{
  "$schema": "https://maia.city/schemas/meta",  // ❌ URI (not a CoValue ref)
  "$id": "https://maia.city/schemas/todo",      // ❌ URI (not a co-id)
  "properties": {
    "assignee": {
      "type": "string",
      "pattern": "^co_z[a-zA-Z0-9]+$",  // ❌ Manual pattern validation
      "description": "Reference to User CoValue"
    }
  }
}
```

**After (Universal Co-ID Type - No Boilerplate):**
```json
{
  "$schema": "co_zMetaSchemaId123...",  // ✅ Co-id ref
  // Note: $id is auto-generated (content-addressable)
  "properties": {
    "assignee": {
      "type": "co-id",  // ✅ That's it! No boilerplate!
      "description": "Reference to User CoValue"
    }
  }
}
```

**Benefits:**

- ✅ **Less boilerplate**: No manual pattern validation in every schema
- ✅ **Better semantics**: `"type": "co-id"` is clearer than `"type": "string", "pattern": "^co_z"`
- ✅ **Type safety**: Optional `targetSchema` for cross-CoValue validation
- ✅ **Schema independence**: Each CoValue has its own schema (composable)
- ✅ **Lazy validation**: Format checked immediately, existence/type checked on access
- ✅ **CRDT-native**: Co-id references work seamlessly with CoJSON sync
- ✅ **Maintainability**: Pattern validation centralized in AJV layer

**Note**: Circular references are allowed (e.g., Todo → User, User → Todo list) because validation is lazy.

---

### Three Levels of $ref Validation in AJV

When you use `{"$ref": "co_z..."}` in a schema, AJV automatically performs **three levels of validation**:

**Level 1: Pattern Validation** ✅
```javascript
// Check: Is this a valid co-id format?
/^co_z[a-zA-Z0-9]+$/.test("co_zTodoList789...")  // Must pass
```

**Level 2: Existence Validation** ✅
```javascript
// Check: Does this CoValue exist in storage?
const coValue = await coValueStore.get("co_zTodoList789...");
if (!coValue) throw new Error("CoValue not found");
```

**Level 3: Schema Validation** ✅
```javascript
// Check: Does the referenced CoValue's data match its schema?
const schemaCoId = coValue._headerMeta.$schema;  // Get schema from HeaderMeta
const schema = await schemaRegistry.get(schemaCoId);
ajv.validate(schema, coValue.data);  // Validate data against schema
```

**All three levels happen transparently** when you call `ajv.validate()`! You just write:

```javascript
// Your schema
const projectSchema = {
  "type": "comap",
  "properties": {
    "todos": {"$ref": "co_zTodoList789..."}  // That's it!
  }
};

// Validate data
await ajv.validate(projectSchema, projectData);
// ✅ Pattern checked
// ✅ Existence checked
// ✅ Schema validated
```

**No manual validation needed** - AJV handles everything!

---

### Example: Composable Schemas (Co-Types as Standalone Schemas)

**Key Rule**: Every time a property is a **co-type**, it becomes its **own standalone schema** with its **own co-id**.

**Important**: No `id` property needed! Every CoValue automatically has `coValue.id` (auto-generated, content-addressable). Don't store it redundantly in the data.

**❌ WRONG (nested inline definitions + redundant id):**
```json
{
  "type": "comap",
  "properties": {
    "id": {"$ref": "co_z..."},  // ❌ Redundant! Use coValue.id instead
    "todos": {
      "type": "colist",  // ❌ Can't nest co-type definitions!
      "items": {"$ref": "co_z..."}
    }
  }
}
```

**✅ CORRECT (split into separate composable schemas - no id property!):**

```javascript
// Schema 1: User (comap - simple properties only)
{
  "$schema": "co_zMetaSchemaId123...",
  "type": "comap",
  "properties": {
    // Note: No "id" property - use user.id to access co-id!
    "name": {"type": "string"},
    "email": {"type": "string", "format": "email"}
  }
}
// Creates CoValue with auto-generated co-id: co_zUser456...
// Access via: user.id (always available!)

// Schema 2: TodoList (colist - standalone)
{
  "$schema": "co_zMetaSchemaId123...",
  "type": "colist",
  "items": {"$ref": "co_zTodo012..."}  // ✅ $ref to Todo schema
}
// Creates CoValue with co-id: co_zTodoList789...

// Schema 3: Todo (comap - references User)
{
  "$schema": "co_zMetaSchemaId123...",
  "type": "comap",
  "properties": {
    "text": {"type": "string"},
    "done": {"type": "boolean"},
    "assignee": {"$ref": "co_zUser456..."}  // ✅ $ref to User schema
  }
}
// Creates CoValue with co-id: co_zTodo012...

// Schema 4: Project (comap - references User and TodoList)
{
  "$schema": "co_zMetaSchemaId123...",
  "type": "comap",
  "properties": {
    "name": {"type": "string"},
    "owner": {"$ref": "co_zUser456..."},    // ✅ $ref to User schema
    "todos": {"$ref": "co_zTodoList789..."}  // ✅ $ref to TodoList schema
  }
}
// Creates CoValue with co-id: co_zProject345...
```

**How it works:**

1. **Each co-type = Separate CoValue = Separate schema**:
   - TodoList is a CoList → Gets its own schema → Gets its own co-id
   - Project references TodoList via `$ref: "co_zTodoList789..."` (native JSON Schema!)

2. **Composition via native $ref**:
   ```javascript
   // Create User
   const user = account.createMap({
     name: "Alice",
     email: "alice@example.com"
   }, {$schema: userSchemaCoId});
   // user.id → "co_zUser456..."
   
   // Create TodoList
   const todoList = account.createList([], {$schema: todoListSchemaCoId});
   // todoList.id → "co_zTodoList789..."
   
   // Create Project (references User and TodoList)
   const project = account.createMap({
     name: "MaiaOS",
     owner: user.id,      // ✅ Stores co-id string (validated via $ref)
     todos: todoList.id   // ✅ Stores co-id string (validated via $ref)
   }, {$schema: projectSchemaCoId});
   ```

3. **No redundant id property**:
   ```javascript
   // ❌ WRONG (storing id redundantly)
   const todo = account.createMap({
     id: todo.id,  // ❌ Redundant! Already available via todo.id
     title: "Setup MaiaOS"
   }, {$schema: todoSchemaCoId});
   
   // ✅ CORRECT (no id property)
   const todo = account.createMap({
     title: "Setup MaiaOS"  // ✅ Just the data!
   }, {$schema: todoSchemaCoId});
   
   // Access co-id when needed:
   console.log(todo.id);  // "co_z9h5nwiNynbxnC3nTw..." (auto-generated!)
   
   // Store reference to another CoValue:
   const project = account.createMap({
     name: "MaiaOS",
     todos: todoList.id  // ✅ Store the co-id reference here
   }, {$schema: projectSchemaCoId});
   ```

4. **No inline co-type nesting** - primitives and $ref only:
   ```json
   {
     "type": "comap",
     "properties": {
       "name": {"type": "string"},              // ✅ Primitive
       "count": {"type": "integer"},            // ✅ Primitive
       "active": {"type": "boolean"},           // ✅ Primitive
       "tags": {"$ref": "co_zTagList123..."}    // ✅ $ref to TagList schema
     }
   }
   ```

4. **AJV handles full $ref validation automatically**:
   - ✅ **Pattern validation**: Checks `^co_z[a-zA-Z0-9]+$` format
   - ✅ **Existence validation**: Verifies CoValue exists in storage
   - ✅ **Schema validation**: Looks up CoValue's schema (via HeaderMeta) and validates its data
   - All validation happens transparently when you call `ajv.validate(schema, data)`

**Benefits:**
- ✅ **Simpler**: Each schema is flat (no nested co-type definitions)
- ✅ **Native JSON Schema**: Uses standard `$ref` (no custom `co-id` type!)
- ✅ **Full validation in AJV**: Pattern + existence + schema validation (all automatic!)
- ✅ **Zero boilerplate**: Just `{"$ref": "co_z..."}` - AJV does everything
- ✅ **Composable**: Mix and match schemas via `$ref`
- ✅ **Reusable**: Same TodoList schema can be referenced by multiple Projects
- ✅ **Self-describing**: Each CoValue knows its schema (via HeaderMeta)
- ✅ **Content-addressable**: All co-ids auto-generated

---

### Example: Current MaiaScript Todos Schema → CoJSON

**Current Todos Schema (maia-schemata):**
```javascript
// libs/maia-schemata/src/schemas/todos.json (current)
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://maia.city/schemas/todos",
  "type": "object",
  "title": "Todo Item",
  "properties": {
    "id": {"type": "string"},  // ❌ Redundant - will be removed!
    "title": {"type": "string"},
    "done": {"type": "boolean", "default": false},
    "priority": {"type": "number", "default": 0}
  },
  "required": ["id", "title"]
}
```

**Migrated Todos Schema (with co-ids - No Boilerplate):**
```javascript
// libs/maia-schemata/src/schemas/todos.json (after migration)
{
  "$schema": "co_zMetaSchemaId123...",  // Co-id ref to meta schema CoMap
  // Note: CoValue.id is auto-generated (content-addressable hash)
  "type": "comap",  // Root is CoMap (not "object")
  "title": "Todo Item",
  "properties": {
    // Note: No "id" property needed - use todo.id to access co-id!
    "title": {"type": "string"},
    "done": {"type": "boolean", "default": false},
    "priority": {"type": "number", "default": 0}
  },
  "required": ["title"]
}
```

**Seeding Example:**
```javascript
// When seeding, schema itself is a CoMap
const todoSchemaCoMap = account.createMap({
  "$schema": metaSchemaCoId,  // Co-id reference
  // Note: Schema's co-id is auto-generated (accessed via todoSchemaCoMap.id)
  "type": "comap",
  "title": "Todo Item",
  "properties": {
    // Note: No "id" property - use todo.id to access co-id!
    "title": {"type": "string"},
    "done": {"type": "boolean", "default": false},
    "priority": {"type": "number", "default": 0}
  },
  "required": ["title"]
}, {
  $schema: metaSchemaCoId  // HeaderMeta reference
});

// Co-id is automatically generated: todoSchemaCoMap.id
// (content-addressable hash of the CoMap content)

// Now create todo instances using this schema
const todo1 = account.createMap({
  // Note: No "id" needed - automatically accessible via todo1.id!
  title: "Setup MaiaOS",
  done: false,
  priority: 5
}, {
  $schema: todoSchemaCoMap.id  // Reference to todo schema CoMap (auto-generated)
});

// Access the co-id:
console.log(todo1.id);  // "co_z9h5nwiNynbxnC3nTw..." (auto-generated!)

// Store reference to another CoValue:
const project = account.createMap({
  name: "MaiaOS",
  todos: todoList.id  // ✅ Store the co-id reference
}, {
  $schema: projectSchemaCoMap.id
});
```

**Benefits:**
- ✅ **Schemas are CoValues**: Can sync, version, and validate like any other data
- ✅ **Universal co-id refs**: Same pattern for schema refs and entity refs
- ✅ **Zero boilerplate**: Just `{"$ref": "co_z..."}` - no manual IDs, no id property!
- ✅ **Content-addressable**: Co-ids are auto-generated (immutable hash of content)
- ✅ **No redundant id property**: Access co-id via `coValue.id` (always available!)
- ✅ **Self-describing**: Co-id value carries its own schema (via HeaderMeta)
- ✅ **No URI resolution**: Direct co-id lookups (faster, simpler)

---

### 4. Everything Is a CoValue (Dependency-Driven)

**Key Insight**: In MaiaOS, **EVERYTHING becomes a CoValue**:

| Type | Example | Runtime Editable? |
|------|---------|-------------------|
| Context | Actor context/config | ✅ Yes |
| Styles | `.style.maia` files | ✅ Yes |
| Views | `.view.maia` files | ✅ Yes |
| State | Local actor state | ✅ Yes |
| Schemas | Schema definitions | ✅ Yes |
| Tools | Tool definitions | ✅ Yes |
| Data | Todo items, users | ✅ Yes |

**Why This Matters:**
- ✅ **All files are CoValues** → All files sync, version, and update reactively
- ✅ **Runtime editing** → Edit actors, styles, schemas in real-time!
- ✅ **End-to-end reactivity** → Change a style CoMap → Styled actors re-render!
- ✅ **CRDT-native** → CoValues can be local, remote, synced anywhere

**Subscription Architecture (Dependency-Driven):**

Each actor declares its dependencies in its context (all are CoValues):

```javascript
// TodoList actor context
{
  // Data dependency (todos)
  todos: {schema: "@schema/todos"},
  
  // Style dependency (styling rules)
  style: {schema: "@schema/todo-style"},
  
  // View dependency (template)
  view: {schema: "@schema/todo-view"},
  
  // State dependency (local state)
  state: {schema: "@schema/todo-state"}
}

// SubscriptionEngine subscribes to EACH dependency
// When ANY CoValue with these schemas changes → actor re-renders
```

**Benefits:**
- ✅ **Fine-grained** - Only re-render when YOUR dependencies change
- ✅ **Efficient** - Don't re-render on unrelated changes
- ✅ **CRDT-friendly** - Each CoValue syncs independently (local/remote transparent)

---

### 5. Seeding Process

**Current (IndexedDB):**
```javascript
// Seed todos collection
await backend.create('todos', {
  id: nanoid(),
  title: "Setup MaiaOS",
  done: false
});
// Result: Plain object in IndexedDB
```

**Needed (CoJSON):**
```javascript
// Seed todos collection
const todoCoMap = await backend.create('todos', {
  title: "Setup MaiaOS",
  done: false
});
// Result: CoMap with co-id, stored via CoJSON
```

**Challenge**: Seed operation must:
1. Get or create default group (**Note**: For now, use ONE default group for everything - keep it simple!)
2. Create CoValues instead of plain objects
3. Validate data against schema (same as before)
4. Return co-id references for tracking

### 4. Query Interface

**Current (IndexedDB):**
```javascript
// Query by schema
const todos = await maia.db({op: 'query', schema: 'todos'});
// Result: [{id, title, done}, {id, title, done}, ...]
```

**Needed (CoJSON):**
```javascript
// Query by schema (same API)
const todos = await maia.db({op: 'query', schema: 'todos'});
// Result: [{id: 'co_z...', title, done}, {id: 'co_z...', title, done}, ...]
// Behind the scenes: queries CoValues, extracts properties
```

**Challenge**: Query operation must:
1. Query CoValues by schema (using `headerMeta.$schema`)
2. Extract properties from CoMap/CoList/etc. into plain objects
3. Return same structure as before (for compatibility)
4. Support filters on CoValue properties

### 5. Actor-Based Subscription Architecture (Dependency-Driven)

**Critical**: The actor-based subscription system works perfectly end-to-end. We **MUST preserve** this architecture and only swap the backend implementation.

**Key Insight**: In a CRDT world, actors don't subscribe to the "entire account" - they subscribe to their **explicit dependencies** (all CoValues):

```javascript
// Each actor declares its dependencies (all are CoValues):
Actor "TodoList" depends on:
  ├─ context.comap      // Actor context/config
  ├─ style.comap        // Styling rules
  ├─ view.comap         // View template
  ├─ state.comap        // Local state
  └─ data query         // e.g., todos.colist

// When ANY dependency changes → actor re-renders
// CRDT magic: CoValues can be local, remote, synced anywhere!
```

**Benefits of Dependency-Driven Subscriptions:**
- ✅ **Fine-grained reactivity** - Only re-render when YOUR dependencies change
- ✅ **CRDT-native** - Each CoValue syncs independently (local/remote doesn't matter)
- ✅ **Efficient** - Don't re-render on unrelated changes
- ✅ **Distributed-first** - CoValues can fly anywhere, actor doesn't care about location

#### Current Subscription Flow (Working Perfectly)

```
Actor Context (defines queries)
  ↓
SubscriptionEngine.initialize(actor)
  ├─ Scans context for query objects: {schema: "@schema/todos"}
  ├─ Calls dbEngine.execute({op: 'query', schema, callback})
  └─ Stores unsubscribe functions
  ↓
DBEngine → QueryOperation
  ├─ Routes to backend.subscribe(schema, filter, callback)
  └─ Returns unsubscribe function
  ↓
IndexedDBBackend.subscribe()
  ├─ Observer pattern: Map of callbacks by schema
  ├─ Immediately calls callback with current data
  └─ Calls callback on create/update/delete
  ↓
SubscriptionEngine._handleDataUpdate()
  ├─ Updates actor.context[key] with new data
  ├─ Batches re-renders (microtask batching)
  └─ Calls actorEngine.rerender(actorId)
  ↓
Actor re-renders with new data (View updates)
```

#### What Changes (Backend Layer Only)

**UNCHANGED (Actor Layer):**
- ✅ SubscriptionEngine (no modifications)
- ✅ Actor context queries (no changes)
- ✅ Batched re-render logic (no changes)
- ✅ Subscription lifecycle management (no changes)

**UNCHANGED (Routing Layer):**
- ✅ DBEngine (no modifications)
- ✅ QueryOperation (no modifications)
- ✅ `maia.db({op: 'query', callback})` API (no changes)

**CHANGED (Backend Implementation Only):**
- ❌ IndexedDBBackend.subscribe() → **REPLACED**
- ✅ CoJSONBackend.subscribe() → **NEW** (uses CoJSON subscriptions)

#### New Subscription Flow (Dependency-Driven)

```
Actor Context (declares dependencies - ALL are CoValues)
  context: {
    todos: {schema: "@schema/todos"},      // Data dependency
    myStyle: {schema: "@schema/style"},    // Style CoMap dependency
    myView: {schema: "@schema/view"},      // View CoMap dependency
    myState: {schema: "@schema/state"}     // State CoMap dependency
  }
  ↓
SubscriptionEngine.initialize(actor) [NO CHANGES]
  ├─ Scans context for ALL dependencies (queries)
  ├─ Each dependency is a schema query (data, style, view, state, etc.)
  └─ Subscribes to each dependency via dbEngine
  ↓
DBEngine → QueryOperation [NO CHANGES]
  ↓
CoJSONBackend.subscribe(schema, filter, callback) [NEW IMPLEMENTATION]
  ├─ Query all CoValues matching schema (e.g., todos, styles, etc.)
  ├─ For each matching CoValue:
  │   ├─ Check oSubscriptionCache for existing subscription
  │   ├─ If not cached: coValue.subscribe(callback) → store in cache
  │   └─ Aggregate callbacks into single notification
  ├─ Subscribe to CoValue collection changes (new CoValues with this schema)
  └─ Return unsubscribe function (cleans up all CoValue subscriptions)
  ↓
CoJSON Native Subscriptions (per dependency)
  ├─ coValue.subscribe(listener) → reactive updates per CoValue
  ├─ oSubscriptionCache → deduplication + auto-cleanup
  └─ Calls callback when any subscribed CoValue changes
  ↓
SubscriptionEngine._handleDataUpdate() [NO CHANGES]
  ├─ Updates actor.context[key] with new data
  ├─ Batches re-renders (only if THIS actor's dependencies changed)
  └─ Calls actorEngine.rerender(actorId)
  ↓
Actor re-renders (only when ITS dependencies change) [NO CHANGES]
```

**Key Insight**: Each actor subscribes to its own dependencies (context, style, view, state, data). When ANY of those CoValues change → actor re-renders. No "entire account" subscription needed!

#### CoJSONBackend.subscribe() Implementation Strategy

**Key Requirements:**
1. **Schema-based subscription** - Subscribe to ALL CoValues with matching `headerMeta.$schema`
2. **Aggregated callbacks** - Multiple CoValue changes → single callback with full dataset
3. **Dynamic additions** - Detect when new CoValues with THIS schema are added
4. **Everything is a CoValue** - Data, styles, views, state, context - all are CoValues!
5. **Dependency-driven** - Actors subscribe to their specific dependencies (not entire account)
6. **Efficient caching** - Reuse CoValue subscriptions via `oSubscriptionCache`
7. **Proper cleanup** - Unsubscribe from all CoValues when subscription ends

**Example Implementation:**
```javascript
// CoJSONBackend.subscribe(schema, filter, callback)
subscribe(schema, filter, callback) {
  const subscriptions = [];
  const activeCoValues = new Set();
  
  // Helper: Aggregate all CoValues and notify callback
  const notifyCallback = async () => {
    const allData = [];
    for (const coId of activeCoValues) {
      const coValue = this.getCoValue(coId);
      if (coValue) {
        const data = this._extractCoValueData(coValue);
        allData.push(data);
      }
    }
    
    // Apply filter if provided
    const filtered = filter ? this._applyFilter(allData, filter) : allData;
    callback(filtered);
  };
  
  // Step 1: Query all existing CoValues with matching schema
  const existingCoValues = await this._queryBySchema(schema);
  
  // Step 2: Subscribe to each CoValue (using oSubscriptionCache)
  for (const coValue of existingCoValues) {
    activeCoValues.add(coValue.id);
    
    // Use cache to avoid duplicate subscriptions
    const sub = this.subscriptionCache.getOrCreate(coValue.id, () => {
      return coValue.subscribe(() => notifyCallback());
    });
    
    subscriptions.push(() => this.subscriptionCache.scheduleCleanup(coValue.id));
  }
  
  // Step 3: Subscribe to CoValue collection changes (new CoValues with THIS schema)
  // Instead of subscribing to entire account, subscribe to the specific collection
  // that holds CoValues with this schema (e.g., todos collection, styles collection)
  //
  // Note: The mechanism depends on how CoJSON exposes collection changes.
  // Options:
  // A) Subscribe to a "registry" CoMap that tracks all CoValues by schema
  // B) Subscribe to account but filter by schema (more generic)
  // C) Use a schema-specific collection (if available)
  //
  // For now, using approach B (account-level with schema filter):
  const collectionSub = this.account.subscribe(() => {
    // Check for new CoValues with matching schema
    const newCoValues = this._findNewCoValues(schema, activeCoValues);
    
    if (newCoValues.length > 0) {
      for (const coValue of newCoValues) {
        activeCoValues.add(coValue.id);
        
        const sub = this.subscriptionCache.getOrCreate(coValue.id, () => {
          return coValue.subscribe(() => notifyCallback());
        });
        
        subscriptions.push(() => this.subscriptionCache.scheduleCleanup(coValue.id));
      }
      
      notifyCallback();
    }
  });
  
  subscriptions.push(() => collectionSub());
  
  // Step 4: Immediately call callback with current data
  notifyCallback();
  
  // Step 5: Return unsubscribe function
  return () => {
    subscriptions.forEach(unsub => unsub());
  };
}
```

#### Benefits of This Approach

**✅ Actor layer stays pure:**
- SubscriptionEngine has zero knowledge of CoJSON
- Actors just define queries in context
- No changes to actor-based subscription logic

**✅ Efficient subscription caching:**
- `oSubscriptionCache` prevents duplicate subscriptions
- Multiple actors querying same schema → reuse CoValue subscriptions
- Auto-cleanup prevents memory leaks

**✅ Dynamic reactivity:**
- New CoValues added → automatically subscribed
- Deleted CoValues → automatically cleaned up
- Real-time updates flow through unchanged SubscriptionEngine

**✅ Batched re-renders preserved:**
- SubscriptionEngine's microtask batching unchanged
- Multiple CoValue updates → single re-render
- Performance characteristics maintained

---

## Subscription Architecture Summary

### Complete Reactive Flow (Preserved End-to-End)

```
┌─────────────────────────────────────────────────────────────────┐
│ ACTOR LAYER (UNCHANGED)                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Actor Context:                                                 │
│  {                                                               │
│    todos: {schema: "@schema/todos"}  ← Query declaration       │
│  }                                                               │
│                                                                  │
│  SubscriptionEngine.initialize(actor)                           │
│  ├─ Scans context for queries                                   │
│  ├─ Creates subscription: dbEngine.execute({op: 'query', ...}) │
│  └─ Stores unsubscribe functions                                │
│                                                                  │
│  SubscriptionEngine._handleDataUpdate(actorId, key, data)      │
│  ├─ Updates actor.context[key] = data                           │
│  ├─ Batches re-renders (microtask)                              │
│  └─ Calls actorEngine.rerender(actorId)                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ ROUTING LAYER (UNCHANGED)                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  DBEngine.execute({op: 'query', schema, callback})             │
│  ├─ Routes to QueryOperation                                    │
│  └─ Returns unsubscribe function                                │
│                                                                  │
│  QueryOperation.execute({schema, callback})                     │
│  ├─ Detects callback → reactive query                           │
│  └─ Calls backend.subscribe(schema, filter, callback)           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND LAYER (REPLACED: IndexedDB → CoJSON)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  OLD: IndexedDBBackend.subscribe(schema, filter, callback)     │
│  ├─ Observer pattern (Map of callbacks)                         │
│  ├─ Immediately calls callback with current data                │
│  └─ Calls callback on create/update/delete                      │
│                                                                  │
│  ───────────────────────────────────────────────────────────   │
│                                                                  │
│  NEW: CoJSONBackend.subscribe(schema, filter, callback)        │
│  ├─ Query all CoValues matching schema                          │
│  ├─ For each CoValue:                                            │
│  │   ├─ Check oSubscriptionCache (deduplicate)                  │
│  │   ├─ coValue.subscribe(listener) [CoJSON native]            │
│  │   └─ Store subscription in cache                             │
│  ├─ Subscribe to account.Data (detect new CoValues)            │
│  ├─ Aggregate callbacks (multiple CoValues → single notify)    │
│  ├─ Immediately calls callback with current data                │
│  └─ Returns unsubscribe function                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ COJSON LAYER (NEW - CRDT Infrastructure)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CoValue.subscribe(listener)                                    │
│  ├─ Native CoJSON subscription                                  │
│  ├─ Calls listener on any CRDT operation                        │
│  └─ Efficient delta updates (only changed data)                 │
│                                                                  │
│  oSubscriptionCache                                             │
│  ├─ Deduplication (reuse subscriptions)                         │
│  ├─ Auto-cleanup (5-second timeout)                             │
│  └─ Memory leak prevention                                      │
│                                                                  │
│  Account.Data.subscribe()                                       │
│  ├─ Detects new CoValues added to Data list                     │
│  └─ Triggers subscription to new CoValues                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                      Data Changes
                            ↓
          (Flow reverses - callbacks fire upward)
                            ↓
          SubscriptionEngine._handleDataUpdate()
                            ↓
                   Actor re-renders
                            ↓
                    View updates
```

### Key Insights

**What Changes:**
- 🔄 **Backend implementation only** - IndexedDB → CoJSON subscriptions
- 🔄 **Storage layer** - Plain objects → CoValues (CoMap, CoList, etc.)

**What Stays the Same:**
- ✅ **Actor layer** - SubscriptionEngine, context queries, batched re-renders
- ✅ **Routing layer** - DBEngine, QueryOperation, `maia.db()` API
- ✅ **Reactivity flow** - End-to-end from CoValue changes to View updates
- ✅ **Developer experience** - Same APIs, same patterns, same mental model

**Integration Point:**
- The **ONLY** integration point is `CoJSONBackend.subscribe()`
- This method bridges the gap between:
  - **Upper layers** (SubscriptionEngine expects IndexedDB-style callbacks)
  - **Lower layers** (CoJSON provides native CRDT subscriptions)
- All complexity is encapsulated in this single method

---

## Solution Approach

### Key Principles

**1. Simplified Group Management**
- 🎯 **One default group for everything** - No complex group management initially
- 🎯 **All CoValues in same group** - Actors, styles, schemas, data - all in one place
- 🎯 **Easier to reason about** - No group hierarchy, no cross-group references
- 🎯 **Simplify later if needed** - Can add group management as future enhancement

**2. Everything Is a CoValue (Dependency-Driven Subscriptions)**
- 🎯 **All files are CoValues** - Context, styles, views, state, schemas, tools, data
- 🎯 **Actors declare dependencies** - Each actor lists its specific CoValue dependencies
- 🎯 **Subscribe to dependencies only** - Only re-render when YOUR dependencies change
- 🎯 **All runtime editable** - Change any CoValue → dependent actors re-render
- 🎯 **CRDT-native** - CoValues can be local, remote, synced - actor doesn't care!

**Why This Matters:**
In a distributed CRDT world, CoValues can fly anywhere (locally cached, remotely stored, synced across devices). Actors subscribe to their **specific dependencies** (context, style, view, state, data), not the entire account. This enables:
- ✅ Fine-grained reactivity (efficient re-renders)
- ✅ Distributed-first architecture (location-transparent)
- ✅ Runtime editing of all files (change style → dependent actors update)

---

### Strategy: Incremental Backend Swap with Interface Preservation

We'll create a **CoJSONBackend** adapter that implements the same interface as `IndexedDBBackend` but uses CoJSON under the hood. This allows us to swap backends without changing any maia-script code.

**Key Insight**: The `DBEngine` doesn't care what backend it uses, as long as the backend implements:
- `init()` - Initialize storage
- `seed(configs, schemas, data)` - Seed initial data
- `create(schema, data)` - Create record
- `query(schema, filter)` - Query records
- `update(schema, id, updates)` - Update record
- `delete(schema, id)` - Delete record
- `subscribe(schema, filter, callback)` - Subscribe to changes

**Architecture:**
```
maia.db({op: 'create', schema: 'todos', data: {...}})
  ↓
DBEngine.execute() [NO CHANGES]
  ↓
CreateOperation.execute() [NO CHANGES]
  ↓
CoJSONBackend.create() [NEW - replaces IndexedDBBackend]
  ↓
createCoMap(group, data, schema) [EXISTING - from maia-db]
  ↓
CoJSON stores via CRDT (internal)
```

---

## Implementation Milestones

### Milestone 1: Create CoJSONBackend Adapter (Foundation)

**Goal**: Implement `CoJSONBackend` class that wraps maia-db's CoJSON engine with same interface as `IndexedDBBackend`.

**Critical**: The backend must implement the exact same interface as IndexedDB backend so that SubscriptionEngine and all upper layers remain unchanged.

**Tasks:**
- [ ] Create `libs/maia-script/src/o/engines/db-engine/backend/cojson.js`
- [ ] Implement `CoJSONBackend` class with IndexedDB-compatible interface:
  ```javascript
  class CoJSONBackend {
    async init() { ... }                              // Initialize CoJSON
    async seed(configs, schemas, data) { ... }        // Seed initial data
    async create(schema, data) { ... }                // Create entity
    async query(schema, filter) { ... }               // Query entities
    async update(schema, id, updates) { ... }         // Update entity
    async delete(schema, id) { ... }                  // Delete entity
    subscribe(schema, filter, callback) { ... }       // Reactive subscriptions (CRITICAL)
  }
  ```
- [ ] Implement `init()`:
  - Initialize CoJSON node (from maia-db)
  - Create or load account
  - Get or create default group (**Note**: ONE default group for everything!)
  - Initialize `oSubscriptionCache` for subscription management
- [ ] Implement basic CRUD operations:
  - [ ] `create()` - Wrapper around `cojson({op: 'create', coType: 'comap', ...})`
  - [ ] `query()` - Wrapper around `cojson({op: 'query', schema, filter})`
  - [ ] `update()` - Wrapper around `cojson({op: 'update', id, updates})`
  - [ ] `delete()` - Wrapper around `cojson({op: 'delete', id})`
- [ ] Implement `seed()`:
  - Create schema CoMaps (with `@meta-schema`)
  - Create config CoMaps (actors, views, styles, etc.)
  - Create initial data CoMaps (empty todos list, etc.)
- [ ] Implement `subscribe()` (STUB for now, full implementation in Milestone 4):
  - [ ] Query matching CoValues
  - [ ] Return unsubscribe function
  - [ ] TODO: Full reactive implementation in Milestone 4

**Cleanup & Migration:**
- [ ] NO legacy code to remove yet (IndexedDB backend stays for now)
- [ ] Add feature flag to kernel: `config.useCoJSONBackend` (defaults to `false`)

**Manual Browser Debugging:**
- [ ] Open todo vibe app in Cursor browser
- [ ] Check console: Verify CoJSON backend can initialize
- [ ] Check network: No errors
- [ ] Verify: Todo app still loads (using IndexedDB backend with feature flag off)

**Human Checkpoint:** ✋ Test that CoJSON backend can initialize without breaking existing app

---

**Note on Subscriptions:**

The `subscribe()` method is **critical** for preserving the actor-based subscription architecture. In this milestone, we implement a basic stub. In Milestone 4, we implement the full reactive flow using CoJSON subscriptions + oSubscriptionCache.

**Subscription Interface (must match IndexedDB):**
```javascript
// Subscribe to schema changes
subscribe(schema, filter, callback) {
  // 1. Query all CoValues matching schema
  // 2. Subscribe to each CoValue (use oSubscriptionCache)
  // 3. Aggregate callbacks (multiple CoValues → single callback)
  // 4. Immediately call callback with current data
  // 5. Return unsubscribe function
}
```

---

### Milestone 2: Extend JSON Schema with Co-Types

**Goal**: Extend JSON Schema to support co-types as native types, allow nested co-types, and extend AJV for validation.

**Tasks:**
- [ ] Update `libs/maia-db/src/schemas/meta-schema.js`:
  - Add `coTypes` to `$defs`: `["comap", "colist", "costream", "cotext", "co-id"]`
  - Update `type` property to accept co-types: `anyOf: [simpleTypes, coTypes]`
  - Allow nested co-types in properties/items
  - Enforce root type MUST be a co-type (no plain object/array at root)
  - Change `$schema` to use `co-id` type (not URI/string)
  - Remove `$id` property (auto-generated as content-addressable hash!)
  - Meta schema itself is a CoMap with auto-generated co-id
- [ ] Extend AJV with custom co-type validation:
  - Add custom keyword: `comap` (validates object structure)
  - Add custom keyword: `colist` (validates array structure)
  - Add custom keyword: `costream` (validates append-only stream)
  - Add custom keyword: `cotext` (validates plain text)
  - Validate co-id references (`co_z...`) format
- [ ] Update `libs/maia-schemata/src/schemas/*.json`:
  - Change `"type": "object"` → `"type": "comap"`
  - Change `"type": "array"` → `"colist"` (where appropriate)
  - Split co-types into separate schemas (no inline nesting!)
  - Use native `$ref` for ALL references: `{"$ref": "co_z..."}`
  - Change `$schema` from URI to co-id: `"$schema": "co_zMetaSchemaId..."`
  - Remove all `$id` fields (auto-generated as content-addressable hash!)
  - Remove all `id` properties from schemas (redundant - use `coValue.id`!)
  - Remove all `targetSchema` hints (not needed - $ref is self-describing!)
- [ ] Update schema validation in `libs/maia-db/src/schemas/validation.js`:
  - Validate root type is a co-type
  - Validate nested co-types recursively
  - Validate co-id references point to valid CoValues

**Example Schema Updates:**

```javascript
// Before: Plain object schema
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://maia.city/schemas/todos",
  "type": "object",
  "properties": {
    "title": {"type": "string"},
    "done": {"type": "boolean"}
  }
}

// After: CoMap schema
{
  "$schema": "https://maia.city/{metaSchemaCoId}",
  "$id": "https://maia.city/schemas/todos",
  "type": "comap",  // Native co-type (not "object")
  "properties": {
    "title": {"type": "string"},
    "done": {"type": "boolean"}
  }
}

// After: CoMap with nested CoList and co-id references
{
  "$schema": "https://maia.city/{metaSchemaCoId}",
  "$id": "https://maia.city/schemas/project",
  "type": "comap",
  "properties": {
    "name": {"type": "string"},
    "todos": {
      "type": "colist",  // Nested co-type
      "items": {
        "type": "co-id",  // Co-id type (abstracted)
        "targetSchema": "https://maia.city/schemas/todo"  // Optional hint
      }
    }
  }
}
```

**AJV Extension Implementation:**

```javascript
// libs/maia-db/src/schemas/ajv-co-types.js
export function addCoTypeKeywords(ajv) {
  // Add 'comap' keyword
  ajv.addKeyword({
    keyword: 'comap',
    validate: (schema, data) => {
      return typeof data === 'object' && !Array.isArray(data);
    }
  });
  
  // Add 'colist' keyword
  ajv.addKeyword({
    keyword: 'colist',
    validate: (schema, data) => {
      return Array.isArray(data);
    }
  });
  
  // Add 'costream' keyword (append-only validation)
  ajv.addKeyword({
    keyword: 'costream',
    validate: (schema, data) => {
      return Array.isArray(data); // Stream is like list but append-only
    }
  });
  
  // Add 'cotext' keyword
  ajv.addKeyword({
    keyword: 'cotext',
    validate: (schema, data) => {
      return typeof data === 'string';
    }
  });
  
  // Note: No custom co-id keyword needed!
  // We use native $ref with co-ids instead: {"$ref": "co_z..."}
  // AJV handles $ref resolution automatically via schema registry
}

// Configure AJV to resolve $ref by co-id with full validation
export function configureCoIdResolver(ajv, schemaRegistry, coValueStore) {
  // Register custom schema loader for co-id refs
  ajv.addSchema = function(schema) {
    // If schema has co-id in HeaderMeta, register it
    if (schema._headerMeta?.$schema) {
      const coId = schema.id; // Auto-generated co-id
      ajv.addSchema(schema, coId); // Register with co-id as key
    }
    return ajv;
  };
  
  // Custom $ref resolver for co-ids
  ajv.opts.loadSchema = async function(uri) {
    // 1. ✅ Pattern validation: Check if uri is a co-id
    if (!/^co_z[a-zA-Z0-9]+$/.test(uri)) {
      throw new Error(`Invalid co-id format: ${uri}`);
    }
    
    // 2. ✅ Existence validation: Check if CoValue exists in storage
    const coValue = await coValueStore.get(uri);
    if (!coValue) {
      throw new Error(`CoValue not found: ${uri}`);
    }
    
    // 3. ✅ Schema validation: Get schema from CoValue's HeaderMeta
    const schemaCoId = coValue._headerMeta.$schema;
    if (!schemaCoId) {
      throw new Error(`CoValue ${uri} has no schema reference`);
    }
    
    // 4. Load and return schema for validation
    const schema = await schemaRegistry.get(schemaCoId);
    if (!schema) {
      throw new Error(`Schema not found: ${schemaCoId}`);
    }
    
    return schema;
  };
}

// Usage Example:
const projectSchema = {
  "$schema": "co_zMetaSchemaId123...",
  "type": "comap",
  "properties": {
    "name": {"type": "string"},
    "todos": {"$ref": "co_zTodoList789..."}  // AJV validates this!
  }
};

const projectData = {
  name: "MaiaOS",
  todos: "co_zTodoList789..."  // Must match pattern, exist, and validate
};

// When you call validate, AJV automatically:
// 1. Checks pattern: "co_zTodoList789..." matches ^co_z[a-zA-Z0-9]+$
// 2. Checks existence: CoValue co_zTodoList789... exists in storage
// 3. Validates schema: TodoList CoValue's data validates against its schema
const valid = await ajv.validate(projectSchema, projectData);

// If any check fails, AJV throws detailed error:
// - "Invalid co-id format: xyz" (pattern fail)
// - "CoValue not found: co_z123" (existence fail)
// - "Data does not match schema" (schema validation fail)
```

**Cleanup & Migration:**
- [ ] Remove all `type: "object"` at root level (replace with `type: "comap"`)
- [ ] Remove all `type: "array"` at root level (replace with `type: "colist"`)
- [ ] Replace all manual co-id patterns (`"pattern": "^co_z"`) with native `$ref`
- [ ] Replace all URI-based schema refs with co-ids:
  - `$schema: "https://..."` → `$schema: "co_z..."`
- [ ] Remove ALL `$id` fields (auto-generated as content-addressable hash!)
- [ ] Remove ALL `id` properties (redundant - use `coValue.id`!)
- [ ] Remove ALL `targetSchema` hints (not needed - $ref is self-describing!)
- [ ] Split nested co-types into separate schemas (no inline definitions!)
- [ ] NO fallback logic for missing co-types
- [ ] NO URI resolution logic (all refs are direct co-ids)
- [ ] NO pattern checking boilerplate in schemas (AJV handles $ref)
- [ ] NO manual co-id assignment (system generates it automatically!)
- [ ] NO redundant id properties in data (access via `coValue.id`!)

**Manual Browser Debugging:**
- [ ] Open todo vibe app
- [ ] Check console: Verify schemas load successfully
- [ ] Check console: No schema validation errors
- [ ] Check: Schemas have `type: "comap"` (not `type: "object"`)

**Human Checkpoint:** ✋ Verify all schemas are valid with co-types as native types

---

### Milestone 3: Switch Todo Vibe to CoJSON Backend

**Goal**: Enable CoJSON backend for todo vibe app and verify full functionality.

**Tasks:**
- [ ] Update `libs/maia-script/src/o/kernel.js`:
  - Add `config.useCoJSONBackend` option (defaults to `false`)
  - Conditionally create `CoJSONBackend` vs `IndexedDBBackend`
- [ ] Update `libs/maia-vibes/src/todos/loader.js`:
  - Enable CoJSON backend: `useCoJSONBackend: true`
- [ ] Update seed operation in `CoJSONBackend.seed()`:
  - Create todos as CoMaps (not plain objects)
  - Store schema definitions as CoMaps with `@meta-schema`
  - Store configs as CoMaps (actors, views, styles, etc.)
- [ ] Test all CRUD operations:
  - [ ] Create todo (via `maia.db({op: 'create', schema: 'todos', data: {...}})`)
  - [ ] Query todos (via `maia.db({op: 'query', schema: 'todos'})`)
  - [ ] Update todo (via `maia.db({op: 'update', schema: 'todos', id, updates})`)
  - [ ] Delete todo (via `maia.db({op: 'delete', schema: 'todos', id})`)
  - [ ] Toggle todo (via `maia.db({op: 'toggle', schema: 'todos', id, field: 'done'})`)

**Cleanup & Migration:**
- [ ] Remove feature flag check in kernel (CoJSON backend becomes default)
- [ ] Mark `IndexedDBBackend` as deprecated (but keep for migration period)
- [ ] NO backwards compatibility layers - 100% CoJSON backend

**Manual Browser Debugging:**
- [ ] Open todo vibe app in Cursor browser
- [ ] Create a new todo → Check console for `co_z...` ID (not plain ID)
- [ ] Check Network tab: Verify CoJSON requests
- [ ] Check IndexedDB in DevTools: Verify CoJSON storage (not legacy structure)
- [ ] Test all CRUD operations:
  - Create todo: "Test todo 1"
  - Check: Does it appear in UI?
  - Toggle done: true
  - Check: Does it update in UI?
  - Delete todo
  - Check: Does it disappear from UI?

**Human Checkpoint:** ✋ Manually test todo vibe app - full CRUD cycle must work

---

### Milestone 4: Implement Reactive Subscriptions (Preserve Actor Architecture)

**Goal**: Reactive queries work with CoJSON backend while preserving actor-based subscription system.

**Critical Requirement**: SubscriptionEngine remains **completely unchanged**. Only CoJSONBackend.subscribe() implementation changes.

**Tasks:**
- [ ] Implement `CoJSONBackend.subscribe(schema, filter, callback)`:
  - [ ] Query all CoValues matching schema (via `_queryBySchema()`)
  - [ ] Subscribe to each CoValue using `coValue.subscribe(listener)`
  - [ ] Integrate `oSubscriptionCache` for subscription deduplication:
    - `cache.getOrCreate(coId, () => coValue.subscribe(...))`
    - Prevents duplicate subscriptions to same CoValue
    - Auto-cleanup after timeout (5 seconds default)
  - [ ] Subscribe to `account.Data` to detect NEW CoValues added dynamically
  - [ ] Aggregate callbacks: Multiple CoValue changes → single callback with full dataset
  - [ ] Apply filter if provided (same as IndexedDB backend)
  - [ ] Return unsubscribe function that:
    - Schedules cleanup for all CoValue subscriptions
    - Unsubscribes from account.Data
- [ ] Verify SubscriptionEngine integration:
  - [ ] `SubscriptionEngine.initialize(actor)` works unchanged
  - [ ] `SubscriptionEngine._handleDataUpdate()` receives aggregated data
  - [ ] Batched re-renders work unchanged
  - [ ] Subscription cleanup works unchanged

**Implementation Checklist:**
```javascript
// CoJSONBackend.subscribe() must match IndexedDB interface:
// - Same signature: subscribe(schema, filter, callback)
// - Immediately calls callback with current data
// - Calls callback on any CoValue change (create/update/delete)
// - Returns unsubscribe function
// - Handles schema filter (e.g., "@schema/todos")
```

**Cleanup & Migration:**
- [ ] Remove `IndexedDBBackend.subscribe()` observer pattern
- [ ] Remove `IndexedDBBackend.notifyObservers()` logic
- [ ] NO changes to SubscriptionEngine (verify untouched)
- [ ] NO changes to QueryOperation (verify untouched)
- [ ] NO backwards compatibility - 100% CoJSON subscriptions

**Manual Browser Debugging:**
- [ ] Open todo vibe app
- [ ] Check console: Verify SubscriptionEngine logs (unchanged)
- [ ] Check console: Verify oSubscriptionCache logs (new subscriptions)
- [ ] Create todo → Check: Actor re-renders immediately
- [ ] Toggle todo → Check: Actor re-renders immediately
- [ ] Delete todo → Check: Actor re-renders immediately
- [ ] Open DevTools: Check actor context (`window.todoActor.context.todos`)
  - Should contain up-to-date array of todos
  - Should update automatically on changes

**Advanced Testing (Multi-Tab Sync):**
- [ ] Open two browser tabs side-by-side
- [ ] Create todo in Tab 1 → Check: Appears in Tab 2 (testing CoJSON sync)
- [ ] Toggle todo in Tab 2 → Check: Updates in Tab 1
- [ ] Delete todo in Tab 1 → Check: Disappears in Tab 2

**Human Checkpoint:** ✋ Test reactive subscriptions - actor-based flow works perfectly, changes propagate immediately

---

**Why This Milestone is Critical:**

The actor-based subscription architecture is the **heart** of MaiaOS reactivity:
- **Context-driven**: Actors declare queries in context (no manual subscriptions)
- **Automatic batching**: Multiple updates → single re-render (microtask batching)
- **Lifecycle management**: Subscriptions tied to actor lifecycle (auto-cleanup)
- **Pure actors**: State machines stay pure (no subscription logic)

**CoJSON integration must be invisible** to the actor layer. If done correctly:
- ✅ SubscriptionEngine has zero CoJSON knowledge
- ✅ Actors work unchanged
- ✅ End-to-end reactivity maintained
- ✅ CoJSON subscriptions are just an implementation detail

---

### Milestone 5: Migrate DB Viewer to CoJSON Backend

**Goal**: DB viewer works with CoJSON backend (query and display CoValues).

**Tasks:**
- [ ] Update `services/maia-city/db-view.js`:
  - Switch to CoJSON backend (same as todo vibe)
  - Update query logic to handle CoValues
  - Display co-ids instead of plain IDs
  - Show CoValue metadata (type, schema, group, etc.)
- [ ] Test DB viewer:
  - [ ] View all CoValues (account structure navigation)
  - [ ] Click on CoValue → View properties
  - [ ] View CoMap properties (todos)
  - [ ] View CoList items (if any)
  - [ ] View CoStream items (if any)
  - [ ] View CoText content (if any)

**Cleanup & Migration:**
- [ ] Remove hardcoded schema registry (load schemas dynamically from CoJSON)
- [ ] NO backwards compatibility - 100% CoJSON backend

**Manual Browser Debugging:**
- [ ] Open db viewer (`/db-view`)
- [ ] Check: All CoValues listed (Account, Groups, Schemas, Todos, etc.)
- [ ] Click on Todo CoValue → Check: Properties displayed correctly
- [ ] Check console: No errors

**Human Checkpoint:** ✋ Manually explore DB viewer - all CoValues accessible

---

### Milestone 6: Documentation & Final Review

**Goal**: Document the upgraded architecture and verify everything works.

**Tasks:**
- [ ] Update developer docs:
  - [ ] `libs/maia-docs/developers/maia-script-api.md` - Document CoJSON backend
  - [ ] `libs/maia-docs/developers/schema-design.md` - Document `$coType` requirement
  - [ ] `libs/maia-docs/developers/crdt-architecture.md` - Explain CoJSON integration
- [ ] Update creator docs:
  - [ ] `libs/maia-docs/creators/schema-guide.md` - Explain co-types for creators
  - [ ] `libs/maia-docs/creators/data-modeling.md` - Examples with co-types
- [ ] Final manual testing:
  - [ ] Run all todo vibe tests
  - [ ] Run DB viewer tests
  - [ ] Verify no regressions

**Cleanup & Migration:**
- [ ] Delete `IndexedDBBackend` (fully replaced by CoJSON backend)
- [ ] Remove all feature flags and conditional logic
- [ ] Verify 100% migration complete

**Manual Browser Debugging:**
- [ ] Open todo vibe app
- [ ] Complete full CRUD cycle (create, read, update, delete)
- [ ] Check console: Verify real co-ids (not mocks)
- [ ] Check network: No errors
- [ ] Verify: App is fully functional

**Human Checkpoint:** ✋ Final approval - ready to ship! 🚀

---

## File Structure Changes

### New Files Created
```
libs/maia-script/src/o/engines/db-engine/backend/
  └── cojson.js                       # NEW - CoJSON backend adapter

libs/maia-docs/developers/
  └── crdt-architecture.md            # NEW - CoJSON integration docs

libs/maia-docs/creators/
  └── schema-guide.md                 # UPDATED - Co-type documentation
```

### Modified Files
```
libs/maia-db/src/schemas/
  ├── meta-schema.js                  # MODIFIED - Add $coType requirement
  └── validation.js                   # MODIFIED - Enforce co-type validation

libs/maia-schemata/src/schemas/
  └── *.json                          # MODIFIED - Add $coType to all schemas

libs/maia-script/src/o/
  └── kernel.js                       # MODIFIED - Support CoJSON backend

libs/maia-vibes/src/todos/
  └── loader.js                       # MODIFIED - Enable CoJSON backend

services/maia-city/
  └── db-view.js                      # MODIFIED - Query CoValues
```

### Deleted Files (After Migration Complete)
```
libs/maia-script/src/o/engines/db-engine/backend/
  └── indexeddb.js                    # DELETED - Replaced by cojson.js
```

---

## Testing Strategy

### Manual Browser Testing (Each Milestone)

For **every milestone**, use Cursor's browser for manual verification:

1. **Start dev server:**
   ```bash
   bun dev:app  # or bun dev (for all services)
   ```

2. **Open Cursor Browser:**
   - Open browser in Cursor IDE
   - Navigate to `http://localhost:4202/vibes/todos` (todo vibe)
   - Navigate to `http://localhost:4202/db-view` (db viewer)

3. **Console Check:**
   - Open DevTools Console
   - Look for:
     - ✅ Real co-ids: `co_z...` (not `mock_`, `test_`, etc.)
     - ✅ No JavaScript errors
     - ✅ Backend initialization messages

4. **Network Check:**
   - Open Network tab
   - Verify: Requests succeed (200-299)
   - No failed requests (4xx, 5xx)

5. **IndexedDB Check:**
   - Open Application → IndexedDB
   - Verify: CoJSON storage structure (transactions, ops, etc.)
   - NOT legacy structure (configs, schemas, data)

6. **Interaction Testing:**
   - Create todo → Check: Appears in UI
   - Toggle todo → Check: Updates in UI
   - Delete todo → Check: Disappears from UI
   - Open DB viewer → Check: CoValues listed

7. **Document Findings:**
   - Screenshot UI (if visual bugs)
   - Copy console errors (if any)
   - Note any unexpected behavior

**Remember**: This is **manual debugging**, NOT automated testing. Just verify core functionality works.

---

## Risks & Mitigation

### Risk 1: CoJSON Backend Performance

**Risk**: CoJSON operations might be slower than direct IndexedDB access.

**Mitigation**:
- Profile both backends (measure create/query/update times)
- Use CoJSON's batching API for bulk operations
- Cache frequently accessed CoValues

### Risk 2: Subscription Complexity

**Risk**: Subscribing to ALL CoValues with matching schema might be inefficient.

**Mitigation**:
- Implement lazy subscription (subscribe on first reactive query)
- Use `oSubscriptionCache` to reuse subscriptions
- Unsubscribe when components unmount

### Risk 3: Schema Migration

**Risk**: Existing schemas might not validate after adding `$coType` requirement.

**Mitigation**:
- Validate ALL schemas before migration
- Provide clear error messages for invalid schemas
- Create migration script to auto-add `$coType` to existing schemas

### Risk 4: Data Loss

**Risk**: Switching backends might lose existing user data.

**Mitigation**:
- Flush data only in development mode (seeding)
- Preserve user data during backend switch
- Implement data export/import for migration

---

## Benefits of This Architecture

### 1. Actor-Based Subscription System Preserved
- ✅ SubscriptionEngine remains completely unchanged
- ✅ Context-driven queries (actors declare queries in context)
- ✅ Automatic batching (microtask batching for multiple updates)
- ✅ Lifecycle management (subscriptions tied to actor lifecycle)
- ✅ Pure actors (state machines have no subscription logic)
- ✅ End-to-end reactivity maintained (Actor → View flow intact)

### 2. Efficient CoJSON Subscription Layer
- ✅ `oSubscriptionCache` prevents duplicate subscriptions
- ✅ Multiple actors querying same schema → reuse CoValue subscriptions
- ✅ Auto-cleanup prevents memory leaks (5-second timeout)
- ✅ Dynamic reactivity (new CoValues automatically subscribed)
- ✅ Aggregated callbacks (multiple CoValue changes → single notification)

### 3. CRDT Foundation for Real-Time Sync
- ✅ Every entity is a CoValue (collaborative by default)
- ✅ Conflict-free replicated data types (automatic merge)
- ✅ Real-time sync via CoJSON's sync protocol
- ✅ Multi-tab sync enabled (changes propagate across tabs)

### 4. Type Safety at Schema Level
- ✅ Co-types as native JSON Schema types (`"type": "comap"`)
- ✅ Nested co-types supported (properties can be co-types)
- ✅ Co-id as native type (`"type": "co-id"` - abstracted pattern validation)
- ✅ Optional `targetSchema` hints for cross-CoValue type safety
- ✅ Meta schema validates co-type requirements
- ✅ AJV extended with custom keywords (comap, colist, costream, cotext, co-id)
- ✅ Less boilerplate (no manual pattern validation)
- ✅ Focus on CoMap and CoList (most common types)

### 5. Unified API Surface
- ✅ Developers use same `maia.db()` API
- ✅ No breaking changes to existing code
- ✅ Backend swap is transparent
- ✅ Actor APIs unchanged (context queries work as before)

### 6. No Backwards Compatibility Layers
- ✅ 100% migration at each milestone
- ✅ No "legacy mode" flags or conditionals
- ✅ Clean codebase with no tech debt
- ✅ SubscriptionEngine untouched (zero modifications)

### 7. Testable Incremental Progress
- ✅ Each milestone is fully functional
- ✅ Manual testing at every step
- ✅ Todo vibe app works throughout migration
- ✅ End-to-end reactivity verified at each milestone

---

## Next Steps

1. **Read this plan** - Understand the full migration path
2. **Understand subscription architecture** - Review the flow diagrams above
3. **Milestone 1** - Implement CoJSONBackend adapter (CRUD + stub subscribe)
4. **Manual testing** - Verify backend initializes
5. **Milestone 2** - Upgrade meta schema (add `$coType` requirement)
6. **Manual testing** - Verify schemas are valid
7. **Milestone 3** - Switch todo vibe to CoJSON backend (basic CRUD)
8. **Manual testing** - Full CRUD cycle (create, read, update, delete)
9. **Milestone 4** - Implement full reactive subscriptions (CRITICAL)
10. **Manual testing** - Verify end-to-end reactivity (actor → view flow)
11. **Continue** - Follow milestones 5-6 (DB viewer + docs)

---

## Execution Plan

### Phase 1: Foundation (Milestone 1)

**Goal**: Set up CoJSON infrastructure and meta-schema with native co-types

**Tasks:**
1. **Extend Meta Schema** (`libs/maia-schemata/src/schemas/meta-schema.json`)
   - Add native co-types: `"type": "comap" | "colist" | "costream" | "cotext"`
   - Define that `$schema`, `$id`, `$ref` use co-ids (not URIs)
   - Properties can only be primitives or `$ref` (nested co-types → standalone schemas)
   - Update `$defs` for co-types (each co-type as enum value)

2. **Extend AJV Validator** (`libs/maia-schemata/src/validation.js`)
   - Add custom keywords for co-types (`comap`, `colist`, `costream`, `cotext`)
   - Implement `configureCoIdResolver` for `$ref` resolution by co-id
   - Three-level validation: pattern, existence, schema validation
   - Wire up to schema registry + CoValue store

3. **Create CoJSONBackend** (`libs/maia-script/src/o/engines/db-engine/backend/cojson-backend.js`)
   - Implement `init()` - Initialize CoJSON node, account, ONE default group
   - Stub other methods (`seed`, `create`, `query`, `update`, `delete`, `subscribe`)
   - Wire to DBEngine (backend swap)

4. **Test**: Meta schema validates co-type schemas, AJV can resolve `$ref` co-ids

---

### Phase 2: Seeding (Milestone 2)

**Goal**: Seed schemas and data as CoValues

**Tasks:**
1. **Implement CoJSONBackend.seed()** (`cojson-backend.js`)
   - Parse seed configs (schemas first, then data)
   - Create schema CoMaps with `headerMeta: {$schema: metaSchemaCoId}`
   - Create data CoMaps/CoLists with `headerMeta: {$schema: schemaCoId}`
   - Store references (schema name → co-id mapping)
   - Return seeded co-ids for tracking

2. **Migrate Todo Schema** (`libs/maia-schemata/src/data/todos.schema.json`)
   - Change `"type": "object"` → `"type": "comap"`
   - Remove `$id` field (auto-generated co-id)
   - Remove `id` property (use `todo.id` to access co-id)
   - Update `$schema` to use co-id reference (after meta-schema seeded)

3. **Update Seed Config** (`libs/maia-schemata/src/seed.config.js`)
   - Ensure schemas seeded first (create schema CoMaps)
   - Then seed data (create todo CoMaps with schema refs)
   - Store schema name → co-id mapping for lookups

4. **Test**: Seed operation creates CoValues, schemas validated, todos exist as CoMaps

---

### Phase 3: Basic CRUD (Milestone 3)

**Goal**: Implement create, query, update, delete operations

**Tasks:**
1. **Implement CoJSONBackend.create()** (`cojson-backend.js`)
   - Validate data against schema (using AJV with co-id resolver)
   - Determine co-type from schema (comap, colist, etc.)
   - Create CoValue: `account.createMap(data, {$schema: schemaCoId})` (or createList, etc.)
   - Return co-id

2. **Implement CoJSONBackend.query()** (`cojson-backend.js`)
   - Query all CoValues by schema (filter by `headerMeta.$schema`)
   - Extract properties from CoMaps/CoLists into plain objects (compatibility)
   - Apply filter (if provided)
   - Return array of results (same structure as before)

3. **Implement CoJSONBackend.update()** (`cojson-backend.js`)
   - Find CoValue by co-id
   - Validate updates against schema
   - Update CoMap properties (or CoList items)
   - Return updated co-id

4. **Implement CoJSONBackend.delete()** (`cojson-backend.js`)
   - Find CoValue by co-id
   - Delete from account (remove reference)
   - Cleanup subscriptions (via oSubscriptionCache)

5. **Test**: Full CRUD cycle works (create todo, query todos, update todo, delete todo)

---

### Phase 4: Reactive Subscriptions (Milestone 4) **CRITICAL**

**Goal**: Implement dependency-driven subscriptions (preserve actor-based architecture)

**Key Architectural Decision**: Actors subscribe to their **specific dependencies** (all CoValues):
- Context CoMap (actor config)
- Style CoMap (styling rules)
- View CoMap (template)
- State CoMap (local state)
- Data query (e.g., todos CoList)

**Tasks:**
1. **Implement CoJSONBackend.subscribe()** (`cojson-backend.js`)
   - Query all CoValues matching schema (e.g., `{schema: "@schema/todos"}`)
   - For each CoValue:
     - Check `oSubscriptionCache` for existing subscription
     - If not cached: `coValue.subscribe(callback)` → store in cache
     - Aggregate callbacks (multiple CoValue changes → single notification)
   - Subscribe to collection changes (detect new CoValues with this schema)
   - Return unsubscribe function (cleans up all CoValue subscriptions)

2. **Wire SubscriptionEngine** (NO CODE CHANGES - just verify)
   - Verify: SubscriptionEngine scans actor context for dependencies
   - Verify: Each dependency is a query: `{schema: "@schema/..."}"`
   - Verify: SubscriptionEngine calls `dbEngine.execute({op: 'query', callback})`
   - Verify: Callback updates `actor.context[key]` → batched re-render

3. **Update Actor Context** (if needed - likely minimal changes)
   - Ensure context declares ALL dependencies:
     ```javascript
     context: {
       todos: {schema: "@schema/todos"},      // Data
       style: {schema: "@schema/todo-style"}, // Style CoMap
       view: {schema: "@schema/todo-view"},   // View CoMap
       state: {schema: "@schema/todo-state"}  // State CoMap
     }
     ```
   - Each dependency becomes a subscription via SubscriptionEngine

4. **Test End-to-End Reactivity**:
   - Create todo → Actor re-renders (new todo appears in UI)
   - Update todo → Actor re-renders (todo updates in UI)
   - Delete todo → Actor re-renders (todo disappears from UI)
   - Change style CoMap → Styled actors re-render
   - Verify: Only dependent actors re-render (not entire app)

---

### Phase 5: DB Viewer (Milestone 5)

**Goal**: Update DB viewer to display CoValues

**Tasks:**
1. **Switch DB Viewer to CoJSONBackend** (`services/maia-city/db-view.js`)
   - Same backend swap as todo vibe
   - Query all CoValues (no filter)
   - Display co-ids, types, schemas, properties

2. **Test DB Viewer**:
   - View all CoValues (schemas, todos, styles, views, state, etc.)
   - Click on CoValue → View properties
   - Verify: Co-ids displayed correctly
   - Verify: HeaderMeta shown (schema reference, type, etc.)

---

### Phase 6: Documentation & Cleanup (Milestone 6)

**Goal**: Document architecture, cleanup code, finalize migration

**Tasks:**
1. **Document CoJSON Backend** (README in `db-engine/backend/`)
   - Architecture overview (dependency-driven subscriptions)
   - How to use (same as IndexedDBBackend - interface preserved)
   - CoValue structure (HeaderMeta, co-ids, schemas)

2. **Cleanup**:
   - Remove `id` properties from all schemas (use `coValue.id`)
   - Remove manual `$id` fields (auto-generated)
   - Remove old IndexedDB code (if no longer needed)
   - Update comments/docs to reflect CoJSON

3. **Update Seed Configs**:
   - Ensure all schemas use co-types
   - Ensure all data seeded as CoValues
   - Test: Full app works end-to-end

---

## Execution Summary

| Phase | Milestone | Key Deliverable | Test |
|-------|-----------|-----------------|------|
| 1 | Foundation | Meta-schema + AJV with co-types | Validate co-type schemas |
| 2 | Seeding | Seed schemas & data as CoValues | Todos exist as CoMaps |
| 3 | CRUD | Create, query, update, delete | Full CRUD cycle works |
| 4 | Subscriptions | Dependency-driven reactive subscriptions | End-to-end reactivity |
| 5 | DB Viewer | Display CoValues in viewer | View all CoValues |
| 6 | Docs/Cleanup | Documentation + cleanup | Full app works |

**Ready to start?** Let's build Phase 1 (Milestone 1)! 🚀

---

## Critical Success Factors

**🎯 Must Preserve:**
1. **Actor-based subscription architecture** - SubscriptionEngine unchanged
2. **End-to-end reactivity** - Context queries → View updates
3. **Batched re-renders** - Microtask batching for performance
4. **Subscription lifecycle** - Auto-cleanup tied to actor lifecycle

**🔧 Must Implement:**
1. **CoJSONBackend.subscribe()** - Bridge between actor layer and CoJSON
2. **oSubscriptionCache integration** - Efficient subscription deduplication
3. **Dynamic CoValue detection** - Subscribe to new CoValues automatically
4. **Aggregated callbacks** - Multiple CoValue changes → single notification

**✅ Success Criteria:**
- Todo vibe app works at every milestone
- SubscriptionEngine has zero modifications
- End-to-end reactivity verified via manual testing
- Console shows real co-ids (not mocks)
- Actor context updates automatically on data changes

---

## Key Architectural Decisions

### 1. Co-Types as Native Types

**Decision**: Use `"type": "comap"` instead of `"type": "object"` + separate `$coType` field.

**Rationale**:
- Cleaner schema structure (fewer fields)
- Consistent with JSON Schema conventions
- Easier to extend AJV (custom keywords)
- Allows nested co-types naturally

### 2. Native $ref for All References

**Decision**: Use native JSON Schema `$ref` with co-ids for ALL references (schemas, entities, any CoValue) - **NO CUSTOM TYPE NEEDED!**

**Rationale**:
- **Schemas are CoValues**: Each schema is a CoMap with its own co-id
- **No special cases**: Schema refs aren't treated differently from entity refs
- **Native JSON Schema**: Use standard `$ref` (AJV handles resolution automatically)
- **Self-describing**: Co-id value carries its own schema (via HeaderMeta)
- **Simpler**: No custom `co-id` type needed, just `{"$ref": "co_z..."}`
- **AJV built-in**: Schema lookup and validation handled by AJV
- **Faster lookups**: Direct co-id access (no URI resolution)
- **Consistent patterns**: All refs follow same pattern (`$ref: "co_z..."`)

**Benefits**:
- ✅ **Zero boilerplate**: Just `{"$ref": "co_z..."}` - that's it!
- ✅ **Native JSON Schema**: Uses standard `$ref` (no custom types!)
- ✅ **Full validation**: Pattern + existence + schema (all in AJV!)
- ✅ **Self-describing**: Dereference co-id → get schema from HeaderMeta automatically

### 3. Composable Schemas (No Inline Co-Type Nesting)

**Decision**: Each co-type becomes its own standalone schema. Properties can only be primitives or `$ref` (no inline co-type definitions).

**Rationale**:
- **Simpler schemas**: Each schema is flat (only primitives + $ref)
- **Composable by design**: Mix and match schemas via native `$ref`
- **Reusable**: Same schema can be referenced by multiple parents
- **Matches CoJSON reality**: Each co-type is a separate CoValue with its own co-id
- **No nested definitions needed**: Just reference via `$ref`
- **Native JSON Schema**: Uses standard `$ref` (no custom types!)

**Example:**
```json
// ❌ WRONG (nested co-type)
{"type": "comap", "properties": {"todos": {"type": "colist"}}}

// ✅ CORRECT (separate schemas with $ref)
// Schema 1: TodoList (colist)
{"type": "colist", "items": {"$ref": "co_zTodo..."}}

// Schema 2: Project (comap with $ref)
{"type": "comap", "properties": {"todos": {"$ref": "co_zTodoList..."}}}
```

### 4. AJV Extension for Co-Types

**Decision**: Extend AJV with custom keywords (`comap`, `colist`, `costream`, `cotext`).

**Rationale**:
- Leverages existing validation infrastructure
- Minimal changes to validation logic
- Consistent error reporting
- Easy to test and maintain

### 5. Dependency-Driven Subscriptions (CRDT-Native)

**Decision**: Actors subscribe to their **specific dependencies** (all CoValues), not the entire account.

**Architecture**:
```javascript
// Each actor declares its dependencies (ALL are CoValues):
Actor "TodoList" context:
{
  todos: {schema: "@schema/todos"},        // Data CoList
  style: {schema: "@schema/todo-style"},   // Style CoMap
  view: {schema: "@schema/todo-view"},     // View CoMap
  state: {schema: "@schema/todo-state"}    // State CoMap
}

// SubscriptionEngine subscribes to EACH dependency
// When ANY CoValue with these schemas changes → actor re-renders
```

**Rationale**:
- **CRDT-native**: CoValues can be local, remote, synced anywhere - actor doesn't care!
- **Fine-grained reactivity**: Only re-render when YOUR dependencies change (efficient)
- **Distributed-first**: Location-transparent (CoValues fly anywhere)
- **Everything is a CoValue**: Context, styles, views, state, data - all runtime editable
- **Preserves actor architecture**: SubscriptionEngine unchanged (just backend swap)
- **End-to-end reactivity**: Change style CoMap → styled actors re-render automatically

**Benefits**:
- ✅ **Efficient**: Don't re-render on unrelated changes
- ✅ **Scalable**: Each actor manages its own dependency graph
- ✅ **Testable**: Mock individual dependencies easily
- ✅ **Runtime editable**: Change ANY CoValue → dependent actors update

---

---

## Universal Co-ID Architecture Summary

### Why Universal Co-ID Type Is Simpler

**Old Approach (URI-based with special handling):**
```json
{
  "$schema": "https://maia.city/schemas/meta",     // URI (requires resolution)
  "$id": "https://maia.city/schemas/todo",         // URI (requires resolution)
  "type": "object",                                 // Plain object
  "properties": {
    "assignee": {
      "type": "string",                             // Manual pattern
      "pattern": "^co_z[a-zA-Z0-9]+$"              // Boilerplate
    }
  }
}
```

**Problems:**
- ❌ URIs require resolution logic (schema registry lookup)
- ❌ Manual pattern validation for co-ids (boilerplate)
- ❌ Special handling for schema refs vs entity refs
- ❌ Schemas aren't CoValues (just JSON files)

**New Approach (Universal Co-ID - No Boilerplate):**
```json
{
  "$schema": "co_zMetaSchemaId123...",  // Co-id (direct reference)
  // Note: $id is auto-generated (content-addressable hash)
  "type": "comap",                      // Co-type (CRDT)
  "properties": {
    "assignee": {
      "type": "co-id"                   // ✅ That's it! No boilerplate!
    }
  }
}
```

**Benefits:**
- ✅ All refs are co-ids (no URI resolution)
- ✅ One type for all references (`co-id`)
- ✅ **Zero boilerplate** - just `{"type": "co-id"}` and nothing else!
- ✅ **Content-addressable** - co-ids are auto-generated (immutable hash)
- ✅ **Self-describing** - co-id value carries its own schema (HeaderMeta)
- ✅ Schemas are CoValues (can sync, version, validate)
- ✅ No special cases (schema refs = entity refs)
- ✅ Pattern validation in AJV (no manual pattern checking)
- ✅ Faster lookups (direct co-id access)

**Current MaiaScript Validation:**
```javascript
// Current: Manual pattern checking everywhere
const coIdPattern = /^co_z[a-zA-Z0-9]+$/;
if (!coIdPattern.test(assignee)) {
  throw new Error("Invalid co-id");
}
```

**With Universal Co-ID (No Boilerplate):**
```javascript
// Schema: Just {"type": "co-id"} - that's it!
// AJV handles pattern validation automatically
ajv.validate(schema, data);  // ✅ co-id pattern validated

// Dereferencing: Get schema from HeaderMeta
const coValue = await loadCoValue(assigneeCoId);
const schema = coValue._headerMeta.$schema;  // Schema comes from CoValue itself!
```

---

## MaiaOS Type System Summary

### Complete Type Hierarchy

```
JSON Schema Types (Extended for MaiaOS)
├── Standard Types (JSON Schema 2020-12)
│   ├── string
│   ├── number
│   ├── integer
│   ├── boolean
│   ├── null
│   ├── object  (deprecated - use comap)
│   ├── array   (deprecated - use colist)
│   └── $ref    (✅ Use with co-ids for references!)
│                  ↳ Pattern: {"$ref": "co_z[a-zA-Z0-9]+"}
│                  ↳ AJV resolves schema automatically
│
└── Co-Types (CRDT Types - MaiaOS Extension)
    ├── comap     (CRDT map/object)
    ├── colist    (CRDT list/array)
    ├── costream  (CRDT append-only stream)
    └── cotext    (CRDT plain text)
```

### Type Usage

**Root Level (MUST be co-type):**
```json
{"type": "comap"}     // ✅ Valid
{"type": "colist"}    // ✅ Valid
{"type": "object"}    // ❌ Invalid (use comap)
```

**Properties (primitives or $ref only - NO inline co-types):**
```json
{
  "type": "comap",
  "properties": {
    "name": {"type": "string"},              // ✅ Primitive
    "count": {"type": "integer"},            // ✅ Primitive
    "todos": {"$ref": "co_zTodoList..."},    // ✅ $ref to TodoList CoValue
    "assignee": {"$ref": "co_zUser..."}      // ✅ $ref to User CoValue
  }
}
```

**Composition (co-types as separate schemas with $ref):**
```json
// Schema 1: TodoList (separate CoValue)
{
  "type": "colist",
  "items": {"$ref": "co_zTodo..."}
}

// Schema 2: Project (references TodoList)
{
  "type": "comap",
  "properties": {
    "name": {"type": "string"},
    "todos": {"$ref": "co_zTodoList..."}  // Native $ref to TodoList CoValue
  }
}
```

**Schema References (all co-ids):**
```json
{
  "$schema": "co_zMetaSchemaId123...",  // Co-id (not URI)
  // Note: $id is auto-generated (content-addressable hash)
  "type": "comap"
}
```

**References (native $ref - no boilerplate):**
```json
{
  "assignee": {
    "$ref": "co_zUser456..."  // ✅ Native $ref! That's it!
  }
}
```

---

## References

- [Distributed Perpetual Schema Architecture](./distributed-perpetual-schema-architecture.md) - Future vision for schema evolution
- [CoJSON Engine](../../libs/maia-db/src/cojson/cojson.engine.js) - Existing CoJSON implementation
- [IndexedDB Backend](../../libs/maia-script/src/o/engines/db-engine/backend/indexeddb.js) - Current backend to replace
- [Meta Schema](../../libs/maia-db/src/schemas/meta-schema.js) - Schema validation foundation
- [Co-Type Definitions](../../libs/maia-db/src/schemas/co-types.defs.json) - CRDT type definitions
- [AJV Documentation](https://ajv.js.org/) - JSON Schema validator (extended with co-types)
