# MaiaOS Creator Documentation

Creator-facing documentation for building with MaiaOS.

## Architecture Principles

### Separation of Concerns (Nue.js-Style)

MaiaOS enforces **strict separation of concerns**—each layer has one job. No mixing.

| Layer | Has Conditional Logic? | Responsibility |
|-------|------------------------|----------------|
| **Views** | **No** — Zero logic, zero conditionals | Pure declarative structure. References context, sends events. |
| **Context** | **No** — Pure data storage | Single source of truth. All UI state, all data. Persisted to CoValues. |
| **Process handlers** | **Yes** | All logic, computation, conditionals. Updates context via `ctx`. |
| **CSS** | **Yes** (styling only) | Conditional styling via data-attributes. Matches context-derived values. |

**Views are "dumb" templates**—like Nue.js, they contain zero conditional logic. Process handlers think. Context stores. Views render. CSS styles.

### UI State: Single Source of Truth in Context

**All UI state lives in context.** No in-memory hacks, no ephemeral state, no `useState`-style local variables.

- ✅ **Context = CoValue** — Persisted, syncable, offline-first
- ✅ **Single source of truth** — One place for `viewMode`, `newTodoText`, `selectedItems`, etc.
- ✅ **No shortcuts** — Every update goes through `ctx` → CoValue → ReactiveStore → View

### Local-First, CoValue-Native Roundtrip

**All data flows through CoValues.** No optimizing updates, no in-memory caches that bypass persistence.

- ✅ **Data roundtrip** — Create/update/delete → CoValue (CRDT) → ReactiveStore → View
- ✅ **Query objects** — Declared in context, resolved via `read()` → ReactiveStore (CoValue-backed)
- ✅ **Offline-first** — CoValues sync when connected; local-first when not
- ✅ **Full architecture** — Leverage CoJSON end-to-end. No shortcuts.

---

## Documentation Order

Read the documentation in the following order for a complete understanding:

### 1. [Vibes](./01-vibes/)
**Understanding the Vibe System**
- What are Vibes?
- **Vibe-first development pattern** (ALWAYS create vibe root service actor first!)
- Vibe composition and structure
- Vibe ecosystem

### 2. [Loader](./02-loader.md)
**MaiaOS Loader**
- Boot process and modules
- Boot process
- Module loading

### 3. [Actors](./03-actors/)
**Actor-Based Component System**
- What are Actors?
- **Architectural roles:** Process handlers define behavior, context contains data, view renders from context
- **Single source of truth:** Everything persisted to CoValues, accessed via ReactiveStore
- **Vibe-first development** (create vibe root service actor first!)
- Actor lifecycle
- Actor composition
- Co-id references and seeding transformation
- Brand/style separation (`brand` required, `style` optional)

### 4. [Context](./04-context/)
**Context Management**
- Context system (ReactiveStore pattern)
- Universal `read()` API - Every CoValue accessible as ReactiveStore
- Context passing
- Context composition
- Data flow

### 5. [Process Handlers](./05-state/)
**Process Handlers**
- Event handlers (op, ctx, tell)
- Event flow
- Error handling
- Reactive updates

### 6. [Tools & Messaging](./06-tools/)
**Tools and Messaging**
- op action (data operations)
- tell action (inter-actor messaging)
- ctx action (context updates)

### 7. [Operations](./07-operations/)
**Database Operations API**
- Universal `read()` API - Every CoValue accessible as ReactiveStore
- Unified data operations (`maia.do()`)
- Query, create, update, delete, toggle operations
- Reactive subscriptions via ReactiveStore pattern
- Co-id usage and schema transformation

### 8. [Views](./08-views/)
**View System**
- View structure
- View composition
- View-to-DOM rendering
- Reactive updates

### 9. [Brand](./09-brand/)
**Brand System (Shared Design System)**
- Brand definitions (`brand.style.maia`)
- Brand tokens (colors, spacing, typography)
- Brand components (shared UI patterns)
- **Required** - All actors reference brand via `brand` property

### 10. [Style](./10-style/)
**Style System (Actor-Specific Overrides)**
- Local style definitions (`{name}.style.maia`)
- Actor-specific customization
- **Optional** - Actors can override brand via `style` property
- StyleEngine merges brand + style (brand first, style overrides)

### 11. [Factories](./11-factories/)
**Factory definitions and validation**

### 12. [Best Practices](./12-best-practices/)
**Best Practices and Patterns**
- Recommended patterns
- Common pitfalls
- Performance tips
- Maintainability

---

## Who This Is For

This documentation is for **creators** who want to:
- Build applications with MaiaOS
- Create vibes (component definitions)
- Compose features using the declarative DSL
- Integrate AI agents into applications
- Design and style user interfaces

## What You'll Learn

- How to use MaiaScript (`.maia` files)
- How to compose actors, process handlers, views, and styles
- How to create AI-powered features with skills
- How to manage state and context
- How to build reactive, collaborative applications
- **Architectural roles:** Process handlers define behavior, context contains data, view renders from context
- **Single source of truth:** Everything is persisted to CoValues, accessed reactively via universal `read()` API

---

## Related Documentation

- [Developer Documentation](../03_developers/) - Technical implementation details
- [Getting Started](../01_getting-started/) - Concepts, architecture, installation
- [Agent Documentation](../04_agents/) - Auto-generated LLM agent docs

---

## Contributing

When updating these docs:
- ✅ Keep content user-friendly and example-driven
- ✅ Focus on "how to use" rather than "how it works"
- ✅ Include practical examples
- ❌ **DO NOT** update `docs/agents/LLM_*.md` files (auto-generated)

To regenerate agent docs after updating:
```bash
bun run generate:llm-docs
```
