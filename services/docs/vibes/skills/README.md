# Skills System

**Reusable Business Logic Functions with Central Registry**

---

## 🎯 Overview

The Skills System is a centralized registry of reusable action functions. Skills:

- **Execute business logic** - CRUD operations, validations, UI updates
- **Are composable** - Mix and match skills in actors
- **Work across vibes** - Reuse the same skills in different applications
- **Are LLM-ready** - Metadata enables AI to discover and call skills
- **Integrate with Jazz** - Access collaborative data via AccountCoState

---

## 📐 Skill Structure

### Skill Definition

```typescript
interface Skill {
  metadata: SkillMetadata
  execute: SkillFunction
}

interface SkillMetadata {
  id: string                    // Unique ID (e.g., '@entity/createEntity')
  name: string                  // Human-readable name
  description: string           // What the skill does
  category?: string             // Grouping (e.g., 'entity', 'ui')
  parameters?: ParametersSchema // JSON Schema for params
}

// NEW SIGNATURE: Skills receive actor reference directly (not dataStore)
type SkillFunction = (
  actor: any,            // The actor that triggered this skill
  payload?: unknown,     // Event payload
  accountCoState?: any   // Jazz account CoState
) => void | Promise<void>
```

### Example Skill

```typescript
const createEntitySkill: Skill = {
  metadata: {
    id: '@entity/createEntity',
    name: 'Create Entity',
    description: 'Creates a new entity of any schema type',
    category: 'entity',
    parameters: {
      type: 'object',
      properties: {
        schemaName: { type: 'string', description: 'Schema name', required: true },
        entityData: { type: 'object', description: 'Entity data', required: true },
      },
      required: ['schemaName', 'entityData'],
    },
  },
  execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
    const { schemaName, entityData } = payload as { 
      schemaName: string
      entityData: Record<string, unknown> 
    }
    
    // Get Jazz account from CoState (passed directly to skill)
    const jazzAccount = accountCoState?.current
    if (!jazzAccount || !jazzAccount.$isLoaded) {
      throw new Error('Jazz account not loaded')
    }
    
    // Create entity using generic function
    const entity = await createEntityGeneric(jazzAccount, schemaName, entityData)
    await entity.$jazz.waitForSync()
    
    console.log('[createEntitySkill] ✅ Created entity:', entity.$jazz.id)
  },
}
```

**Key Changes from Old Pattern**:
- **Direct actor reference**: Skills receive `actor` instead of `data` object
- **Explicit accountCoState**: Passed as third parameter (no more `data._jazzAccountCoState`)
- **No dataStore**: Skills don't update local state - they mutate Jazz CoValues directly
- **Reactive queries**: UI subscribes to Jazz data via `useQuery`, not skill updates

---

## 📦 Skill Categories

### Entity Skills

CRUD operations for any entity type:

```typescript
// Create
'@entity/createEntity'      // Create new entity
'@entity/updateEntity'      // Update existing entity
'@entity/deleteEntity'      // Delete entity
'@entity/toggleStatus'      // Toggle status field
'@entity/clearEntities'     // Clear all entities of a type
'@entity/validateInput'     // Validate input

// Example usage in actor (direct skill execution)
const actor = Actor.create({
  context: { visible: true, queries: { items: { schemaName: 'Item', items: [] } } },
  // ... no state machine needed
}, group)
actor.subscriptions.$jazz.push(actor.$jazz.id)
// Skills execute directly when messages arrive
```

### Relation Skills

Graph operations for relations:

```typescript
// Relation CRUD
'@relation/createRelation'   // Create relation instance
'@relation/updateRelation'   // Update relation
'@relation/deleteRelation'   // Delete relation

// Example: Link entities via relation
const assignedTo = await executeSkill('@relation/createRelation', accountCoState, {
  schemaName: 'AssignedTo',
  relationData: {
    x1: todoEntity.$jazz.id,   // Todo
    x2: humanEntity.$jazz.id,  // Human
  }
})
```

### UI Skills

View management and user interactions:

```typescript
// View management
'@ui/swapViewNode'     // Swap composite/leaf configs
'@ui/setView'          // Set view mode (list/kanban/timeline)
'@ui/updateInput'      // Update input field
'@ui/clearInput'       // Clear input field
'@ui/openModal'        // Open modal with entity
'@ui/closeModal'       // Close modal

// Example: View switching
// Actor handles events directly (no state machine)
const actor = Actor.create({
  context: { visible: true, viewMode: 'list' },
  // ... no state machine needed
}, group)
actor.subscriptions.$jazz.push(actor.$jazz.id)
```

### Schema Skills

Type system management:

```typescript
// Schema management
'@schema/createSchemaType'   // Create Entity or Relation schema

// Example: Create new schema
await executeSkill('@schema/createSchemaType', accountCoState, {
  schemaName: 'Project',
  schemaType: 'Entity',
  jsonSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['name'],
  }
})
```

### Database Skills

Database management:

```typescript
// Database operations
'@database/resetDatabase'    // Clear all data

// Example: Reset on development
// Actor handles events directly (no state machine)
const actor = Actor.create({
  context: { visible: true },
  // ... no state machine needed
}, group)
actor.subscriptions.$jazz.push(actor.$jazz.id)
```

### Domain-Specific Skills

Custom skills for your application:

```typescript
// Human skills (example)
'@human/createRandom'        // Create random human entity

// Your custom skills
'@myapp/sendEmail'
'@myapp/generateReport'
'@myapp/calculateScore'
```

---

## 🔧 Using Skills

### Direct Execution in Actors

Skills execute directly when messages arrive at an actor's inbox:

```typescript
const myActor = Actor.create({
  context: { visible: true, newItemText: '' },
  view: {
    // ... view definition with events
    events: {
      click: {
        event: '@entity/createEntity',
        payload: { name: 'context.newItemText' }
      }
    }
  },
  // ... no state machine needed
}, group)

// Actor subscribes to itself to handle events
myActor.subscriptions.$jazz.push(myActor.$jazz.id)

// When message arrives, ActorRenderer executes skill directly based on message type
```

### Standalone Execution

Execute skills programmatically outside actors:

```typescript
import { executeSkill } from '$lib/compositor/skills'

// Execute skill directly
await executeSkill('@entity/createEntity', accountCoState, {
  schemaName: 'Human',
  entityData: { name: 'Alice', email: 'alice@example.com' }
})

// Use in any async function
async function createProject() {
  await executeSkill('@entity/createEntity', accountCoState, {
    schemaName: 'Project',
    entityData: { name: 'My Project', description: 'A cool project' }
  })
}
```

### From ActorRenderer (Automatic Skill Execution)

The `ActorRenderer` automatically calls skills when processing messages:

```typescript
// 1. Actor handles events directly (no state machine)
const actor = Actor.create({
  context: { visible: true, queries: { items: { schemaName: 'Item', items: [] } } },
  // ... no state machine needed
}, group)
actor.subscriptions.$jazz.push(actor.$jazz.id)

// 2. ActorRenderer processes messages and calls skills directly
// (from ActorRenderer.svelte)
$effect(() => {
  // ... message collection from CoFeed inbox ...
  
  for (const message of allMessages) {
    const messageId = message.$jazz?.id
    if (!messageId || consumedMessageIds.has(messageId)) {
      continue
    }
    
    // Mark as consumed BEFORE execution
    consumedMessageIds.add(messageId)
    
    // Call skill directly based on message type (no state machine checks)
    const skill = skillRegistry.get(message.type)
    if (skill) {
      skill.execute(actor, message.payload, accountCoState)
    }
    
    // Mark as consumed
    processedMessageIds.add(messageId)
  }
})

// No additional wiring needed!
// Skills are called automatically when messages arrive
```

**How It Works**:
1. **Message arrives** in actor's inbox (CoFeed)
2. **ActorRenderer detects** via reactive `$effect`
3. **Skill loaded** from registry via `getSkill(message.type)`
4. **Skill executed** with `(actor, payload, accountCoState)`
5. **Skill mutates** Jazz CoValues directly
6. **UI updates** reactively via `useQuery` subscriptions

---

## 🏗️ Creating Custom Skills

### Step 1: Define Your Skill

```typescript
// mySkills.ts
import type { Skill } from '$lib/compositor/skills'

const sendEmailSkill: Skill = {
  metadata: {
    id: '@myapp/sendEmail',
    name: 'Send Email',
    description: 'Sends an email to a user',
    category: 'communication',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email', required: true },
        subject: { type: 'string', description: 'Email subject', required: true },
        body: { type: 'string', description: 'Email body', required: true },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
    const { to, subject, body } = payload as { 
      to: string
      subject: string
      body: string 
    }
    
    console.log('[sendEmailSkill] Sending email to:', to)
    
    // Your email sending logic
    await sendEmail({ to, subject, body })
    
    console.log('[sendEmailSkill] ✅ Email sent successfully')
    
    // NO UI state updates here!
    // Skills mutate Jazz CoValues directly
    // UI subscribes reactively via useQuery
  },
}

export const mySkills: Record<string, Skill> = {
  '@myapp/sendEmail': sendEmailSkill,
}
```

**Key Changes**:
- **New signature**: `(actor, payload, accountCoState)` instead of `(data, payload)`
- **No UI updates**: Skills don't update local state - they mutate Jazz CoValues
- **Reactive UI**: UI subscribes to Jazz data via `useQuery`, updates automatically

### Step 2: Register Your Skills

```typescript
// skills/index.ts
import { registerSkillsFromConfig } from './registry'
import { mySkills } from './mySkills'

export function registerAllSkills(): void {
  // Register core skills
  registerSkillsFromConfig(entitySkills)
  registerSkillsFromConfig(relationSkills)
  registerSkillsFromConfig(uiSkills)
  // Register your custom skills
  registerSkillsFromConfig(mySkills)
}
```

### Step 3: Use in Actor

```typescript
const actor = Actor.create({
  context: { visible: true },
  view: {
    events: {
      click: {
        event: '@myapp/sendEmail',
        payload: { to: 'user@example.com' }
      }
    }
  },
  // ... no state machine needed
}, group)
actor.subscriptions.$jazz.push(actor.$jazz.id)
// Skills execute when messages arrive (no state machine needed)
```

---

## 🎓 Skill Patterns

### Pattern 1: Generic CRUD Skill

Works with any entity type:

```typescript
const updateEntitySkill: Skill = {
  metadata: {
    id: '@entity/updateEntity',
    // ... metadata
  },
  execute: async (data: Data, payload?: unknown) => {
    const { id, updates } = payload as { id: string; updates: Record<string, unknown> }
    
    // Get Jazz account
    const account = data._jazzAccountCoState?.current
    if (!account?.$isLoaded) throw new Error('Account not loaded')
    
    // Find entity in loaded list
    const root = account.root
    const entities = root.entities
    const coValue = Array.from(entities).find(e => e.$jazz?.id === id)
    
    // Update using generic function
    await updateEntityGeneric(account, coValue, updates)
  },
}
```

### Pattern 2: Validation Skill

Validates input before other skills:

```typescript
const validateInputSkill: Skill = {
  metadata: {
    id: '@entity/validateInput',
    // ... metadata
  },
  execute: (data: Data, payload?: unknown) => {
    const { text, errorMessage = 'Input cannot be empty' } = payload as {
      text?: string
      errorMessage?: string
    }
    
    if (!text || !text.trim()) {
      if (!data.view) data.view = {}
      const view = data.view as Data
      view.error = errorMessage
      data.view = { ...view }
      throw new Error(errorMessage) // Stop execution
    }
    
    // Clear error if valid
    if (!data.view) data.view = {}
    const view = data.view as Data
    view.error = null
    data.view = { ...view }
  },
}

// Use in actor (skills execute in order when message arrives)
const actor = Actor.create({
  context: { visible: true, newItemText: '' },
  view: {
    events: {
      submit: {
        event: '@entity/createEntity',
        payload: { name: 'context.newItemText' }
      }
    }
  },
  // ... no state machine needed
}, group)
actor.subscriptions.$jazz.push(actor.$jazz.id)
// Both skills execute when message arrives (validateInput can be called first in skill itself)
```

### Pattern 3: UI Update Skill

Updates view state for reactive UI:

```typescript
const swapViewNodeSkill: Skill = {
  metadata: {
    id: '@ui/swapViewNode',
    // ... metadata
  },
  execute: (data: Data, payload?: unknown) => {
    const { nodeId, targetPath } = payload as { nodeId: string; targetPath: string }
    
    // Navigate to target path
    const pathParts = targetPath.split('.')
    let target: Data = data
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!target[pathParts[i]]) target[pathParts[i]] = {}
      target = target[pathParts[i]] as Data
    }
    
    // Set new node ID
    target[pathParts[pathParts.length - 1]] = nodeId
    
    // Ensure reactivity (create new reference)
    if (data.view) data.view = { ...(data.view as Data) }
  },
}
```

### Pattern 4: Async Database Skill

Performs async operations:

```typescript
const createEntitySkill: Skill = {
  metadata: {
    id: '@entity/createEntity',
    // ... metadata
  },
  execute: async (data: Data, payload?: unknown) => {
    const { schemaName, entityData } = payload as {
      schemaName: string
      entityData: Record<string, unknown>
    }
    
    const account = data._jazzAccountCoState?.current
    if (!account?.$isLoaded) throw new Error('Account not loaded')
    
    try {
      // Async Jazz operation
      await createEntityGeneric(account, schemaName, entityData)
      
      // Update success state
      if (!data.view) data.view = {}
      const view = data.view as Data
      view.success = `${schemaName} created successfully!`
      data.view = { ...view }
    } catch (error) {
      // Handle error
      if (!data.view) data.view = {}
      const view = data.view as Data
      view.error = error.message
      data.view = { ...view }
    }
  },
}
```

---

## 🔍 Skill Registry API

### Register Skills

```typescript
import { skillRegistry, registerSkillsFromConfig } from '$lib/compositor/skills'

// Register single skill
skillRegistry.register(mySkill)

// Register from config object
registerSkillsFromConfig({
  '@myapp/skill1': skill1,
  '@myapp/skill2': skill2,
})
```

### Get Skills

```typescript
// Get by ID
const skill = skillRegistry.get('@entity/createEntity')

// Get all skills
const allSkills = skillRegistry.getAll()

// Get by category
const entitySkills = skillRegistry.getByCategory('entity')

// Check existence
if (skillRegistry.has('@entity/createEntity')) {
  // Skill exists
}

// Get execute function directly
const execute = skillRegistry.getFunction('@entity/createEntity')
```

---

## 💡 Best Practices

### 1. Use Scoped Naming

```typescript
// ✅ GOOD: Scoped names
'@entity/createEntity'
'@myapp/sendEmail'
'@ui/swapViewNode'

// ❌ BAD: Generic names
'create'
'send'
'swap'
```

### 2. Provide Rich Metadata

```typescript
// ✅ GOOD: Complete metadata
metadata: {
  id: '@entity/createEntity',
  name: 'Create Entity',
  description: 'Creates a new entity of any schema type',
  category: 'entity',
  parameters: { /* JSON Schema */ },
}

// ❌ BAD: Missing metadata
metadata: {
  id: '@entity/createEntity',
}
```

### 3. Handle Errors Gracefully

```typescript
// ✅ GOOD: Try-catch with user feedback
execute: async (data, payload) => {
  try {
    await dangerousOperation()
  } catch (error) {
    if (!data.view) data.view = {}
    const view = data.view as Data
    view.error = error.message
    data.view = { ...view }
  }
}

// ❌ BAD: Uncaught errors
execute: async (data, payload) => {
  await dangerousOperation() // Throws and breaks everything
}
```

### 4. Keep Skills Pure

```typescript
// ✅ GOOD: Operates on data, no side effects
execute: (data, payload) => {
  data.view = { ...data.view, newValue: payload }
}

// ❌ BAD: Side effects outside data
execute: (data, payload) => {
  window.location.href = '/somewhere' // Don't do this
}
```

### 5. Use Generic Functions

```typescript
// ✅ GOOD: Generic, works for all entity types
execute: async (data, payload) => {
  const { schemaName, entityData } = payload
  await createEntityGeneric(account, schemaName, entityData)
}

// ❌ BAD: Hardcoded entity type
execute: async (data, payload) => {
  await createTodoEntity(account, payload) // Only works for todos
}
```

---

## 📚 Related Documentation

- **[Entity Skills](./entity-skills.md)** - Detailed CRUD patterns
- **[UI Skills](./ui-skills.md)** - View management patterns
- **[Custom Skills](./custom-skills.md)** - Building domain-specific skills
- **[Actors](../actors/README.md)** - How actors use skills
- **[Message Passing](../actors/message-passing.md)** - Skill execution flow

---

## ✅ Summary

The Skills System provides:

- **Centralized logic** - All business logic in one place
- **Reusability** - Use same skills across vibes
- **Composability** - Chain skills via message passing
- **Type safety** - JSON Schema parameter validation
- **LLM-ready** - Metadata enables AI discovery
- **Jazz integration** - Direct access to collaborative data

Next: Learn about **[Entity Skills](./entity-skills.md)** for CRUD operations.
