# MaiaOS Creator Documentation

Creator-facing documentation for building with MaiaOS.

## Documentation Order

Read the documentation in the following order for a complete understanding:

### 0. [Vibes](./00-vibes.md)
**Understanding the Vibe System**
- What are Vibes?
- Vibe composition and structure
- Vibe ecosystem

### 1. [Kernel](./01-kernel.md)
**MaiaOS Kernel Fundamentals**
- Kernel architecture
- Core concepts
- System initialization

### 2. [Actors](./02-actors.md)
**Actor-Based Component System**
- What are Actors?
- Actor lifecycle
- Actor composition
- Actor references and identity

### 3. [Skills](./03-skills.md)
**AI Agent Skills**
- Skill definitions
- How to create skills
- Skill composition
- LLM integration

### 4. [Context](./04-context.md)
**Context Management**
- Context system
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

### 7. [Views](./07-views.md)
**View System**
- View structure
- View composition
- View-to-DOM rendering
- Reactive updates

### 8. [Brand](./08-brand.md)
**Brand System**
- Brand definitions
- Brand tokens
- Brand composition
- Theme system

### 9. [Style](./09-style.md)
**Style System**
- Style definitions
- CSS generation
- Style composition
- Responsive design

### 10. [Best Practices](./10-best-practices.md)
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
