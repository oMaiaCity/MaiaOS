# Documentation Update Plan
**Complete Architecture & Terminology Alignment**

---

## 📊 Current State Analysis

### ✅ Implemented Engines (JSON → Engine → Output Pattern)

| Engine | Input | Output | Status |
|--------|-------|--------|--------|
| `ActorEngine.svelte` | Actor ID (Jazz CoValue) | Rendered DOM + Reactive State | ✅ Implemented |
| `ToolEngine.ts` | Tool ID + Payload (with MaiaScript) | Executed business logic | ✅ Implemented |
| `ViewEngine.svelte` | ViewNode JSON (Composite/Leaf) | Rendered HTML elements | ✅ Implemented |
| `factoryEngine.ts` | Factory JSON + Parameters | Resolved ViewNode | ✅ Implemented |
| `queryEngine.svelte.ts` | Schema name + Options | Reactive entity list | ✅ Implemented |
| `seedingEngine.ts` | Vibe name | Actor tree (seeded) | ✅ Implemented |

### 📚 Documentation Files Status

| File | Current State | Needs Update |
|------|---------------|--------------|
| `ARCHITECTURE_SUMMARY.md` | References "skills", "ActorRenderer" | ✅ YES - Skills → Tools, ActorRenderer → ActorEngine |
| `TERMINOLOGY.md` | Partially updated, missing tool modules | ✅ YES - Add ToolEngine, module system, update examples |
| `README.md` | References old skills system | ✅ YES - Update to tools, engines, modern flow |
| `CONTEXT_ARCHITECTURE.md` | Context patterns (mostly OK) | ⚠️ MINOR - Update skill references to tools |
| `skills/README.md` | Recently updated to "tools" | ✅ YES - Add engine integration section |
| `view/README.md` | View architecture explanation | ⚠️ MINOR - Clarify ViewEngine.svelte replaces separate Composite/Leaf |
| `actors/README.md` | Actor architecture | ✅ YES - Update ActorRenderer → ActorEngine |
| `jazz/README.md` | Jazz integration | ⚠️ CHECK - May need queryEngine mention |
| `schemata/README.md` | Schema system | ⚠️ CHECK - Verify factory references |
| `vibes/README.md` | Vibes overview | ✅ YES - Update to tools terminology |

### 📝 New Documentation Needed

1. **`ENGINE_ARCHITECTURE.md`** ⭐ NEW
   - Document JSON → Engine → Output pattern
   - Explain each engine's role and interface
   - Show data flow through engine pipeline
   - MaiaScript DSL integration across engines

2. **`FACTORY_SYSTEM.md`** ⭐ NEW
   - Factory template system
   - Parameter substitution
   - Conditional factories ($if, $switch)
   - createComposite/createLeaf helpers

3. **`MAIASCRIPT_DSL.md`** ⭐ NEW
   - MaiaScript expression language
   - Security model (whitelist-based)
   - Operations and modules
   - Integration with ToolEngine

---

## 🎯 Update Strategy

### Phase 1: Create New Core Documentation (Priority: HIGH)

#### 1.1 Create `ENGINE_ARCHITECTURE.md`
**Location**: `services/docs/vibes/ENGINE_ARCHITECTURE.md`

**Content**:
- Overview: JSON → Engine → Output pattern
- Engine catalog (6 engines)
- Data flow diagrams
- Engine interfaces
- MaiaScript integration
- Examples for each engine

**Dependencies**: None (foundational doc)

#### 1.2 Create `MAIASCRIPT_DSL.md`
**Location**: `services/docs/vibes/MAIASCRIPT_DSL.md`

**Content**:
- MaiaScript overview
- Expression syntax
- Security model
- Operations (builtin module)
- Module system
- ToolEngine integration
- Examples: string paths, conditionals, date operations

**Dependencies**: None (can reference ENGINE_ARCHITECTURE.md)

#### 1.3 Create `FACTORY_SYSTEM.md`
**Location**: `services/docs/vibes/FACTORY_SYSTEM.md`

**Content**:
- Factory template system
- Parameter definitions
- `{{placeholder}}` syntax
- Conditional factories ($if, $switch, $map)
- createComposite/createLeaf helpers
- Real examples from todos.ts

**Dependencies**: ENGINE_ARCHITECTURE.md, MAIASCRIPT_DSL.md

---

### Phase 2: Update Core Architecture Docs (Priority: HIGH)

#### 2.1 Update `TERMINOLOGY.md`
**Location**: `services/docs/vibes/TERMINOLOGY.md`

**Changes**:
- ✅ Skills → Tools (already done, verify completeness)
- ✅ ActorRenderer → ActorEngine (already done, verify)
- ❌ Add ToolEngine section (NEW)
- ❌ Add Tool Module system (NEW)
- ❌ Add ToolModuleRegistry (NEW)
- ❌ Update examples to use tools
- ❌ Add MaiaScript DSL section (expand existing)
- ❌ Document all 6 engines

**Section Updates**:
```markdown
## 6. Engine Layer (Execution)

### Engine Pattern
**Definition:** A component that takes JSON config and transforms it into running entities.

**Core Principle:** JSON → Engine → Output

**Examples:**
1. **ActorEngine** (Actor ID → Rendered DOM + State)
2. **ToolEngine** (Tool ID + Payload → Executed Logic)
3. **ViewEngine** (ViewNode JSON → HTML Elements)
4. **factoryEngine** (Factory JSON → ViewNode)
5. **queryEngine** (Schema Name → Reactive Entities)
6. **seedingEngine** (Vibe Name → Actor Tree)
```

#### 2.2 Update `ARCHITECTURE_SUMMARY.md`
**Location**: `services/docs/vibes/ARCHITECTURE_SUMMARY.md`

**Changes**:
- Line 61-88: "Direct Skill Execution" → "Direct Tool Execution"
- Line 196-206: Update skill references to tools
- Line 264-273: "Skills Registry" → "Tools Registry"
- Add Engine Architecture section
- Add queryEngine section
- Update data flow diagram with engines

**New Section** (after line 220):
```markdown
## 🔧 Engine Architecture

All system components follow the JSON → Engine → Output pattern:

1. **ActorEngine** - Orchestrates actor lifecycle, message processing, query resolution
2. **ToolEngine** - Executes tools with MaiaScript DSL payload evaluation
3. **ViewEngine** - Unified Composite + Leaf rendering
4. **factoryEngine** - Factory template expansion with conditionals
5. **queryEngine** - Jazz-native reactive entity queries
6. **seedingEngine** - Vibe seeding and actor tree creation

See [Engine Architecture](./ENGINE_ARCHITECTURE.md) for complete details.
```

#### 2.3 Update `README.md`
**Location**: `services/docs/vibes/README.md`

**Changes**:
- Line 17: "Skill-Based Logic" → "Tool-Based Logic"
- Line 43-48: Update Skills Layer to Tools Layer
- Line 76-137: Update section "Jazz-Native Architecture" examples
- Line 152-157: Update Skills references to Tools
- Line 245-264: Update skill signature and examples
- Add Engine Architecture section
- Update documentation links

**New Section** (after Architecture Layers):
```markdown
## ⭐ Engine Architecture

All components follow the JSON → Engine → Output pattern:

```
JSON Config → Engine → Running System
   ↓            ↓           ↓
Actor ID    ActorEngine   Rendered UI
Tool ID     ToolEngine    Executed Logic
ViewNode    ViewEngine    HTML Elements
Factory     factoryEngine Resolved ViewNode
Schema      queryEngine   Entity List
Vibe Name   seedingEngine Actor Tree
```

See **[Engine Architecture](./ENGINE_ARCHITECTURE.md)** for complete details.
```

---

### Phase 3: Update Supporting Documentation (Priority: MEDIUM)

#### 3.1 Update `skills/README.md` → Rename to `tools/README.md`?
**Location**: `services/docs/vibes/skills/README.md`

**Decision**: Keep as `skills/README.md` for backward compatibility, but add redirect note.

**Changes**:
- Add note at top: "⚠️ **Note**: 'Skills' are now called 'Tools' in the codebase. This document uses both terms interchangeably for backward compatibility."
- Add ToolEngine integration section
- Add link to ENGINE_ARCHITECTURE.md
- Add MaiaScript DSL payload evaluation section
- Update all examples to reflect module-based architecture

**New Section** (after "Using Tools"):
```markdown
## 🔧 ToolEngine Integration

Tools are executed through the **ToolEngine**, which provides:

- **MaiaScript DSL evaluation**: Payloads are evaluated through MaiaScript DSL
- **Security**: Whitelist-based property traversal
- **Module registry**: Tools organized into modules (core, context, ai, human)
- **Unified execution**: Single entry point for all tool calls

See [Engine Architecture](../ENGINE_ARCHITECTURE.md) and [MaiaScript DSL](../MAIASCRIPT_DSL.md).
```

#### 3.2 Update `CONTEXT_ARCHITECTURE.md`
**Location**: `services/docs/vibes/CONTEXT_ARCHITECTURE.md`

**Changes**:
- Line 72: "@input/updateContext and @todo/create actions" → "@context/update and @core/createEntity tools"
- Minor terminology updates (skill → tool)
- Otherwise mostly correct (context patterns are stable)

#### 3.3 Update `view/README.md`
**Location**: `services/docs/vibes/view/README.md`

**Changes**:
- Add note about ViewEngine.svelte
- Clarify that Composite.svelte and Leaf.svelte are replaced by unified ViewEngine.svelte
- Otherwise architecture is correct (ViewNode, Composite, Leaf concepts remain)

**New Section** (after Overview):
```markdown
## 🔧 Implementation: ViewEngine

The View Layer is implemented by **ViewEngine.svelte**, a unified component that:
- Detects node type (Composite or Leaf)
- Renders HTML elements
- Resolves data bindings via MaiaScript DSL
- Handles events
- Self-recursive (renders children)

**Historical Note**: Previously implemented as separate `Composite.svelte` and `Leaf.svelte` components. Now unified into `ViewEngine.svelte` for better maintainability.

See [Engine Architecture](../ENGINE_ARCHITECTURE.md#viewengine) for implementation details.
```

#### 3.4 Update `actors/README.md`
**Location**: `services/docs/vibes/actors/README.md`

**Changes**:
- Update all "ActorRenderer" references to "ActorEngine"
- Update skill references to tools
- Add link to ENGINE_ARCHITECTURE.md

#### 3.5 Check `jazz/README.md`
**Location**: `services/docs/vibes/jazz/README.md`

**Changes**:
- Add queryEngine (useQuery hook) section if missing
- Link to ENGINE_ARCHITECTURE.md

#### 3.6 Check `vibes/README.md`
**Location**: `services/docs/vibes/vibes/README.md`

**Changes**:
- Update skill references to tools
- Update example code

---

### Phase 4: Update Example Code in Docs (Priority: LOW)

Update all code examples across documentation to use:
- `ToolEngine.execute()` instead of `executeSkill()`
- `@core/*`, `@context/*` tool namespaces
- `ActorEngine.svelte` instead of `ActorRenderer.svelte`
- `registerAllTools()` instead of `registerAllSkills()`

---

## 📋 Implementation Checklist

### Phase 1: New Core Docs
- [ ] Create `ENGINE_ARCHITECTURE.md`
- [ ] Create `MAIASCRIPT_DSL.md`
- [ ] Create `FACTORY_SYSTEM.md`

### Phase 2: Core Architecture Updates
- [ ] Update `TERMINOLOGY.md` (ToolEngine, modules, all 6 engines)
- [ ] Update `ARCHITECTURE_SUMMARY.md` (skills → tools, engines section)
- [ ] Update `README.md` (engine architecture, tools, modern flow)

### Phase 3: Supporting Docs
- [ ] Update `skills/README.md` (add ToolEngine integration)
- [ ] Update `CONTEXT_ARCHITECTURE.md` (minor terminology)
- [ ] Update `view/README.md` (add ViewEngine note)
- [ ] Update `actors/README.md` (ActorRenderer → ActorEngine)
- [ ] Check `jazz/README.md` (add queryEngine if needed)
- [ ] Check `vibes/README.md` (tools terminology)

### Phase 4: Code Examples
- [ ] Update all code examples to use new APIs
- [ ] Verify all tool namespace references (@core/*, @context/*)
- [ ] Update all engine references

---

## 🎯 Key Terminology Changes

| Old | New | Status |
|-----|-----|--------|
| Skills | Tools | ✅ Partially updated |
| ActorRenderer | ActorEngine | ✅ Updated in code, needs docs |
| executeSkill | ToolEngine.execute | ✅ Updated in code, needs docs |
| skillRegistry | toolModuleRegistry | ✅ Updated in code, needs docs |
| registerAllSkills | registerAllTools | ✅ Updated in code, needs docs |
| @entity/* | @core/* | ✅ Updated everywhere |
| @ui/* | @context/* | ✅ Updated everywhere |
| @relation/* | @core/* | ✅ Updated everywhere |
| @database/* | @core/* | ✅ Updated everywhere |

---

## 📚 Documentation Structure (Proposed)

```
services/docs/vibes/
├── README.md                       # Main overview (✅ UPDATE)
├── ARCHITECTURE_SUMMARY.md         # Architecture summary (✅ UPDATE)
├── ENGINE_ARCHITECTURE.md          # ⭐ NEW - Engine pattern
├── TERMINOLOGY.md                  # Terminology reference (✅ UPDATE)
├── CONTEXT_ARCHITECTURE.md         # Context patterns (⚠️ MINOR)
├── MAIASCRIPT_DSL.md               # ⭐ NEW - MaiaScript DSL
├── FACTORY_SYSTEM.md               # ⭐ NEW - Factory templates
├── actors/
│   └── README.md                   # Actor architecture (✅ UPDATE)
├── tools/                          # Rename from skills?
│   └── README.md                   # Tools system (✅ UPDATE)
├── view/
│   └── README.md                   # View layer (⚠️ MINOR)
├── jazz/
│   └── README.md                   # Jazz integration (⚠️ CHECK)
├── schemata/
│   └── README.md                   # Schema system (⚠️ CHECK)
└── vibes/
    └── README.md                   # Vibes overview (✅ UPDATE)
```

---

## 🚀 Execution Order

1. **Create ENGINE_ARCHITECTURE.md** (foundational)
2. **Create MAIASCRIPT_DSL.md** (referenced by engines)
3. **Create FACTORY_SYSTEM.md** (specific engine deep-dive)
4. **Update TERMINOLOGY.md** (references new docs)
5. **Update ARCHITECTURE_SUMMARY.md** (high-level overview)
6. **Update README.md** (entry point)
7. **Update supporting docs** (actors, tools, view, etc.)
8. **Update code examples** (final polish)

---

## ✅ Success Criteria

- [ ] All "skill" references updated to "tool"
- [ ] All "ActorRenderer" references updated to "ActorEngine"
- [ ] Engine pattern documented comprehensively
- [ ] MaiaScript DSL fully documented
- [ ] Factory system fully documented
- [ ] All 6 engines have clear documentation
- [ ] Data flow diagrams updated
- [ ] Code examples use new APIs
- [ ] Cross-references between docs are correct
- [ ] No broken links

---

**Estimated Effort**: 3-4 hours for complete documentation update
**Priority**: HIGH - Architecture has changed significantly
**Impact**: HIGH - Affects all documentation consumers
