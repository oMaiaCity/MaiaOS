---
name: ViewEngine + MaiaScript Modular Architecture
overview: Extract MaiaScript as standalone lib, unify Composite/Leaf into ViewEngine, modularize with pluggable MaiaScript modules. Clean slate migration with 8 testable phases.
status: Ready for Execution
---

# ViewEngine + MaiaScript Modular Architecture (Complete Refactor)

**Last Updated:** 2026-01-11  
**Reference:** `/services/docs/vibes/TERMINOLOGY.md`

---

## 🎯 Executive Summary

Extract MaiaScript as standalone reusable library (`@maia/script`), unify Composite/Leaf into ViewEngine, modularize with pluggable modules. Clean slate migration across 8 testable phases.

**Key Improvements:**
1. ✅ **MaiaScript as Lib** - Extract to `libs/maia-script` (reusable across all services)
2. ✅ **Unified Rendering** - `Composite + Leaf → ViewEngine`
3. ✅ **Engine Pattern** - Consistent naming (ActorEngine, ViewEngine, **FactoryEngine**, MaiaScriptEngine)
4. ✅ **FactoryEngine Rename** - `universal-factory.ts` → `factory-engine.ts` (Phase 1a)
5. ✅ **Modular Architecture** - Pluggable MaiaScript modules
6. ✅ **Clean Migration** - No backward compatibility, DB reset OK

---

## 📋 Phase Overview

| Phase | Goal | Testable Outcome |
|-------|------|------------------|
| **1a** | Extract MaiaScript to `libs/maia-script` | All vibes work with new imports |
| **1b** | Create ViewEngine + Rename ActorEngine | All vibes work with unified rendering |
| **2** | Extract binding resolution logic | All bindings work reactively |
| **3** | Extract event handling logic | All events work |
| **4** | Create module registry infrastructure | Infrastructure works (no behavior change) |
| **5** | Move operations to builtin module | All operations work via registry |
| **6** | Create drag-drop capability module | Kanban drag-drop works via modules |
| **7** | Create security validation module | Security blocks invalid inputs |

---

## 🏗️ Architecture & Terminology

### Engine Pattern

**Definition:** Components that take JSON MaiaScript config → running entities

- **ActorEngine** (`ActorRenderer.svelte` → `ActorEngine.svelte`) - Phase 1b
- **ViewEngine** (NEW: unified `Composite + Leaf`) - Phase 1b
- **FactoryEngine** (`universal-factory.ts` → `factory-engine.ts`) - Phase 1a ✅
- **MaiaScriptEngine** (`evaluator.ts` - conceptual name)

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
  ├── src/
  │   ├── evaluator.ts
  │   ├── helpers.ts
  │   ├── validator.ts
  │   ├── types.ts
  │   ├── index.ts
  │   └── modules/ (Phase 4+)
  │       ├── types.ts
  │       ├── registry.ts
  │       ├── builtin.module.ts
  │       ├── dragdrop.module.ts
  │       └── security.module.ts
  └── README.md
```

### Import Changes

**OLD:**
```typescript
import { safeEvaluate, isDSLExpression } from '../dsl'
import type { DSLExpression } from '../dsl/types'
```

**NEW:**
```typescript
import { safeEvaluate, isMaiaScriptExpression } from '@maia/script'
import type { MaiaScriptExpression } from '@maia/script'
```

### Composite vs Leaf

**Both render multiple HTML elements** (via `elements[]`)  
**Only distinction:** Has ViewNode children vs no ViewNode children (structural)

---

## Phase 1a: Extract MaiaScript + Rename FactoryEngine

**Files to Create:**
- `libs/maia-script/package.json`
- `libs/maia-script/tsconfig.json`
- `libs/maia-script/README.md`

**Files to Move:**
- All 5 files from `services/me/src/lib/compositor/dsl/` → `libs/maia-script/src/`

**Files to Rename:**
- `services/me/src/lib/factories/runtime/universal-factory.ts` → `factory-engine.ts`

**Files to Update:**
- All imports from `dsl` → `@maia/script`
- All imports from `universal-factory` → `factory-engine`
- `factory-engine.ts` itself (update internal MaiaScript imports)
- `services/me/package.json` (add `@maia/script: workspace:*`)
- All factory wrapper files (`.factory.ts` files importing from universal-factory)
- All vibe creation files importing factory functions

**Files to Delete:**
- `services/me/src/lib/compositor/dsl/` (folder)

**Test:** All vibes work with new import paths, all factories still create components correctly

---

## Phase 1b: ViewEngine + ActorEngine

**Files to Create:**
- `services/me/src/lib/compositor/view/ViewEngine.svelte`

**Files to Rename:**
- `ActorRenderer.svelte` → `ActorEngine.svelte`

**Files to Delete:**
- `ActorRendererRecursive.svelte`
- `Composite.svelte` (after stable)
- `Leaf.svelte` (after stable)

**Files to Update:**
- All `ActorRenderer`/`ActorRendererRecursive` imports → `ActorEngine`
- `ActorEngine.svelte` (use ViewEngine, self-recursion)

**Test:** All 3 vibes work (todos list/timeline/kanban, humans, vibes)

---

## Phase 2: Binding Resolver Module

**Files to Create:**
- `services/me/src/lib/compositor/view/binding-resolver.ts`

**Files to Update:**
- `ViewEngine.svelte` (use binding-resolver)

**Test:** All bindings work (value, text, class, visible, disabled)

---

## Phase 3: Event Handler Module

**Files to Create:**
- `services/me/src/lib/compositor/view/event-handler.ts`

**Files to Update:**
- `ViewEngine.svelte` (use event-handler)

**Test:** All events work (click, input, submit, drag, drop, blur)

---

## Phase 4: Module Registry Infrastructure

**Files to Create:**
- `libs/maia-script/src/modules/types.ts`
- `libs/maia-script/src/modules/registry.ts`
- `libs/maia-script/src/modules/index.ts`

**Files to Update:**
- `libs/maia-script/src/index.ts` (export modules)

**Test:** Infrastructure works (no behavior change)

---

## Phase 5: Builtin Module

**Files to Create:**
- `libs/maia-script/src/modules/builtin.module.ts`

**Files to Update:**
- `libs/maia-script/src/evaluator.ts` (use registry)
- `services/me/src/routes/+layout.svelte` (import builtin module)

**Test:** All MaiaScript operations work via registry

---

## Phase 6: Drag-Drop Module

**Files to Create:**
- `libs/maia-script/src/modules/dragdrop.module.ts`
- `libs/maia-script/src/modules/dragdrop.rules.json`

**Files to Update:**
- `ViewEngine.svelte` (capability support)
- `kanban.factory.json` (optional: add capabilities)
- `+layout.svelte` (import dragdrop module)

**Test:** Kanban drag-drop works via modules

---

## Phase 7: Security Module

**Files to Create:**
- `libs/maia-script/src/modules/security.module.ts`
- `libs/maia-script/src/modules/security.rules.json`

**Files to Update:**
- `ViewEngine.svelte` (security validation)
- `whitelist.ts` (deprecate with notes)
- `+layout.svelte` (import security module)

**Test:** Security validation blocks invalid inputs

---

## 📦 File Changes Summary

### Create: 17 files
- 3 MaiaScript lib setup (Phase 1a)
- 1 ViewEngine (Phase 1b)
- 1 Binding resolver (Phase 2)
- 1 Event handler (Phase 3)
- 3 Module registry (Phase 4)
- 1 Builtin module (Phase 5)
- 2 Drag-drop module (Phase 6)
- 2 Security module (Phase 7)
- 3 READMEs/configs

### Move: 5 files
- All DSL files → MaiaScript lib (Phase 1a)

### Rename: 2 files
- `universal-factory.ts` → `factory-engine.ts` (Phase 1a)
- `ActorRenderer.svelte` → `ActorEngine.svelte` (Phase 1b)

### Update: 12+ files
- Phase 1a: All files importing from `dsl`
- Phase 1b: All files using ActorRenderer
- Phase 2-7: ViewEngine, +layout.svelte, evaluator.ts, etc.

### Delete: 5 files
- `dsl/` folder (Phase 1a)
- `ActorRendererRecursive.svelte` (Phase 1b)
- `Composite.svelte` (after Phase 1b stable)
- `Leaf.svelte` (after Phase 1b stable)
- `whitelist.ts` (after Phase 7 stable)

---

## ✅ Testing Strategy

**After Each Phase:**
- [ ] Todos vibe: List, timeline, kanban all work
- [ ] Humans vibe: List view works
- [ ] Vibes vibe: Grid view works
- [ ] All interactions work (add, edit, delete, drag-drop)
- [ ] No console errors
- [ ] No linter errors
- [ ] No TypeScript errors

---

## 🚀 Execution Order

1. **Phase 1a** - Extract MaiaScript (foundation)
2. **Phase 1b** - ViewEngine + ActorEngine (rendering unification)
3. **Phase 2** - Binding resolver (modularize bindings)
4. **Phase 3** - Event handler (modularize events)
5. **Phase 4** - Module registry (infrastructure)
6. **Phase 5** - Builtin module (migrate operations)
7. **Phase 6** - Drag-drop module (capabilities)
8. **Phase 7** - Security module (validation)

**Each phase is independently testable!**

---

## 📝 Migration Notes

- ✅ Clean slate (no backward compatibility)
- ✅ DB reset OK
- ✅ 100% migration (no deprecation except whitelist.ts)
- ✅ MaiaScript reusable across all services
- ✅ All 3 vibes tested every phase

---

## 🔮 Future Tasks (Not in Plan)

1. Factory conditionals (`$factoryIf`/`$factorySwitch` → `$if`/`$switch`)
2. Actor type system (ContainerActor/LeafActor)


---

**Status:** ✅ Ready for Execution  
**Next Step:** Execute Phase 1a (Extract MaiaScript)  
**Reference:** See full detailed plan for complete implementation details
