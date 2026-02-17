# @MaiaOS/docs

**Single source of truth** for all MaiaOS documentation.

## Structure

```
maia-docs/
├── 01_getting-started/   # Start here: concepts → architecture → install
├── 02_creators/          # Vibes, Loader, Actors, Operations, Views, Style
├── 03_developers/        # maia-self, maia-loader, maia-engines, maia-db
└── 04_agents/            # Auto-generated LLM docs (do not edit)
```

**Reading path:** [01_getting-started/00-overview.md](./01_getting-started/00-overview.md)

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

- **LLM_Creators.md**: `01_getting-started/` + `02_creators/`
- **LLM_Developers.md**: `01_getting-started/` + `03_developers/`

These files are optimized for LLM context windows and updated automatically.

## Versioning

This package shares the monorepo version and is automatically synced during releases.
