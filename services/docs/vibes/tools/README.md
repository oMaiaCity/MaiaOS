# Tools System

**Reusable Business Logic Functions with Module-Based Architecture**

---

## 🎯 Overview

The Tools System is a module-based registry of reusable action functions. Tools:

- **Execute business logic** - CRUD operations, validations, UI updates
- **Are composable** - Mix and match tools in actors
- **Work across vibes** - Reuse the same tools in different applications
- **Are LLM-ready** - Metadata enables AI to discover and call tools
- **Integrate with Jazz** - Access collaborative data via AccountCoState
- **Module-based** - Organized into builtin (core, context) and optional (ai, human) modules

---

## 📐 Tool Structure

### Tool Definition

```typescript
interface Tool {
  metadata: ToolMetadata
  execute: ToolFunction
}

interface ToolMetadata {
  id: string                    // Unique ID (e.g., '@core/createEntity')
  name: string                  // Human-readable name
  description: string           // What the tool does
  category?: string             // Grouping (e.g., 'core', 'context')
  parameters?: ParametersSchema // JSON Schema for params
}

// Tools receive actor reference directly (not dataStore)
type ToolFunction = (
  actor: any,            // The actor that triggered this tool
  payload?: unknown,     // Event payload
  accountCoState?: any   // Jazz account CoState
) => void | Promise<void>
```

### Example Tool

```typescript
const createEntityTool: Tool = {
  metadata: {
    id: '@core/createEntity',
    name: 'Create Entity',
    description: 'Creates a new entity of any schema type',
    category: 'core',
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
    
    // Get Jazz account from CoState (passed directly to tool)
    const jazzAccount = accountCoState?.current
    if (!jazzAccount || !jazzAccount.$isLoaded) {
      throw new Error('Jazz account not loaded')
    }
    
    // Create entity using generic function
    const entity = await createEntityGeneric(jazzAccount, schemaName, entityData)
    
    // Clear input and update context using Jazz reactivity
    const updatedContext = { ...actor.context, error: null }
    actor.$jazz.set('context', updatedContext)
    
    console.log('[createEntityTool] ✅ Created entity:', entity.$jazz.id)
  },
}
```

**Key Patterns**:
- **Direct actor reference**: Tools receive `actor` instead of `data` object
- **Explicit accountCoState**: Passed as third parameter
- **Jazz reactivity**: Use `actor.$jazz.set('context', newContext)` for proper reactivity
- **No direct mutations**: Create new context objects instead of mutating
- **Reactive queries**: UI subscribes to Jazz data via `useQuery`

---

## 📦 Tool Modules

### Core Module (Builtin - `core.module.ts`)

Generic CRUD and database operations:

```typescript
// Entity CRUD
'@core/createEntity'         // Create new entity (any schema)
'@core/updateEntity'         // Update existing entity
'@core/deleteEntity'         // Delete entity
'@core/toggleStatus'         // Toggle status field
'@core/clearEntities'        // Clear all entities of a type

// Schema Management
'@core/createSchema'         // Create Entity or Relation schema

// Relation CRUD
'@core/createRelation'       // Create relation instance
'@core/updateRelation'       // Update relation
'@core/deleteRelation'       // Delete relation

// Database Management
'@core/resetDatabase'        // Clear all data

// Example usage
const actor = Actor.create({
  context: { visible: true, queries: { items: { schemaName: 'Item', items: [] } } },
}, group)
actor.subscriptions.$jazz.push(actor.$jazz.id)
```

### Context Module (Builtin - `context.module.ts`)

UI state and context management:

```typescript
// Context Updates
'@context/update'            // Update actor context properties
'@context/swapActors'        // Swap actor IDs in children array
'@context/handleKeyDown'     // Handle keyboard events

// Input Field Management
'@context/updateInput'       // Update input field value
'@context/clearInput'        // Clear input field

// Visibility
'@context/toggleVisible'     // Toggle visibility flag

// Navigation
'@context/navigate'          // Navigate between vibes

// Drag-and-Drop
'@context/dragStart'         // Start drag operation (store state)
'@context/dragEnd'           // End drag operation (clear state)
'@context/drop'              // Handle drop (update entity + clear drag state)

// Example: Context update
await ToolEngine.execute('@context/update', actor, {
  viewMode: 'kanban',
  selectedId: 'co_abc123'
})
```

### AI Module (Optional - `ai.module.ts`)

AI and LLM interactions:

```typescript
// AI Operations
'@ai/chatRedPill'            // Chat with RedPill AI

// Example: Must register optional modules first
import { registerAllTools } from '$lib/compositor/tools'
registerAllTools() // Registers core, context, ai, human

await ToolEngine.execute('@ai/chatRedPill', actor, {
  message: 'Hello AI!',
  systemPrompt: 'You are a helpful assistant.'
})
```

### Human Module (Optional - `human.module.ts`)

Domain-specific convenience tools:

```typescript
// Human-specific
'@human/createRandom'        // Create random human entity with generated data

// Example
await ToolEngine.execute('@human/createRandom', actor, {}, accountCoState)
```

### Custom Modules

Create your own tool modules:

```typescript
// myapp.module.ts
export const myAppModule: ToolModule = {
  name: 'myapp',
  version: '1.0.0',
  builtin: false,
  tools: {
    '@myapp/sendEmail': { /* ... */ },
    '@myapp/generateReport': { /* ... */ },
    '@myapp/calculateScore': { /* ... */ },
  }
}

// Register in your app
import { toolModuleRegistry } from '$lib/compositor/tools'
toolModuleRegistry.register(myAppModule)
```

---

## 🔧 Using Tools

### Direct Execution in Actors

Tools execute directly when messages arrive at an actor's inbox:

```typescript
const myActor = Actor.create({
  context: { visible: true, newItemText: '' },
  view: {
    // ... view definition with events
    events: {
      click: {
        event: '@core/createEntity',
        payload: { 
          schemaName: 'Item',
          entityData: { name: 'context.newItemText' }
        }
      }
    }
  },
}, group)

// Actor subscribes to itself to handle events
myActor.subscriptions.$jazz.push(myActor.$jazz.id)

// When message arrives, ActorEngine executes tool via ToolEngine
```

### Standalone Execution

Execute tools programmatically using `ToolEngine`:

```typescript
import { ToolEngine } from '$lib/compositor/tools'

// Execute tool directly
await ToolEngine.execute('@core/createEntity', actor, {
  schemaName: 'Human',
  entityData: { name: 'Alice', email: 'alice@example.com' }
}, accountCoState)

// Use in any async function
async function createProject(actor: any, accountCoState: any) {
  await ToolEngine.execute('@core/createEntity', actor, {
    schemaName: 'Project',
    entityData: { name: 'My Project', description: 'A cool project' }
  }, accountCoState)
}
```

### From ActorEngine (Automatic Tool Execution)

The `ActorEngine` automatically calls tools when processing messages:

```typescript
// 1. Actor handles events directly
const actor = Actor.create({
  context: { visible: true, queries: { items: { schemaName: 'Item', items: [] } } },
}, group)
actor.subscriptions.$jazz.push(actor.$jazz.id)

// 2. ActorEngine processes messages and calls tools via ToolEngine
// (from ActorEngine.svelte)
$effect(() => {
  // ... message collection from CoFeed inbox ...
  
  for (const message of allMessages) {
    const messageId = message.$jazz?.id
    if (!messageId || consumedMessageIds.has(messageId)) {
      continue
    }
    
    // Mark as consumed BEFORE execution
    consumedMessageIds.add(messageId)
    
    // Execute tool through ToolEngine (unified pattern)
    ToolEngine.execute(event, actor, payload, accountCoState)
      .catch(error => {
        console.error(`[ActorEngine] Tool execution failed:`, error)
      })
    
    // Mark as consumed
    processedMessageIds.add(messageId)
  }
})

// No additional wiring needed!
// Tools are called automatically when messages arrive
```

**How It Works**:
1. **Message arrives** in actor's inbox (CoFeed)
2. **ActorEngine detects** via reactive `$effect`
3. **Tool loaded** from module registry via `toolModuleRegistry.getTool(message.type)`
4. **Tool executed** via `ToolEngine.execute(toolId, actor, payload, accountCoState)`
5. **Tool mutates** Jazz CoValues using `actor.$jazz.set()` for reactivity
6. **UI updates** reactively via `useQuery` subscriptions

---

## 🏗️ Creating Custom Tool Modules

### Step 1: Define Your Tool Module

```typescript
// myapp.module.ts
import type { ToolModule, Tool } from '$lib/compositor/tools'

const sendEmailTool: Tool = {
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
    
    console.log('[sendEmailTool] Sending email to:', to)
    
    // Your email sending logic
    await sendEmail({ to, subject, body })
    
    console.log('[sendEmailTool] ✅ Email sent successfully')
    
    // Update context using Jazz reactivity
    const updatedContext = { ...actor.context, emailSent: true }
    actor.$jazz.set('context', updatedContext)
  },
}

export const myAppModule: ToolModule = {
  name: 'myapp',
  version: '1.0.0',
  builtin: false,
  tools: {
    '@myapp/sendEmail': sendEmailTool,
    // Add more tools here
  }
}
```

**Key Patterns**:
- **Module structure**: Group related tools into modules
- **Tool signature**: `(actor, payload, accountCoState)` 
- **Jazz reactivity**: Use `actor.$jazz.set('context', newContext)` not direct mutation
- **MaiaScript integration**: ToolEngine evaluates MaiaScript expressions in payloads

### Step 2: Register Your Module

```typescript
// In your app initialization (e.g., +page.svelte or hooks.server.ts)
import { toolModuleRegistry } from '$lib/compositor/tools'
import { myAppModule } from './myapp.module'

// Register your custom module
toolModuleRegistry.register(myAppModule)
```

Or use the convenience function:

```typescript
// tools/index.ts
import { toolModuleRegistry } from './module-registry'
import { myAppModule } from './myapp.module'

// Auto-register on import
toolModuleRegistry.register(myAppModule)
```

### Step 3: Use in Actor

```typescript
const actor = Actor.create({
  context: { visible: true, emailSent: false },
  view: {
    events: {
      click: {
        event: '@myapp/sendEmail',
        payload: { 
          to: 'user@example.com',
          subject: 'Hello',
          body: 'context.messageText' // MaiaScript resolves this
        }
      }
    }
  },
}, group)
actor.subscriptions.$jazz.push(actor.$jazz.id)
// Tools execute automatically via ActorEngine + ToolEngine
```

---

## 🎓 Tool Patterns

### Pattern 1: Generic CRUD Tool

Works with any entity type:

```typescript
const updateEntityTool: Tool = {
  metadata: {
    id: '@core/updateEntity',
    name: 'Update Entity',
    description: 'Updates any entity with provided data',
    category: 'core',
  },
  execute: async (actor: any, payload?: unknown, accountCoState?: any) => {
    const { id, updates } = payload as { id: string; updates: Record<string, unknown> }
    
    // Get Jazz account
    const jazzAccount = accountCoState?.current
    if (!jazzAccount?.$isLoaded) throw new Error('Account not loaded')
    
    // Update using generic function
    await updateEntityGeneric(jazzAccount, id, updates)
    
    // Update context using Jazz reactivity
    const updatedContext = { ...actor.context, error: null }
    actor.$jazz.set('context', updatedContext)
  },
}
```

### Pattern 2: Context Update Tool

Updates actor context with proper Jazz reactivity:

```typescript
const updateContextTool: Tool = {
  metadata: {
    id: '@context/update',
    name: 'Update Context',
    description: 'Updates actor context properties',
    category: 'context',
  },
  execute: async (actor: any, payload?: unknown) => {
    const updates = payload as Record<string, unknown>
    
    // CORRECT: Create new context object for Jazz reactivity
    const currentContext = actor.context as Record<string, unknown>
    const updatedContext = { ...currentContext, ...updates }
    actor.$jazz.set('context', updatedContext)
  },
}

// Use in actor
const actor = Actor.create({
  context: { visible: true, newItemText: '', viewMode: 'list' },
  view: {
    events: {
      input: {
        event: '@context/update',
        payload: { newItemText: 'event.target.value' } // MaiaScript resolves
      }
    }
  },
}, group)
actor.subscriptions.$jazz.push(actor.$jazz.id)
```

### Pattern 3: View Swapping Tool

Swaps actors for different UI views:

```typescript
const swapActorsTool: Tool = {
  metadata: {
    id: '@context/swapActors',
    name: 'Swap Actors',
    description: 'Swaps actor IDs in children array',
    category: 'context',
  },
  execute: async (actor: any, payload?: unknown) => {
    const { targetIndex, newActorId } = payload as { 
      targetIndex: number
      newActorId: string 
    }
    
    // Update children array with Jazz reactivity
    const currentChildren = [...(actor.children as any[])]
    currentChildren[targetIndex] = newActorId
    actor.$jazz.set('children', currentChildren)
  },
}
```

### Pattern 4: MaiaScript DSL Integration

Tools automatically evaluate MaiaScript expressions in payloads:

```typescript
// In your actor configuration:
const actor = Actor.create({
  context: { newTodoText: '', items: [] },
  view: {
    events: {
      submit: {
        event: '@core/createEntity',
        payload: {
          schemaName: 'Todo',
          entityData: {
            name: 'context.newTodoText',  // ← String path (DSL resolves)
            status: 'todo',
            endDate: {  // ← MaiaScript expression
              "$toISOString": [
                { "$add": [
                  { "$now": [] },
                  { "$multiply": [7, 86400000] }
                ]}
              ]
            }
          }
        }
      }
    }
  },
}, group)

// ToolEngine automatically evaluates:
// - String paths: 'context.newTodoText' → actual value from actor.context
// - MaiaScript ops: { $now: [] } → current timestamp
// - Nested expressions: Evaluated recursively
    
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
