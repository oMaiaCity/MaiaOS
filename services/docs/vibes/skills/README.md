# Skills System

**Reusable Business Logic Functions with Central Registry**

---

## 🎯 Overview

The Skills System is a centralized registry of reusable action functions. Skills:

- **Execute business logic** - CRUD operations, validations, UI updates
- **Are composable** - Mix and match skills in state machines
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

type SkillFunction = (data: Data, payload?: unknown) => void | Promise<void>
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
  execute: async (data: Data, payload?: unknown) => {
    const { schemaName, entityData } = payload as { schemaName: string; entityData: Record<string, unknown> }
    
    // Get Jazz account from data
    const account = data._jazzAccountCoState?.current
    if (!account?.$isLoaded) throw new Error('Account not loaded')
    
    // Create entity using generic function
    await createEntityGeneric(account, schemaName, entityData)
  },
}
```

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

// Example usage in state machine
states: {
  idle: {
    on: {
      CREATE_ITEM: { target: 'idle', actions: ['@entity/createEntity'] },
      UPDATE_ITEM: { target: 'idle', actions: ['@entity/updateEntity'] },
      DELETE_ITEM: { target: 'idle', actions: ['@entity/deleteEntity'] },
    }
  }
}
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
states: {
  idle: {
    on: {
      SET_VIEW: { target: 'idle', actions: ['@ui/setView'] },
      OPEN_DETAILS: { target: 'idle', actions: ['@ui/openModal'] },
    }
  }
}
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
states: {
  idle: {
    on: {
      RESET_DB: { target: 'idle', actions: ['@database/resetDatabase'] },
    }
  }
}
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

### In State Machines

Skills are referenced by ID in state machine definitions:

```typescript
const myActor = Actor.create({
  currentState: 'idle',
  states: {
    idle: {
      on: {
        // Single skill
        CREATE_ITEM: { target: 'idle', actions: ['@entity/createEntity'] },
        
        // Multiple skills (execute in order)
        SUBMIT_FORM: {
          target: 'idle',
          actions: ['@entity/validateInput', '@entity/createEntity', '@ui/clearInput']
        },
      }
    }
  },
  // ...
}, group)
```

### Standalone Execution

Execute skills outside state machines:

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

### From ActorRenderer

The `ActorRenderer` automatically loads skills from the registry:

```typescript
// In createVibesActors.ts
const actor = Actor.create({
  states: {
    idle: {
      on: {
        CREATE_ITEM: { target: 'idle', actions: ['@entity/createEntity'] }
      }
    }
  },
  // ...
}, group)

// ActorRenderer loads the skill and executes it
// No additional wiring needed!
```

---

## 🏗️ Creating Custom Skills

### Step 1: Define Your Skill

```typescript
// mySkills.ts
import type { Skill, Data } from '$lib/compositor/skills'

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
  execute: async (data: Data, payload?: unknown) => {
    const { to, subject, body } = payload as { to: string; subject: string; body: string }
    
    // Your email sending logic
    await sendEmail({ to, subject, body })
    
    // Update UI state if needed
    if (!data.view) data.view = {}
    const view = data.view as Data
    view.emailSent = true
    view.emailStatus = 'Email sent successfully!'
    data.view = { ...view }
  },
}

export const mySkills: Record<string, Skill> = {
  '@myapp/sendEmail': sendEmailSkill,
}
```

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

### Step 3: Use in State Machine

```typescript
const actor = Actor.create({
  states: {
    idle: {
      on: {
        SEND_NOTIFICATION: { target: 'idle', actions: ['@myapp/sendEmail'] }
      }
    }
  },
  // ...
}, group)
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

// Use in chain
states: {
  idle: {
    on: {
      CREATE_ITEM: {
        target: 'idle',
        actions: ['@entity/validateInput', '@entity/createEntity'] // Validate first!
      }
    }
  }
}
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
- **[State Machines](../actors/state-machines.md)** - Skill execution flow

---

## ✅ Summary

The Skills System provides:

- **Centralized logic** - All business logic in one place
- **Reusability** - Use same skills across vibes
- **Composability** - Chain skills in state machines
- **Type safety** - JSON Schema parameter validation
- **LLM-ready** - Metadata enables AI discovery
- **Jazz integration** - Direct access to collaborative data

Next: Learn about **[Entity Skills](./entity-skills.md)** for CRUD operations.
