# MaiaOS Developer Documentation

Developer-facing documentation for understanding and extending MaiaOS.

## Documentation Order

Read the documentation in the following order for a complete understanding:

### 1. [MaiaOS Architecture](./01_maiaos.md)
**Overview of the entire system**
- Three-layer architecture (Definition, Execution, Intelligence)
- Core concepts and design philosophy
- How the layers interact

### 2. [DSL Fundamentals](./02_dsl.md)
**MaiaScript Domain-Specific Language**
- `.maia` file structure and syntax
- Declarative composition patterns
- File naming conventions
- Reference resolution

### 3. [Schemas](./03_schemas.md)
**Schema definitions and validation**
- Schema structure (actors, state machines, views, styles, skills)
- Schema validation and type safety
- Schema composition and inheritance
- Best practices

### 4. [Engines](./04_engines.md)
**Execution engines that interpret definitions**
- ActorEngine - Actor lifecycle management
- StateEngine - State machine interpreter
- ViewEngine - View-to-DOM renderer
- ToolEngine - Tool executor
- StyleEngine - Style compiler
- ModuleRegistry - Dynamic module loader

### 5. [Composition](./05_composition.md)
**How to compose components and build features**
- Actor composition patterns
- State machine composition
- View composition
- Style composition
- Modular architecture

### 6. [Reactive Queries](./06_reactive-queries.md)
**Reactive data system**
- Query syntax and patterns
- Reactive updates and subscriptions
- Data flow and state management
- Performance optimization

### 7. [CoJSON Integration](./07_cojson.md)
**CRDT-based collaborative data layer**
- MaiaCojson architecture
- JSON Schema wrappers for CRDTs
- CRUD API (`o.create`, `o.read`, `o.update`, `o.delete`)
- Real-time collaboration and sync
- Zero Mocks Policy for testing

### 8. [Tools](./08_tools.md)
**Development tools and utilities**
- CLI tools
- Build system
- Testing framework
- Debugging tools
- Code generation

---

## Contributing

When updating these docs:
- ✅ Keep documentation current with code changes
- ✅ Include code examples
- ✅ Update cross-references if doc structure changes
- ❌ **DO NOT** update `docs/agents/LLM_*.md` files (auto-generated)

## Auto-Generated Documentation

**Agent-facing documentation** is auto-generated from these developer docs:
- `docs/agents/LLM_Developers.md` - Auto-generated, DO NOT edit manually
- Run `bun run generate:llm-docs` to regenerate agent docs

---

## Quick Links

- [Creator Documentation](../creators/) - For creators (user-facing)
- [Agent Documentation](../agents/) - For LLM agents (auto-generated)
- [Getting Started](../getting-started/) - Quick start guides
