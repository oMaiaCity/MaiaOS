# LLM Agent Documentation

This directory contains **auto-generated** documentation optimized for LLM agents (AI assistants, code generation tools, etc.).

## Files

### `LLM_Vibecreator.md` (90KB)
Complete context for LLM agents helping **vibecreators** (app builders) build MaiaOS applications.

**Contents:**
1. ARCHITECTURE.md (system overview)
2. All vibecreators/ docs (01-kernel through 09-style)

**Use when:**
- Building MaiaOS applications
- Creating actors, views, state machines
- Working with the MaiaScript DSL
- Styling and branding applications

### `LLM_Developers.md` (63KB)
Complete context for LLM agents helping **developers** extend MaiaOS itself.

**Contents:**
1. ARCHITECTURE.md (system overview)
2. All developers/ docs (maiaos, engines, tools, dsl)

**Use when:**
- Creating custom engines
- Building tool modules
- Extending the MaiaScript DSL
- Contributing to MaiaOS core

## Generation

These files are **auto-generated** from source documentation:

```bash
# Generate once
bun run build:docs

# Watch mode (auto-regenerates on changes)
bun run dev:docs

# Or run alongside dev server
bun run dev  # Runs both browser-sync + doc generation
```

**Source files:**
- `docs/ARCHITECTURE.md` (prefixed to both)
- `docs/vibecreators/*.md` → `LLM_Vibecreator.md`
- `docs/developers/*.md` → `LLM_Developers.md`

## Why Auto-Generate?

1. **Single Source of Truth** - Edit source docs, LLM docs update automatically
2. **Optimal Context** - ARCHITECTURE.md prefixed for complete system understanding
3. **Role-Specific** - Separate contexts for app builders vs. core developers
4. **Always Up-to-Date** - Watch mode keeps LLM docs in sync during development

## Usage in LLM Tools

### Cursor / GitHub Copilot
Add to `.cursorrules` or workspace context:
```
@docs/agents/LLM_Vibecreator.md  # For app development
@docs/agents/LLM_Developers.md   # For core development
```

### ChatGPT / Claude
Upload the appropriate file as context when starting a session.

### Custom AI Tools
Load the file as system context or RAG knowledge base.

## File Size

- **LLM_Vibecreator.md**: ~90KB (fits in most LLM context windows)
- **LLM_Developers.md**: ~63KB (fits in most LLM context windows)

Both files are optimized for token efficiency while maintaining complete context.
