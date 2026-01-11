---
name: ViewEngine + MaiaScript Modular Architecture (DETAILED)
overview: Complete detailed implementation plan with code examples and step-by-step instructions
status: Ready for Execution
phases: 8
---

# ViewEngine + MaiaScript Modular Architecture
## Complete Detailed Implementation Plan

**Last Updated:** 2026-01-11  
**Reference:** `/services/docs/vibes/TERMINOLOGY.md`

---

## 🎯 Executive Summary

Extract MaiaScript as standalone reusable library (`@maia/script`), unify Composite/Leaf into ViewEngine, modularize with pluggable modules, refactor factory conditionals. Clean slate migration across 8 testable phases.

**Key Improvements:**
1. ✅ **MaiaScript as Lib** - Extract to `libs/maia-script` (reusable across all services)
2. ✅ **FactoryEngine Rename** - `universal-factory.ts` → `factory-engine.ts`
3. ✅ **Unified Rendering** - `Composite + Leaf → ViewEngine`
4. ✅ **Engine Pattern** - All engines named consistently
5. ✅ **Modular Architecture** - Pluggable MaiaScript modules
6. ✅ **Factory Conditionals** - `$factoryIf`/`$factorySwitch` → `$if`/`$switch`
7. ✅ **Clean Migration** - No backward compatibility, DB reset OK

---

## 📋 Phase Overview

| Phase | Goal | Files | Testable Outcome |
|-------|------|-------|------------------|
| **1a** | Extract MaiaScript + Rename FactoryEngine | 3 create, 5 move, 1 rename, 10+ update | All vibes work with new imports |
| **1b** | ViewEngine + ActorEngine | 1 create, 1 rename, 3 delete, 5+ update | Unified rendering works |
| **2** | Binding Resolver Module | 1 create, 1 update | All bindings work |
| **3** | Event Handler Module | 1 create, 1 update | All events work |
| **4** | Module Registry Infrastructure | 3 create, 1 update | Registry works |
| **5** | Builtin Module | 1 create, 2 update | Operations via registry |
| **6** | Drag-Drop Module | 2 create, 3 update | Kanban drag-drop via modules |
| **7** | Security Module | 2 create, 3 update | Security validation works |
| **8** | Factory Conditionals Refactor | 0 create, 5+ update | Conditionals use core ops |

---

## 🏗️ Architecture & Terminology

### Engine Pattern

**Definition:** Components that take JSON MaiaScript config → running entities

- **ActorEngine** - `ActorRenderer.svelte` → `ActorEngine.svelte` (Phase 1b)
- **ViewEngine** - NEW unified `Composite + Leaf` (Phase 1b)
- **FactoryEngine** - `universal-factory.ts` → `factory-engine.ts` (Phase 1a)
- **MaiaScriptEngine** - `evaluator.ts` (conceptual name)

### MaiaScript Extraction

**Before:**
```
services/me/src/lib/compositor/dsl/
  ├── evaluator.ts
  ├── helpers.ts
  ├── validator.ts
  ├── types.ts
  └── index.ts
```

**After:**
```
libs/maia-script/
  ├── package.json (@maia/script)
  ├── tsconfig.json
  ├── README.md
  └── src/
      ├── evaluator.ts
      ├── helpers.ts
      ├── validator.ts
      ├── types.ts
      ├── index.ts
      └── modules/ (Phase 4+)
          ├── types.ts
          ├── registry.ts
          ├── index.ts
          ├── builtin.module.ts
          ├── dragdrop.module.ts
          ├── dragdrop.rules.json
          ├── security.module.ts
          └── security.rules.json
```

### Import Changes

**OLD:**
```typescript
import { safeEvaluate, isDSLExpression } from '../dsl'
import type { DSLExpression } from '../dsl/types'
import { createComposite, createLeaf } from '../runtime/universal-factory'
```

**NEW:**
```typescript
import { safeEvaluate, isMaiaScriptExpression } from '@maia/script'
import type { MaiaScriptExpression } from '@maia/script'
import { createComposite, createLeaf } from '../runtime/factory-engine'
```

---

## Phase 1a: Extract MaiaScript + Rename FactoryEngine

**Goal:** Move MaiaScript from `services/me` to `libs/maia-script` as reusable package + rename FactoryEngine

**Why:** Make MaiaScript independent, reusable across all services, complete Engine pattern

**Testable:** All vibes work with new import paths, all factories create components correctly

---

### Files to Create

#### [CREATE] `libs/maia-script/package.json`

```json
{
  "name": "@maia/script",
  "version": "0.17.0",
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "format": "bunx biome format --write .",
    "lint": "bunx biome lint .",
    "check": "bunx biome check ."
  }
}
```

#### [CREATE] `libs/maia-script/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### [CREATE] `libs/maia-script/README.md`

```markdown
# @maia/script

MaiaScript is MaiaOS's secure JSON-based expression language for runtime logic.

## Features

- ✅ Pure JSON syntax (no code execution)
- ✅ Sandboxed evaluation (secure from untrusted input)
- ✅ Whitelisted operations only
- ✅ Pluggable module system

## Installation

```bash
# In workspace package
"dependencies": {
  "@maia/script": "workspace:*"
}
```

## Usage

```typescript
import { safeEvaluate, isMaiaScriptExpression } from '@maia/script'
import type { MaiaScriptExpression } from '@maia/script'

const expr: MaiaScriptExpression = {
  "$if": {
    "test": { "$eq": [{ "$": "item.status" }, "done"] },
    "then": "bg-green-100",
    "else": "bg-gray-100"
  }
}

const result = safeEvaluate(expr, {
  item: { status: "done" }
})
// result: "bg-green-100"
```

## Core Operations

### Data Access
- `$` - Resolve data path

### Comparison
- `$eq`, `$neq`, `$gt`, `$gte`, `$lt`, `$lte`

### Logical
- `$and`, `$or`, `$not`

### Control Flow
- `$if`, `$switch`

### String
- `$concat`, `$trim`, `$toLowerCase`, `$toUpperCase`

### Date
- `$formatDate`

### Array
- `$length`, `$includes`, `$map`, `$filter`

### Math
- `$add`, `$subtract`, `$multiply`, `$divide`

## Architecture

```
src/
├── evaluator.ts      # MaiaScriptEngine (expression evaluator)
├── validator.ts      # Security validator
├── helpers.ts        # Utility functions
├── types.ts          # TypeScript definitions
├── index.ts          # Public API
└── modules/          # Pluggable modules (Phase 4+)
    ├── registry.ts   # Module registry
    ├── types.ts      # Module types
    ├── builtin.module.ts     # Core operations
    ├── dragdrop.module.ts    # Drag-drop capabilities
    └── security.module.ts    # Security validation
```

## API Reference

See `/services/docs/vibes/TERMINOLOGY.md` for complete documentation.

## License

MIT
```

---

### Files to Move

**Move all 5 DSL files:**

```bash
# Create directory
mkdir -p libs/maia-script/src

# Move files
mv services/me/src/lib/compositor/dsl/evaluator.ts libs/maia-script/src/
mv services/me/src/lib/compositor/dsl/helpers.ts libs/maia-script/src/
mv services/me/src/lib/compositor/dsl/validator.ts libs/maia-script/src/
mv services/me/src/lib/compositor/dsl/types.ts libs/maia-script/src/
mv services/me/src/lib/compositor/dsl/index.ts libs/maia-script/src/
```

**Files moved:**
1. `services/me/src/lib/compositor/dsl/evaluator.ts` → `libs/maia-script/src/evaluator.ts`
2. `services/me/src/lib/compositor/dsl/helpers.ts` → `libs/maia-script/src/helpers.ts`
3. `services/me/src/lib/compositor/dsl/validator.ts` → `libs/maia-script/src/validator.ts`
4. `services/me/src/lib/compositor/dsl/types.ts` → `libs/maia-script/src/types.ts`
5. `services/me/src/lib/compositor/dsl/index.ts` → `libs/maia-script/src/index.ts`

---

### Files to Rename

#### [RENAME] `universal-factory.ts` → `factory-engine.ts`

```bash
mv services/me/src/lib/factories/runtime/universal-factory.ts \
   services/me/src/lib/factories/runtime/factory-engine.ts
```

---

### Files to Update

#### [UPDATE] All files importing from `dsl`

**Search for files:**
```bash
grep -r "from.*dsl" services/me/src --include="*.ts" --include="*.svelte"
grep -r "from.*'\.\.\/dsl'" services/me/src --include="*.ts" --include="*.svelte"
grep -r "from.*'\.\.\/compositor/dsl'" services/me/src --include="*.ts" --include="*.svelte"
```

**Update pattern:**

```typescript
// OLD
import { safeEvaluate, isDSLExpression } from '../dsl'
import { safeEvaluate, isDSLExpression } from '../compositor/dsl'
import type { DSLExpression } from '../dsl/types'

// NEW
import { safeEvaluate, isMaiaScriptExpression } from '@maia/script'
import type { MaiaScriptExpression } from '@maia/script'
```

**Type name changes:**
- `DSLExpression` → `MaiaScriptExpression`
- `isDSLExpression()` → `isMaiaScriptExpression()`

**Files requiring updates (minimum):**
1. `services/me/src/lib/compositor/view/Composite.svelte`
2. `services/me/src/lib/compositor/view/Leaf.svelte`
3. `services/me/src/lib/factories/runtime/factory-engine.ts` (was universal-factory.ts)
4. `services/me/src/lib/vibes/todo/createTodosActors.ts`
5. `services/me/src/lib/vibes/humans/createHumansActors.ts`
6. `services/me/src/lib/vibes/vibes/createVibesActors.ts`

#### [UPDATE] All files importing from `universal-factory`

**Search for files:**
```bash
grep -r "from.*universal-factory" services/me/src --include="*.ts" --include="*.svelte"
```

**Update pattern:**

```typescript
// OLD
import { createComposite, createLeaf } from '../runtime/universal-factory'
import { createComposite, createLeaf } from './runtime/universal-factory'

// NEW
import { createComposite, createLeaf } from '../runtime/factory-engine'
import { createComposite, createLeaf } from './runtime/factory-engine'
```

**Files requiring updates:**
- All `.factory.ts` wrapper files (if any remain)
- All vibe creation files (`createTodosActors.ts`, `createHumansActors.ts`, `createVibesActors.ts`)
- `services/me/src/lib/factories/index.ts`

#### [UPDATE] `factory-engine.ts` internal imports

Update MaiaScript imports inside the renamed file:

```typescript
// services/me/src/lib/factories/runtime/factory-engine.ts

// OLD (at top of file)
import { safeEvaluate, isDSLExpression } from '../../compositor/dsl'
import type { DSLExpression } from '../../compositor/dsl/types'

// NEW
import { safeEvaluate, isMaiaScriptExpression } from '@maia/script'
import type { MaiaScriptExpression } from '@maia/script'

// Update type definitions
export interface UniversalFactoryDef {
  // OLD
  $factoryIf?: {
    test: DSLExpression
    then: any
    else?: any
  }
  
  // NEW
  $factoryIf?: {
    test: MaiaScriptExpression
    then: any
    else?: any
  }
}

// Update function calls
function substitute(obj: any, params: Record<string, any>): any {
  // OLD
  if (isDSLExpression(value)) {
    return value // Return DSL expression as-is
  }
  
  // NEW
  if (isMaiaScriptExpression(value)) {
    return value // Return MaiaScript expression as-is
  }
}
```

#### [UPDATE] `services/me/package.json`

Add workspace dependency:

```json
{
  "name": "me",
  "dependencies": {
    "@maia/script": "workspace:*",
    // ... other dependencies
  }
}
```

Then run:
```bash
bun install
```

---

### Files to Delete

#### [DELETE] `services/me/src/lib/compositor/dsl/` (entire folder)

```bash
rm -rf services/me/src/lib/compositor/dsl
```

---

### Test Checklist

- [ ] `bun install` runs successfully from root
- [ ] All TypeScript imports resolve correctly
- [ ] No TypeScript errors
- [ ] Todos vibe: List view works
- [ ] Todos vibe: Timeline view works
- [ ] Todos vibe: Kanban view with drag-drop works
- [ ] Humans vibe: List view works
- [ ] Vibes vibe: Grid view works
- [ ] All factory functions create components correctly
- [ ] No console errors
- [ ] No linter errors
- [ ] `bun run check` passes

---

## Phase 1b: Create ViewEngine + Rename ActorEngine

**Goal:** Unify Composite/Leaf rendering into ViewEngine, rename ActorRenderer → ActorEngine

**Why:** Simplify rendering architecture, complete Engine pattern naming

**Testable:** All 3 vibes render correctly with unified ViewEngine

---

### Files to Create

#### [CREATE] `services/me/src/lib/compositor/view/ViewEngine.svelte`

**Implementation Strategy:**
1. Start with `Composite.svelte` as base structure
2. Add Leaf rendering logic inside conditionals
3. Detect node type via `$derived`
4. Self-recursive (no separate recursive wrapper)
5. Copy ALL logic from both files (no changes yet)

**Key Sections:**
- Type detection (composite vs leaf)
- Registry resolution (both types)
- Schema resolution (both types)
- Foreach handling (composite and leaf)
- Event handling (all types)
- Drag-drop state
- Bindings resolution
- Self-recursion for children

**Full implementation:** (See detailed code in separate section below)

---

### Files to Rename

#### [RENAME] `ActorRenderer.svelte` → `ActorEngine.svelte`

```bash
mv services/me/src/lib/compositor/actors/ActorRenderer.svelte \
   services/me/src/lib/compositor/actors/ActorEngine.svelte
```

**Updates inside file:**
1. Update component docstring
2. Import ViewEngine instead of Composite
3. Import self for recursion (remove ActorRendererRecursive)
4. Update component usage

```svelte
<!-- services/me/src/lib/compositor/actors/ActorEngine.svelte -->

<!--
  ActorEngine Component
  Renders Jazz-native Actors with their views
  Engine Pattern: Actor JSON → Rendered DOM + State
-->
<script lang="ts">
  import type { ID } from "jazz-tools"
  import type { Account } from "$lib/schema"
  import { useCoState } from "$lib/jazz-utils"
  import ViewEngine from "../view/ViewEngine.svelte"
  
  // Self-recursion (Svelte 5 supports this natively)
  import ActorEngine from "./ActorEngine.svelte"
  
  // ... rest of component logic ...
  
  // Replace Composite usage with ViewEngine
  {#if actor && actor.view}
    <ViewEngine 
      node={actor.view}
      {data}
      {onEvent}
    />
  {/if}
  
  // Child actors: use ActorEngine (self-recursion)
  {#if childActorIds}
    {#each childActorIds as childId}
      <ActorEngine actorId={childId} {accountCoState} />
    {/each}
  {/if}
</script>
```

---

### Files to Delete

#### [DELETE] `ActorRendererRecursive.svelte`

```bash
rm services/me/src/lib/compositor/actors/ActorRendererRecursive.svelte
```

**Why:** It's just a 3-line wrapper. Svelte 5 supports self-recursion natively.

#### [DELETE] `Composite.svelte` (after Phase 1b is stable)

```bash
# DON'T delete yet - keep for rollback during testing
# Delete after Phase 1b is confirmed stable
rm services/me/src/lib/compositor/view/Composite.svelte
```

#### [DELETE] `Leaf.svelte` (after Phase 1b is stable)

```bash
# DON'T delete yet - keep for rollback during testing
# Delete after Phase 1b is confirmed stable
rm services/me/src/lib/compositor/view/Leaf.svelte
```

---

### Files to Update

#### [UPDATE] All files importing `ActorRenderer` or `ActorRendererRecursive`

**Search:**
```bash
grep -r "ActorRenderer" services/me/src --include="*.ts" --include="*.svelte"
```

**Update pattern:**

```svelte
<!-- OLD -->
<script>
  import ActorRenderer from '$lib/compositor/actors/ActorRenderer.svelte'
  import ActorRendererRecursive from '$lib/compositor/actors/ActorRendererRecursive.svelte'
</script>

<ActorRenderer {actorId} {accountCoState} />
<ActorRendererRecursive {actorId} {accountCoState} />

<!-- NEW -->
<script>
  import ActorEngine from '$lib/compositor/actors/ActorEngine.svelte'
</script>

<ActorEngine {actorId} {accountCoState} />
```

**Files requiring updates:**
1. `services/me/src/routes/vibes/+page.svelte` (main vibes page)
2. `services/me/src/routes/+layout.svelte` (if used)
3. `services/me/src/lib/compositor/view/ViewEngine.svelte` (new file, uses ActorEngine for child actors)
4. Any other files referencing ActorRenderer

---

### Test Checklist

- [ ] Todos vibe: List view renders correctly
- [ ] Todos vibe: Timeline view renders correctly
- [ ] Todos vibe: Kanban view with drag-drop works
- [ ] Humans vibe: List view renders correctly
- [ ] Vibes vibe: Grid view renders correctly
- [ ] Input bindings work (can type in text inputs)
- [ ] Button clicks work (can add/delete todos)
- [ ] View switcher works (switch between views)
- [ ] Drag-drop works (move todos between kanban columns)
- [ ] All data bindings update reactively
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] No linter errors

---

## Phase 2: Extract Binding Resolution Logic

**Goal:** Move binding resolution logic to separate module

**Why:** Reduce ViewEngine complexity, prepare for modular architecture

**Testable:** All bindings work, data changes trigger UI updates

---

### Files to Create

#### [CREATE] `services/me/src/lib/compositor/view/binding-resolver.ts`

```typescript
import { safeEvaluate, isMaiaScriptExpression } from '@maia/script'
import type { MaiaScriptExpression } from '@maia/script'
import { resolveDataPath } from './resolver'

/**
 * Resolve a binding to a concrete value
 * Supports both data paths and MaiaScript expressions
 */
export function resolveBinding(
  binding: string | MaiaScriptExpression | undefined,
  data: Record<string, any>
): unknown {
  if (!binding) return undefined
  
  // MaiaScript expression
  if (isMaiaScriptExpression(binding)) {
    try {
      return safeEvaluate(binding, {
        item: "item" in data ? data.item : undefined,
        context: "context" in data ? data.context : undefined,
        dependencies: "dependencies" in data ? data.dependencies : undefined
      })
    } catch (error) {
      console.warn('[BindingResolver] MaiaScript evaluation error:', error)
      return undefined
    }
  }
  
  // Simple data path
  if (typeof binding === 'string') {
    return resolveDataPath(data, binding)
  }
  
  return undefined
}

/**
 * Resolve all bindings in a bindings object
 */
export function resolveBindings(
  bindings: Record<string, any> | undefined,
  data: Record<string, any>
): Record<string, any> {
  if (!bindings) return {}
  
  const resolved: Record<string, any> = {}
  for (const [key, value] of Object.entries(bindings)) {
    resolved[key] = resolveBinding(value, data)
  }
  return resolved
}

/**
 * Helper: Evaluate visibility binding (returns boolean)
 */
export function resolveVisibility(
  visibilityBinding: string | MaiaScriptExpression | undefined,
  data: Record<string, any>
): boolean {
  if (!visibilityBinding) return true
  
  const value = resolveBinding(visibilityBinding, data)
  return value !== undefined && value !== null && value !== false
}

/**
 * Helper: Resolve class binding (returns string)
 */
export function resolveClass(
  classBinding: string | MaiaScriptExpression | undefined,
  data: Record<string, any>
): string {
  if (!classBinding) return ''
  
  const value = resolveBinding(classBinding, data)
  return typeof value === 'string' ? value : ''
}

/**
 * Helper: Resolve text binding (returns string)
 */
export function resolveText(
  textBinding: string | MaiaScriptExpression | undefined,
  data: Record<string, any>
): string {
  if (!textBinding) return ''
  
  const value = resolveBinding(textBinding, data)
  return value !== undefined ? String(value) : ''
}

/**
 * Helper: Resolve disabled binding (returns boolean)
 */
export function resolveDisabled(
  disabledBinding: string | MaiaScriptExpression | undefined,
  data: Record<string, any>
): boolean {
  if (!disabledBinding) return false
  
  const value = resolveBinding(disabledBinding, data)
  return Boolean(value)
}
```

---

### Files to Update

#### [UPDATE] `services/me/src/lib/compositor/view/ViewEngine.svelte`

Replace inline `resolveValue()` with binding resolver:

```svelte
<script lang="ts">
  // Add import
  import { 
    resolveBinding, 
    resolveVisibility, 
    resolveClass,
    resolveText,
    resolveDisabled 
  } from './binding-resolver'
  
  // Remove inline resolveValue() function
  
  // Update derived states
  const boundText = $derived.by(() => {
    return resolveText(node.leaf?.bindings?.text, data)
  })
  
  const boundClass = $derived.by(() => {
    const staticClasses = node.leaf?.classes || node.composite?.container?.class || ''
    const dynamicClasses = resolveClass(
      node.leaf?.bindings?.class || node.composite?.bindings?.class,
      data
    )
    return [staticClasses, dynamicClasses].filter(Boolean).join(' ')
  })
  
  const isVisible = $derived.by(() => {
    return resolveVisibility(
      node.leaf?.bindings?.visible || node.composite?.bindings?.visible,
      data
    )
  })
  
  const isDisabled = $derived.by(() => {
    return resolveDisabled(node.leaf?.bindings?.disabled, data)
  })
</script>
```

---

### Test Checklist

- [ ] Input value bindings work (can edit todos)
- [ ] Text bindings work (dynamic text updates)
- [ ] Class bindings work (conditional CSS classes)
- [ ] Visibility bindings work (show/hide elements)
- [ ] Disabled bindings work (button enable/disable states)
- [ ] All vibes render correctly
- [ ] Data changes trigger UI updates
- [ ] No console errors

---

## Phase 3: Extract Event Handling Logic

**Goal:** Move event handling logic to separate module

**Why:** Prepare for modular event middleware, reduce ViewEngine complexity

**Testable:** All events work (clicks, inputs, drags, etc.)

---

### Files to Create

#### [CREATE] `services/me/src/lib/compositor/view/event-handler.ts`

```typescript
import { resolveDataPath } from './resolver'

/**
 * Resolve event payload (data paths → values)
 */
export function resolvePayload(
  payload: Record<string, unknown> | string | ((data: unknown) => unknown) | undefined,
  data: Record<string, any>
): unknown {
  if (!payload) return undefined
  
  // String data path
  if (typeof payload === 'string') {
    const value = resolveDataPath(data, payload)
    // Wrap ID paths as { id: value }
    if (payload.endsWith('.id') || payload === 'item.id' || payload === 'data.item.id') {
      return { id: value }
    }
    return value
  }
  
  // Function payload
  if (typeof payload === 'function') {
    return payload(data)
  }
  
  // Object payload (resolve nested paths)
  if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
    const resolved: Record<string, unknown> = {}
    const DATA_PATH_ROOTS = ['data.', 'item.', 'context.', 'queries.', 'view.', 'dependencies.']
    
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === 'string') {
        // Check if it's a data path
        const isDataPath = DATA_PATH_ROOTS.some(
          root => value.startsWith(root) && value.length > root.length
        )
        resolved[key] = isDataPath ? resolveDataPath(data, value) : value
      } else {
        resolved[key] = value
      }
    }
    return resolved
  }
  
  return payload
}

/**
 * Create standard event handler function
 */
export function createEventHandler(
  eventConfig: { event: string; payload?: any },
  data: Record<string, any>,
  onEvent: (event: string, payload?: unknown) => void
): (e: Event) => void {
  return (e: Event) => {
    const payload = resolvePayload(eventConfig.payload, data)
    onEvent(eventConfig.event, payload)
  }
}

/**
 * Create click event handler
 */
export function createClickHandler(
  eventConfig: { event: string; payload?: any },
  data: Record<string, any>,
  onEvent: (event: string, payload?: unknown) => void
): (e: MouseEvent) => void {
  return (e: MouseEvent) => {
    const payload = resolvePayload(eventConfig.payload, data)
    onEvent(eventConfig.event, payload)
  }
}

/**
 * Create submit event handler (prevents default)
 */
export function createSubmitHandler(
  eventConfig: { event: string; payload?: any },
  data: Record<string, any>,
  onEvent: (event: string, payload?: unknown) => void
): (e: Event) => void {
  return (e: Event) => {
    e.preventDefault()
    const payload = resolvePayload(eventConfig.payload, data)
    onEvent(eventConfig.event, payload)
  }
}

/**
 * Create input event handler (extracts value from event)
 */
export function createInputHandler(
  eventConfig: { event: string; payload?: any },
  data: Record<string, any>,
  onEvent: (event: string, payload?: unknown) => void,
  fieldName: string = 'text'
): (e: Event) => void {
  return (e: Event) => {
    const target = e.target as HTMLInputElement
    const inputValue = target.value
    
    // Merge input value with payload
    const basePayload = resolvePayload(eventConfig.payload, data)
    const payload = typeof basePayload === 'object' && basePayload !== null
      ? { ...basePayload, [fieldName]: inputValue }
      : { [fieldName]: inputValue }
    
    onEvent(eventConfig.event, payload)
  }
}

/**
 * Create drag start handler (stores ID in dataTransfer)
 */
export function createDragStartHandler(
  eventConfig: { event: string; payload?: any },
  data: Record<string, any>,
  onEvent: (event: string, payload?: unknown) => void
): (e: DragEvent) => void {
  return (e: DragEvent) => {
    if (!e.dataTransfer) return
    
    e.dataTransfer.effectAllowed = 'move'
    
    // Resolve payload
    const payload = resolvePayload(eventConfig.payload, data)
    
    // Store ID in dataTransfer
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const payloadObj = payload as Record<string, unknown>
      if ('id' in payloadObj) {
        e.dataTransfer.setData('text/plain', String(payloadObj.id))
      }
    } else if (typeof payload === 'string') {
      e.dataTransfer.setData('text/plain', payload)
    }
    
    // Notify actor (optional)
    if (eventConfig.event) {
      onEvent(eventConfig.event, payload)
    }
  }
}

/**
 * Create drop handler (merges draggedId with payload)
 */
export function createDropHandler(
  eventConfig: { event: string; payload?: any },
  data: Record<string, any>,
  onEvent: (event: string, payload?: unknown) => void
): (e: DragEvent) => void {
  return (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Get dragged ID from dataTransfer
    const draggedId = e.dataTransfer?.getData('text/plain')
    const dropPayload = resolvePayload(eventConfig.payload, data)
    
    // Merge draggedId with drop payload
    if (draggedId && dropPayload && typeof dropPayload === 'object' && !Array.isArray(dropPayload)) {
      onEvent(eventConfig.event, { id: draggedId, ...dropPayload })
    } else if (draggedId) {
      onEvent(eventConfig.event, { id: draggedId })
    } else {
      onEvent(eventConfig.event, dropPayload)
    }
  }
}

/**
 * Create drag over handler (allows drop)
 */
export function createDragOverHandler(): (e: DragEvent) => void {
  return (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
  }
}

/**
 * Create drag enter handler (visual feedback)
 */
export function createDragEnterHandler(
  eventConfig: { event: string; payload?: any } | undefined,
  data: Record<string, any>,
  onEvent: ((event: string, payload?: unknown) => void) | undefined,
  setDragOver: (value: boolean) => void
): (e: DragEvent) => void {
  return (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
    setDragOver(true)
    if (eventConfig && onEvent) {
      const payload = resolvePayload(eventConfig.payload, data)
      onEvent(eventConfig.event, payload)
    }
  }
}

/**
 * Create drag leave handler (remove visual feedback)
 */
export function createDragLeaveHandler(
  eventConfig: { event: string; payload?: any } | undefined,
  data: Record<string, any>,
  onEvent: ((event: string, payload?: unknown) => void) | undefined,
  setDragOver: (value: boolean) => void
): (e: DragEvent) => void {
  return (e: DragEvent) => {
    // Only remove drag-over state if actually leaving
    const rect = (e.currentTarget as HTMLElement)?.getBoundingClientRect()
    if (rect && (
      e.clientX < rect.left || 
      e.clientX > rect.right || 
      e.clientY < rect.top || 
      e.clientY > rect.bottom
    )) {
      setDragOver(false)
    }
    if (eventConfig && onEvent) {
      const payload = resolvePayload(eventConfig.payload, data)
      onEvent(eventConfig.event, payload)
    }
  }
}
```

---

### Files to Update

#### [UPDATE] `services/me/src/lib/compositor/view/ViewEngine.svelte`

Replace inline event handlers with event-handler module:

```svelte
<script lang="ts">
  // Add import
  import {
    createEventHandler,
    createClickHandler,
    createSubmitHandler,
    createInputHandler,
    createDragStartHandler,
    createDropHandler,
    createDragOverHandler,
    createDragEnterHandler,
    createDragLeaveHandler
  } from './event-handler'
  
  // Remove inline handleEvent() and resolvePayload() functions
  
  // Drag-over state for visual feedback
  let isDragOver = $state(false)
  
  // Use event handlers in template
</script>

<!-- In template -->
<svelte:element
  this={tag}
  onclick={node.events?.click && onEvent
    ? createClickHandler(node.events.click, data, onEvent)
    : undefined}
  onsubmit={node.events?.submit && onEvent
    ? createSubmitHandler(node.events.submit, data, onEvent)
    : undefined}
  ondragstart={node.events?.dragstart && onEvent
    ? createDragStartHandler(node.events.dragstart, data, onEvent)
    : undefined}
  ondragover={node.events?.dragover
    ? createDragOverHandler()
    : undefined}
  ondragenter={node.events?.dragenter
    ? createDragEnterHandler(node.events.dragenter, data, onEvent, (v) => isDragOver = v)
    : undefined}
  ondragleave={node.events?.dragleave
    ? createDragLeaveHandler(node.events.dragleave, data, onEvent, (v) => isDragOver = v)
    : undefined}
  ondrop={node.events?.drop && onEvent
    ? (e) => {
        const handler = createDropHandler(node.events!.drop!, data, onEvent)
        handler(e)
        isDragOver = false
      }
    : undefined}
  <!-- ... other attributes ... -->
/>
```

---

### Test Checklist

- [ ] Click events work (buttons, checkboxes)
- [ ] Input events work (text inputs update context)
- [ ] Submit events work (forms submit correctly)
- [ ] Blur events work (input updates on blur)
- [ ] Drag events work (dragstart, drop, dragend)
- [ ] Drop payload merging works (kanban drag-drop)
- [ ] Drag visual feedback works (background changes)
- [ ] All vibes work correctly
- [ ] No console errors

---

## Phase 4: Create MaiaScript Module Registry Infrastructure

**Goal:** Create module registry system in `libs/maia-script/src/modules/`

**Why:** Enable pluggable MaiaScript extensions (drag-drop, security, etc.)

**Testable:** Infrastructure works, no behavior changes

---

### Files to Create

#### [CREATE] `libs/maia-script/src/modules/types.ts`

```typescript
/**
 * MaiaScript Module - Pluggable extension
 */
export interface MaiaScriptModule {
  name: string
  version: string
  operations: Record<string, MaiaScriptOperation>
  capabilities?: Record<string, Capability>
}

/**
 * MaiaScript Operation - Single atomic function
 */
export interface MaiaScriptOperation {
  name: string
  evaluate: (args: any[], ctx: EvaluationContext) => unknown
  validate?: (args: any[]) => ValidationResult
}

/**
 * Evaluation Context - Data scope for MaiaScript expressions
 */
export interface EvaluationContext {
  item?: Record<string, unknown>
  context?: Record<string, unknown>
  dependencies?: Record<string, unknown>
}

/**
 * Capability - Declarative node enhancement
 */
export interface Capability {
  name: string
  apply: (node: ViewNode, data: Record<string, any>) => ViewNode
}

/**
 * ViewNode - Generic type (imported from view system)
 * Note: This creates a dependency - consider moving to shared types
 */
export interface ViewNode {
  slot?: string
  composite?: any
  compositeId?: string
  leaf?: any
  leafId?: string
  capabilities?: string[]
}

/**
 * Validation Result
 */
export interface ValidationResult {
  valid: boolean
  errors?: string[]
}
```

#### [CREATE] `libs/maia-script/src/modules/registry.ts`

```typescript
import type { MaiaScriptModule, MaiaScriptOperation, Capability } from './types'

/**
 * MaiaScript Module Registry
 * Central plugin system for MaiaScript extensions
 */
class MaiaScriptModuleRegistry {
  private modules = new Map<string, MaiaScriptModule>()
  private operations = new Map<string, MaiaScriptOperation>()
  private capabilities = new Map<string, Capability>()

  /**
   * Register a MaiaScript module
   * Auto-registers all operations and capabilities
   */
  register(module: MaiaScriptModule): void {
    if (this.modules.has(module.name)) {
      console.warn(
        `[MaiaScript] Module "${module.name}" already registered, overwriting`
      )
    }
    
    this.modules.set(module.name, module)
    
    // Register all operations from this module
    for (const [opName, operation] of Object.entries(module.operations)) {
      if (this.operations.has(opName)) {
        console.warn(
          `[MaiaScript] Operation "${opName}" already registered, overwriting`
        )
      }
      this.operations.set(opName, operation)
    }
    
    // Register all capabilities from this module
    if (module.capabilities) {
      for (const [capName, capability] of Object.entries(module.capabilities)) {
        if (this.capabilities.has(capName)) {
          console.warn(
            `[MaiaScript] Capability "${capName}" already registered, overwriting`
          )
        }
        this.capabilities.set(capName, capability)
      }
    }
    
    console.log(
      `[MaiaScript] Registered module: ${module.name} v${module.version}`,
      {
        operations: Object.keys(module.operations).length,
        capabilities: module.capabilities ? Object.keys(module.capabilities).length : 0
      }
    )
  }

  /**
   * Get a MaiaScript operation by name
   */
  getOperation(name: string): MaiaScriptOperation | undefined {
    return this.operations.get(name)
  }

  /**
   * Get a capability by name
   */
  getCapability(name: string): Capability | undefined {
    return this.capabilities.get(name)
  }

  /**
   * Get a module by name
   */
  getModule(name: string): MaiaScriptModule | undefined {
    return this.modules.get(name)
  }

  /**
   * List all registered modules
   */
  listModules(): MaiaScriptModule[] {
    return Array.from(this.modules.values())
  }

  /**
   * List all registered operations
   */
  listOperations(): MaiaScriptOperation[] {
    return Array.from(this.operations.values())
  }

  /**
   * List all registered capabilities
   */
  listCapabilities(): Capability[] {
    return Array.from(this.capabilities.values())
  }

  /**
   * Check if an operation exists
   */
  hasOperation(name: string): boolean {
    return this.operations.has(name)
  }

  /**
   * Check if a capability exists
   */
  hasCapability(name: string): boolean {
    return this.capabilities.has(name)
  }

  /**
   * Check if a module exists
   */
  hasModule(name: string): boolean {
    return this.modules.has(name)
  }

  /**
   * Clear all registered modules (for testing)
   */
  clear(): void {
    this.modules.clear()
    this.operations.clear()
    this.capabilities.clear()
  }
}

/**
 * Global singleton registry
 */
export const maiaScriptModuleRegistry = new MaiaScriptModuleRegistry()
```

#### [CREATE] `libs/maia-script/src/modules/index.ts`

```typescript
export * from './types'
export * from './registry'
```

---

### Files to Update

#### [UPDATE] `libs/maia-script/src/index.ts`

Add module exports:

```typescript
// Existing exports
export * from './evaluator'
export * from './validator'
export * from './helpers'
export * from './types'

// NEW: Module system exports
export * from './modules'
```

---

### Test Checklist

- [ ] All vibes render correctly
- [ ] No behavior changes
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Registry exports work correctly
- [ ] Can import from `@maia/script` modules

---

## Phase 5: Move Existing MaiaScript to Builtin Module

**Goal:** Register existing MaiaScript operations as builtin module, update evaluator to use registry

**Why:** Enable modular operation system, prepare for pluggable extensions

**Testable:** All MaiaScript expressions work via registry

---

### Files to Create

#### [CREATE] `libs/maia-script/src/modules/builtin.module.ts`

**(See full detailed implementation in original plan - this is a large file)**

Key structure:
```typescript
import { maiaScriptModuleRegistry } from './registry'
import type { MaiaScriptModule } from './types'
// Import all operation functions from evaluator.ts

const builtinModule: MaiaScriptModule = {
  name: 'builtin',
  version: '1.0.0',
  operations: {
    // Data access
    '$': { name: '$', evaluate: resolvePath },
    
    // Comparison
    '$eq': { name: '$eq', evaluate: equal },
    '$neq': { name: '$neq', evaluate: notEqual },
    // ... all operations ...
  }
}

// Auto-register on import
maiaScriptModuleRegistry.register(builtinModule)

export { builtinModule }
```

---

### Files to Update

#### [UPDATE] `libs/maia-script/src/evaluator.ts`

Update to use registry:

```typescript
import { maiaScriptModuleRegistry } from './modules/registry'

// Export operation functions for builtin module to use
export function resolvePath(operands: any[], ctx: EvaluationContext): unknown {
  // ... existing logic ...
}

export function equal(operands: any[], ctx: EvaluationContext): boolean {
  // ... existing logic ...
}

// ... export all operations ...

export function evaluate(ast: AST, ctx: EvaluationContext): unknown {
  // ... existing validation ...
  
  const opKey = Object.keys(ast)[0]
  const operands = ast[opKey]
  
  // NEW: Try registry first
  const registeredOp = maiaScriptModuleRegistry.getOperation(opKey)
  if (registeredOp) {
    return registeredOp.evaluate(operands, ctx)
  }
  
  // FALLBACK: Existing hardcoded logic (keep during migration)
  console.warn(`[MaiaScript] Operation "${opKey}" not found in registry, using fallback`)
  switch (opKey) {
    case '$': return resolvePath(operands, ctx)
    case '$eq': return equal(operands, ctx)
    // ... rest of existing cases ...
    default:
      throw new Error(`Unknown operation: ${opKey}`)
  }
}
```

#### [UPDATE] `services/me/src/routes/+layout.svelte`

Import builtin module at app startup:

```svelte
<script lang="ts">
  // Existing imports...
  import { browser } from '$app/environment'
  
  // NEW: Import builtin MaiaScript module (auto-registers)
  import '@maia/script/modules/builtin.module'
  
  // ... rest of component ...
</script>
```

---

### Test Checklist

- [ ] Console shows "Registered module: builtin v1.0.0"
- [ ] All MaiaScript operations work ($eq, $if, $formatDate, etc.)
- [ ] Todos vibe: All views work (list, timeline, kanban)
- [ ] Humans vibe: Date formatting works
- [ ] Vibes vibe: All bindings work
- [ ] No fallback warnings in console
- [ ] No errors

---

## Phase 6: Create Drag-Drop Capability Module

**Goal:** Move drag-drop logic to capability module

**Why:** Declarative drag-drop via JSON, modular architecture

**Testable:** Kanban drag-drop works via module system

---

### Files to Create

**(See full detailed implementations in original plan)**

1. `libs/maia-script/src/modules/dragdrop.module.ts`
2. `libs/maia-script/src/modules/dragdrop.rules.json`

---

### Files to Update

1. `ViewEngine.svelte` (capability support)
2. `kanban.factory.json` (optional: add capabilities)
3. `+layout.svelte` (import dragdrop module)

---

### Test Checklist

- [ ] Console shows "Registered module: dragdrop v1.0.0"
- [ ] Kanban drag-drop works
- [ ] Drag visual feedback works
- [ ] Drop merges payload correctly

---

## Phase 7: Create Security Validation Module

**Goal:** Move whitelist validation to security module

**Why:** JSON-editable security rules, modular validation

**Testable:** Security blocks invalid inputs

---

### Files to Create

1. `libs/maia-script/src/modules/security.module.ts`
2. `libs/maia-script/src/modules/security.rules.json`

---

### Files to Update

1. `ViewEngine.svelte` (security validation)
2. `whitelist.ts` (deprecate with notes)
3. `+layout.svelte` (import security module)

---

### Test Checklist

- [ ] Console shows "Registered module: security v1.0.0"
- [ ] Valid tags render
- [ ] Invalid tags blocked
- [ ] Valid classes render
- [ ] Invalid classes filtered

---

## Phase 8: Factory Conditionals Refactor

**Goal:** Refactor `$factoryIf`/`$factorySwitch` to use core `$if`/`$switch` operations

**Why:** Unify conditional logic, simplify MaiaScript, reduce duplication

**Testable:** All factories work with core conditionals

---

### Files to Update

#### [UPDATE] `services/me/src/lib/factories/runtime/factory-engine.ts`

Remove special factory conditionals, use core operations:

```typescript
// Remove $factoryIf and $factorySwitch handling

// OLD
if ('$factoryIf' in obj) {
  const condition = obj.$factoryIf
  const test = substitute(condition.test, params)
  const testResult = safeEvaluate(test, { context: params })
  return testResult 
    ? substitute(condition.then, params)
    : substitute(condition.else || {}, params)
}

// NEW: Just use safeEvaluate for ANY MaiaScript expression
function substitute(obj: any, params: Record<string, any>): any {
  // ... existing code ...
  
  // If entire value is a MaiaScript expression, evaluate it
  if (isMaiaScriptExpression(obj)) {
    return safeEvaluate(obj, { context: params })
  }
  
  // ... rest of substitute logic ...
}
```

#### [UPDATE] All factory JSON files using `$factoryIf` or `$factorySwitch`

Replace with core `$if` and `$switch`:

**Before:**
```json
{
  "$factoryIf": {
    "test": { "$eq": ["{{variant}}", "primary"] },
    "then": { "classes": "bg-blue-500" },
    "else": { "classes": "bg-gray-500" }
  }
}
```

**After:**
```json
{
  "$if": {
    "test": { "$eq": ["{{variant}}", "primary"] },
    "then": { "classes": "bg-blue-500" },
    "else": { "classes": "bg-gray-500" }
  }
}
```

**Files to update:**
- `services/me/src/lib/factories/leafs/badge.factory.json`
- Any other factory JSONs using `$factoryIf` or `$factorySwitch`

#### [UPDATE] Type definitions

Remove factory-specific types:

```typescript
// services/me/src/lib/factories/runtime/factory-engine.ts

export interface UniversalFactoryDef {
  $schema: 'composite-factory' | 'leaf-factory'
  parameters?: Record<string, ParameterDef>
  factory: any // Can contain any MaiaScript expressions (including $if, $switch)
  
  // REMOVE these:
  // $factoryIf?: { ... }
  // $factorySwitch?: { ... }
}
```

---

### Test Checklist

- [ ] All factories still create components correctly
- [ ] Badge factory works with different variants
- [ ] Conditional classes apply correctly
- [ ] All vibes work (todos, humans, vibes)
- [ ] No console errors about unknown operations
- [ ] Factory loading still works
- [ ] Parameters still substitute correctly

---

## 📦 Complete File Changes Summary

### Create: 17 files

**Phase 1a: MaiaScript Lib (3)**
1. `libs/maia-script/package.json`
2. `libs/maia-script/tsconfig.json`
3. `libs/maia-script/README.md`

**Phase 1b: ViewEngine (1)**
4. `services/me/src/lib/compositor/view/ViewEngine.svelte`

**Phase 2: Binding Resolver (1)**
5. `services/me/src/lib/compositor/view/binding-resolver.ts`

**Phase 3: Event Handler (1)**
6. `services/me/src/lib/compositor/view/event-handler.ts`

**Phase 4: Module Registry (3)**
7. `libs/maia-script/src/modules/types.ts`
8. `libs/maia-script/src/modules/registry.ts`
9. `libs/maia-script/src/modules/index.ts`

**Phase 5: Builtin Module (1)**
10. `libs/maia-script/src/modules/builtin.module.ts`

**Phase 6: Drag-Drop Module (2)**
11. `libs/maia-script/src/modules/dragdrop.module.ts`
12. `libs/maia-script/src/modules/dragdrop.rules.json`

**Phase 7: Security Module (2)**
13. `libs/maia-script/src/modules/security.module.ts`
14. `libs/maia-script/src/modules/security.rules.json`

### Move: 5 files

**Phase 1a:**
- `services/me/src/lib/compositor/dsl/*` → `libs/maia-script/src/`
  - evaluator.ts
  - helpers.ts
  - validator.ts
  - types.ts
  - index.ts

### Rename: 2 files

**Phase 1a:**
- `universal-factory.ts` → `factory-engine.ts`

**Phase 1b:**
- `ActorRenderer.svelte` → `ActorEngine.svelte`

### Update: 15+ files

**Phase 1a: Import Changes (10+)**
- All files importing from `dsl` (Composite, Leaf, factories, vibes)
- All files importing from `universal-factory`
- `factory-engine.ts` internal imports
- `services/me/package.json`

**Phase 1b: ActorEngine Usage (5+)**
- All files importing ActorRenderer/ActorRendererRecursive
- `ViewEngine.svelte` (uses ActorEngine)

**Phase 2: Binding Resolver (1)**
- `ViewEngine.svelte`

**Phase 3: Event Handler (1)**
- `ViewEngine.svelte`

**Phase 4: Module Registry (1)**
- `libs/maia-script/src/index.ts`

**Phase 5: Builtin Module (2)**
- `libs/maia-script/src/evaluator.ts`
- `services/me/src/routes/+layout.svelte`

**Phase 6: Drag-Drop Module (3)**
- `ViewEngine.svelte`
- `kanban.factory.json` (optional)
- `+layout.svelte`

**Phase 7: Security Module (3)**
- `ViewEngine.svelte`
- `whitelist.ts`
- `+layout.svelte`

**Phase 8: Factory Conditionals (5+)**
- `factory-engine.ts`
- `badge.factory.json`
- Any other factory JSONs using conditionals
- Type definitions

### Delete: 5 files

**Phase 1a:**
- `services/me/src/lib/compositor/dsl/` (folder)

**Phase 1b:**
- `ActorRendererRecursive.svelte` (immediately)
- `Composite.svelte` (after Phase 1b stable)
- `Leaf.svelte` (after Phase 1b stable)

**Phase 7:**
- `whitelist.ts` (after Phase 7 stable, v1.0.0)

---

## ✅ Testing Strategy

**After EACH Phase:**

1. **Todos Vibe:**
   - [ ] List view renders correctly
   - [ ] Timeline view renders correctly
   - [ ] Kanban view renders with drag-drop working
   - [ ] Can add new todos
   - [ ] Can delete todos
   - [ ] Can mark todos as done
   - [ ] Can drag todos between columns
   - [ ] View switcher works

2. **Humans Vibe:**
   - [ ] List view renders correctly
   - [ ] Names display correctly
   - [ ] Emails display correctly
   - [ ] Date formatting works

3. **Vibes Vibe:**
   - [ ] Grid view renders correctly
   - [ ] Can navigate to different vibes
   - [ ] Vibe cards render correctly

4. **General:**
   - [ ] No console errors
   - [ ] No TypeScript errors
   - [ ] No linter errors
   - [ ] `bun run check` passes
   - [ ] All interactions work smoothly

---

## 🚀 Execution Order

1. **Phase 1a** - Extract MaiaScript + Rename FactoryEngine (foundation)
2. **Phase 1b** - ViewEngine + ActorEngine (rendering unification)
3. **Phase 2** - Binding resolver (modularize bindings)
4. **Phase 3** - Event handler (modularize events)
5. **Phase 4** - Module registry (infrastructure)
6. **Phase 5** - Builtin module (migrate operations)
7. **Phase 6** - Drag-drop module (capabilities)
8. **Phase 7** - Security module (validation)
9. **Phase 8** - Factory conditionals refactor (unify conditionals)

**Each phase is independently testable! Stop if anything breaks, rollback, fix, continue.**

---

## 📝 Migration Notes

- ✅ **Clean Slate** - No backward compatibility (DB reset OK)
- ✅ **100% Migration** - No deprecation (except whitelist.ts temporary)
- ✅ **MaiaScript Reusable** - Can be used by any service
- ✅ **Engine Pattern** - Consistent naming throughout
- ✅ **Modular Architecture** - Pluggable extensions
- ✅ **Unified Conditionals** - One way to do conditionals
- ✅ **All 3 Vibes Tested** - Every phase

---

**Status:** ✅ Ready for Execution  
**Next Step:** Execute Phase 1a  
**Reference:** This document + `/services/docs/vibes/TERMINOLOGY.md`

---

## 🎯 Quick Start

```bash
# Start Phase 1a
cd /Users/samuelandert/Documents/Development/MaiaOS

# 1. Create MaiaScript lib
mkdir -p libs/maia-script/src
# ... follow Phase 1a steps ...

# 2. Test after each phase
bun run dev:me
# Open browser, test all 3 vibes

# 3. Commit after each successful phase
git add .
git commit -m "feat: Phase 1a - Extract MaiaScript lib + Rename FactoryEngine"
```

---

**Ready to execute? Let's go! 🚀**
