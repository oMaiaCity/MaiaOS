# Schemata System

**Type System for Entities, Relations, and UI Components**

---

## 🎯 Overview

The Schemata System provides a unified type system for:

- **Entities** - Data objects (Human, Todo, Project)
- **Relations** - Graph connections (AssignedTo, MemberOf, DependsOn)
- **Leaf Schemas** - UI component templates (Buttons, Headers, Cards)
- **Composite Schemas** - Layout templates (Forms, Modals, Grids)

All schemas are:
- **Stored in Jazz** - CoValues for real-time sync
- **JSON Schema compliant** - Full validation support
- **Centrally registered** - Single source of truth
- **Runtime modifiable** - Create new types without redeployment

---

## 📐 Schema Types

### Entity Schemas

**Data entities** with properties:

```typescript
// Human entity schema
const humanSchema = {
  type: 'Entity',
  name: 'Human',
  definition: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      email: { type: 'string' },
      dateOfBirth: { type: 'string', format: 'date' },
    },
    required: ['name', 'email'],
  },
}

// Create schema CoValue
await ensureSchema(account, 'Human', humanSchema.definition)

// Create entity instances
const human = await createEntityGeneric(account, 'Human', {
  name: 'Alice',
  email: 'alice@example.com',
  dateOfBirth: new Date(1990, 0, 1),
})
```

### Relation Schemas

**Graph connections** between entities:

```typescript
// AssignedTo relation schema (Todo → Human)
const assignedToSchema = {
  type: 'Relation',
  name: 'AssignedTo',
  definition: {
    type: 'object',
    properties: {
      x1: {
        type: 'string',
        description: 'Source entity: Todo',
      },
      x2: {
        type: 'string',
        description: 'Target entity: Human',
      },
    },
    required: ['x1', 'x2'],
  },
}

// Create relation instance
await createRelationGeneric(account, 'AssignedTo', {
  x1: todoEntity.$jazz.id,   // Todo
  x2: humanEntity.$jazz.id,  // Human
})
```

### Leaf Schemas

**UI component templates**:

```typescript
// Button leaf schema
const buttonSchemaDefinition = {
  type: 'Leaf',
  name: 'design-system.button',
  
  definition: {
    tag: 'button',
    attributes: { type: 'button' },
    classes: 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600',
    events: {
      click: { event: '{{clickEvent}}' }  // Placeholder
    },
    children: ['{{buttonText}}']  // Placeholder
  },
  
  parameterSchema: {
    type: 'object',
    properties: {
      clickEvent: { type: 'string', required: true },
      buttonText: { type: 'string', default: 'Click Me' },
    },
  },
}

// Use schema (create instance)
const myButton: LeafNode = {
  '@schema': 'design-system.button',
  parameters: {
    clickEvent: 'SUBMIT',
    buttonText: 'Submit Form',
  },
}
```

### Composite Schemas

**Layout templates**:

```typescript
// Header composite schema
const headerSchemaDefinition = {
  type: 'Composite',
  name: 'design-system.header',
  
  definition: {
    container: {
      layout: 'flex',
      class: 'flex-row justify-between items-center p-4',
    },
    children: [
      {
        slot: 'title',
        leaf: {
          '@schema': 'design-system.title',
          parameters: { text: '{{titleText}}' }
        }
      },
      {
        slot: 'actions',
        leaf: {
          '@schema': 'design-system.button',
          parameters: {
            clickEvent: '{{actionEvent}}',
            buttonText: '{{actionText}}'
          }
        }
      }
    ]
  },
  
  parameterSchema: {
    type: 'object',
    properties: {
      titleText: { type: 'string', required: true },
      actionEvent: { type: 'string', required: true },
      actionText: { type: 'string', default: 'Action' },
    },
  },
}
```

---

## 🏗️ Schema Structure

### SchemaDefinition CoValue

```typescript
export const Schema = co.map({
  name: z.string(),            // Unique schema name
  type: z.enum(['Entity', 'Relation', 'Leaf', 'Composite']),
  definition: co.json<any>(),  // JSON Schema definition
})

// Create schema
const schema = Schema.create({
  name: 'Human',
  type: 'Entity',
  definition: { /* JSON Schema */ },
}, group)

// Store in root
account.root.schemata.$jazz.push(schema)
await account.root.$jazz.waitForSync()
```

### Entity Instance

```typescript
// Generic entity CoValue
export const Entity = co.map(
  {
    // '@schema' property set by createEntityGeneric
    // Other properties are dynamic based on schema
  },
  { passthrough: 'shallow' }  // Allow any properties
)

// Create entity
const human = await createEntityGeneric(account, 'Human', {
  name: 'Alice',
  email: 'alice@example.com',
})

// Access schema
const schemaId = human['@schema']  // Reference to Schema CoValue
```

### Relation Instance

```typescript
// Generic relation CoValue
export const Relation = co.map({
  x1: z.string(),  // Source entity ID
  x2: z.string(),  // Target entity ID
  x3: co.optional(z.string()),  // Optional
  x4: co.optional(z.string()),  // Optional
  x5: co.optional(z.string()),  // Optional
})

// Create relation
const relation = await createRelationGeneric(account, 'AssignedTo', {
  x1: todoEntity.$jazz.id,
  x2: humanEntity.$jazz.id,
})
```

---

## 🔧 CRUD Operations

### Entity CRUD

```typescript
import {
  createEntityGeneric,
  updateEntityGeneric,
  deleteEntityGeneric,
} from '@hominio/db'

// CREATE
const human = await createEntityGeneric(account, 'Human', {
  name: 'Alice',
  email: 'alice@example.com',
})

// READ (via queries)
const humans = account.root.entities.filter(e => 
  e['@schema'] === humanSchema.$jazz.id
)

// UPDATE
await updateEntityGeneric(account, human, {
  name: 'Alice Smith',
  email: 'alice.smith@example.com',
})

// DELETE
await deleteEntityGeneric(account, human.$jazz.id)
```

### Relation CRUD

```typescript
import {
  createRelationGeneric,
  updateRelationGeneric,
  deleteRelationGeneric,
} from '@hominio/db'

// CREATE
const relation = await createRelationGeneric(account, 'AssignedTo', {
  x1: todoEntity.$jazz.id,
  x2: humanEntity.$jazz.id,
})

// UPDATE
await updateRelationGeneric(account, relation, {
  x2: differentHumanEntity.$jazz.id,  // Reassign
})

// DELETE
await deleteRelationGeneric(account, relation.$jazz.id)
```

### Schema CRUD

```typescript
import { ensureSchema } from '@hominio/db'

// CREATE/ENSURE
const schema = await ensureSchema(account, 'Human', {
  type: 'object',
  properties: {
    name: { type: 'string' },
    email: { type: 'string' },
  },
  required: ['name', 'email'],
})

// Set type
schema.$jazz.set('type', 'Entity')
await schema.$jazz.waitForSync()

// READ
const humanSchema = account.root.schemata.find(s => s.name === 'Human')

// UPDATE (modify definition)
schema.definition = { /* new definition */ }
await schema.$jazz.waitForSync()

// DELETE (remove from list)
const index = account.root.schemata.indexOf(schema)
account.root.schemata.$jazz.splice(index, 1)
```

---

## 🔍 Querying

### Find Entities by Schema

```typescript
// Get schema
const humanSchema = account.root.schemata.find(s => s.name === 'Human')

// Filter entities
const humans = Array.from(account.root.entities).filter(entity => {
  const snapshot = entity.$jazz?.raw?.toJSON()
  return snapshot?.['@schema'] === humanSchema?.$jazz?.id
})
```

### Find Relations by Type

```typescript
// Get schema
const assignedToSchema = account.root.schemata.find(s => s.name === 'AssignedTo')

// Filter relations
const assignments = Array.from(account.root.relations).filter(relation => {
  const snapshot = relation.$jazz?.raw?.toJSON()
  return snapshot?.['@schema'] === assignedToSchema?.$jazz?.id
})

// Find relations for specific entity
const todoAssignments = assignments.filter(r => r.x1 === todoEntity.$jazz.id)
```

### Find Relations by Position

```typescript
// Get all entities assigned to a human
const humanId = humanEntity.$jazz.id

const assignedToHuman = Array.from(account.root.relations).filter(relation => {
  const snapshot = relation.$jazz?.raw?.toJSON()
  const isAssignedTo = snapshot?.['@schema'] === assignedToSchema?.$jazz?.id
  return isAssignedTo && relation.x2 === humanId  // x2 is target (Human)
})

// Get todos from relations
const assignedTodos = assignedToHuman.map(relation => {
  const todoId = relation.x1  // x1 is source (Todo)
  return account.root.entities.find(e => e.$jazz.id === todoId)
})
```

---

## 🎨 Design System Schemas

### Registration

```typescript
import { registerJsonSchema } from '@hominio/db'

// Register leaf schemas
registerJsonSchema('design-system.button', buttonSchemaDefinition)
registerJsonSchema('design-system.title', titleSchemaDefinition)
registerJsonSchema('design-system.card', cardSchemaDefinition)

// Register composite schemas
registerJsonSchema('design-system.header', headerSchemaDefinition)
registerJsonSchema('design-system.modal', modalSchemaDefinition)
registerJsonSchema('design-system.form', formSchemaDefinition)

// Auto-register on import
export function registerDesignSystemSchemas() {
  registerJsonSchema('design-system.button', buttonSchemaDefinition)
  // ... register all schemas
}

registerDesignSystemSchemas()  // Side effect
```

### Schema Resolution

```typescript
import { resolveSchemaLeaf, resolveSchemaComposite } from '$lib/compositor/view/schema-resolver'

// Resolve leaf schema
const leafWithSchema: LeafNode = {
  '@schema': 'design-system.button',
  parameters: { clickEvent: 'SUBMIT', buttonText: 'Submit' },
}

const resolvedLeaf = resolveSchemaLeaf(leafWithSchema)
// Result: Full LeafNode with placeholders replaced

// Resolve composite schema
const compositeWithSchema: CompositeConfig = {
  '@schema': 'design-system.header',
  parameters: { titleText: 'data.title', actionEvent: 'OPEN_MODAL' },
}

const resolvedComposite = resolveSchemaComposite(compositeWithSchema)
// Result: Full CompositeConfig with placeholders replaced
```

---

## 📚 Related Documentation

- **[Entities](./entities.md)** - Entity schema patterns
- **[Relations](./relations.md)** - Relation schema patterns
- **[Schema Registry](./registry.md)** - Managing schemas
- **[Jazz Integration](../jazz/README.md)** - How schemas use Jazz
- **[View Layer](../view/README.md)** - UI component schemas

---

## ✅ Best Practices

### 1. Use Descriptive Schema Names

```typescript
// ✅ GOOD: Clear entity name
await ensureSchema(account, 'Human', { /* ... */ })

// ❌ BAD: Generic name
await ensureSchema(account, 'User', { /* ... */ })
```

### 2. Include Rich JSON Schema

```typescript
// ✅ GOOD: Complete JSON Schema
definition: {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    email: { type: 'string', format: 'email' },
    age: { type: 'number', minimum: 0, maximum: 150 },
  },
  required: ['name', 'email'],
}

// ❌ BAD: Minimal schema
definition: {
  properties: { name: {}, email: {} }
}
```

### 3. Set Schema Type

```typescript
// ✅ GOOD: Explicitly set type
schema.$jazz.set('type', 'Entity')
await schema.$jazz.waitForSync()

// ❌ BAD: Leave type undefined
// (Other code can't distinguish Entity from Relation)
```

### 4. Use Position Descriptions for Relations

```typescript
// ✅ GOOD: Clear position descriptions
definition: {
  properties: {
    x1: { type: 'string', description: 'Source entity: Todo' },
    x2: { type: 'string', description: 'Target entity: Human' },
  }
}

// ❌ BAD: No descriptions
definition: {
  properties: {
    x1: { type: 'string' },
    x2: { type: 'string' },
  }
}
```

### 5. Register Design System Schemas

```typescript
// ✅ GOOD: Central registration
registerJsonSchema('design-system.button', buttonSchemaDefinition)

// ❌ BAD: Inline definitions everywhere
// (No reusability, inconsistent styling)
```

---

## 🎯 Summary

The Schemata System provides:

- **Unified type system** - Entities, relations, UI components
- **JSON Schema compliance** - Full validation support
- **Runtime modifiable** - Create types without deployment
- **Design system** - Reusable UI component templates
- **Graph relations** - Flexible entity connections
- **Jazz-native** - All schemas stored as CoValues

Next: Learn about **[Vibes](../vibes/README.md)** for complete applications.
