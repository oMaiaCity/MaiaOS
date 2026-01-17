# @MaiaOS/docs

**Single source of truth** for all MaiaOS documentation.

## Structure

```
maia-docs/
├── getting-started/    # Onboarding, concepts, architecture
├── creators/           # Creator-focused docs (Vibes, Actors, etc.)
├── developers/         # Developer-focused docs (DSL, Schemas, APIs)
├── architecture/       # Deep technical architecture docs
├── concept/            # Core concepts and terminology
└── agents/             # Auto-generated LLM-optimized docs
    ├── LLM_Creators.md
    └── LLM_Developers.md
```

## Scripts

### Generate LLM Docs

```bash
# From workspace root
bun run docs:generate

# Watch mode (auto-regenerate on changes)
bun run docs:watch
```

### From this package

```bash
# One-time generation
bun run generate

# Watch mode
bun run generate:watch
```

## Auto-Generation

LLM documentation is automatically generated from source docs:

- **LLM_Creators.md**: `getting-started/` + `creators/`
- **LLM_Developers.md**: `getting-started/` + `developers/`

These files are optimized for LLM context windows and updated automatically.

## Versioning

This package shares the monorepo version (`0.1.23`) and is automatically synced during releases.
