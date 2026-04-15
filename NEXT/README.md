# Maiacity NEXT

Standalone workspace under `NEXT/`: its own `package.json` workspaces and `bun.lock`. **Run `bun install` from `NEXT/`** — not from the repo root (root workspaces do not include `NEXT/`).

**Bundling:** `@MaiaOS/app`, `@MaiaOS/self`, `@MaiaOS/schemata`, and `@MaiaOS/db` use **relative imports** between NEXT packages so `bun build` never resolves the parent repo’s same-scoped `@MaiaOS/*` packages.

## Packages

| Package | Role |
|--------|------|
| `@MaiaOS/schemata` | JSON Schema (`account`, `profile`, `metaschema`, co-type `$defs`) |
| `@MaiaOS/storage` | Browser OPFS / IndexedDB cojson persistence |
| `@MaiaOS/db` | `createAccountWithSecret`, `loadAccount`, `ensureAccountScaffold` |
| `@MaiaOS/self` | PRF passkey + cojson account |
| `@MaiaOS/app` | Static app + dev server |

## Commands

```bash
cd NEXT && bun install && bun run dev
```
