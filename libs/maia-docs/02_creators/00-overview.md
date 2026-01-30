# MaiaOS Creator Documentation

Creator-facing documentation for building with MaiaOS.

## Documentation Order

Read the documentation in the following order for a complete understanding:

### 1. [Vibes](./01-vibes.md)
**Understanding the Vibe System**
- What are Vibes?
- **Agent-first development pattern** (ALWAYS create agent service actor first!)
- Vibe composition and structure
- Vibe ecosystem

### 2. [Kernel](./02-kernel.md)
**MaiaOS Kernel Fundamentals**
- Kernel architecture
- Core concepts
- System initialization

### 3. [Actors](./03-actors.md)
**Actor-Based Component System**
- What are Actors?
- **Architectural roles:** State machine defines transitions, context contains data, view renders from context
- **Single source of truth:** Everything persisted to CoValues, accessed via ReactiveStore
- **Agent-first development** (create agent service actor first!)
- Actor lifecycle
- Actor composition
- Co-id references and seeding transformation
- Brand/style separation (`brand` required, `style` optional)

### 4. [Context](./04-context.md)
**Context Management**
- Context system (ReactiveStore pattern)
- Universal `read()` API - Every CoValue accessible as ReactiveStore
- Context passing
- Context composition
- Data flow

### 5. [State](./05-state.md)
**State Management**
- State machines
- State transitions
- Event handling
- Reactive state

### 6. [Tools](./06-tools.md)
**Tool System**
- Tool definitions
- Tool execution
- Tool composition
- Custom tools

### 7. [Operations](./07-operations.md)
**Database Operations API**
- Universal `read()` API - Every CoValue accessible as ReactiveStore
- Unified database operations (`maia.db()`)
- Query, create, update, delete, toggle operations
- Reactive subscriptions via ReactiveStore pattern
- Co-id usage and schema transformation

### 8. [Views](./08-views.md)
**View System**
- View structure
- View composition
- View-to-DOM rendering
- Reactive updates

### 9. [Brand](./09-brand.md)
**Brand System (Shared Design System)**
- Brand definitions (`brand.style.maia`)
- Brand tokens (colors, spacing, typography)
- Brand components (shared UI patterns)
- **Required** - All actors reference brand via `brand` property

### 10. [Style](./10-style.md)
**Style System (Actor-Specific Overrides)**
- Local style definitions (`{name}.style.maia`)
- Actor-specific customization
- **Optional** - Actors can override brand via `style` property
- StyleEngine merges brand + style (brand first, style overrides)

### 11. [Best Practices](./11-best-practices.md)
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
- How to compose actors, state machines, views, and styles
- How to create AI-powered features with skills
- How to manage state and context
- How to build reactive, collaborative applications
- **Architectural roles:** State machine defines transitions, context contains data, view renders from context
- **Single source of truth:** Everything is persisted to CoValues, accessed reactively via universal `read()` API

---

## Related Documentation

- [Developer Documentation](../developers/) - Technical implementation details
- [Getting Started](../getting-started/) - Quick start guides
- [Agent Documentation](../agents/) - Auto-generated LLM agent docs

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
