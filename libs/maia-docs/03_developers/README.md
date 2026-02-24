# MaiaOS Developer Documentation

Developer-facing documentation for understanding and extending MaiaOS.

## Documentation Order

Read the documentation in the following order for a complete understanding:

### 1. [maia-self Package](./01_maia-self/README.md)
**Self-Sovereign Identity and Authentication**
- Hardware-backed authentication (WebAuthn PRF)
- Zero-storage architecture (no secrets in browser)
- Deterministic account derivation
- Registration and login flows
- Bottom-up cryptography concepts
- Security analysis and threat model

**Sub-topics:**
- [Security Analysis](./01_maia-self/security-analysis.md) - Threat model and attack vectors
- [Auth Flows](./01_maia-self/auth-flows.md) - Registration and login flows
- [Cryptography](./01_maia-self/cryptography.md) - Bottom-up crypto concepts
- [API Reference](./01_maia-self/api-reference.md) - Complete API reference

### 2. [maia-loader Package](./02_maia-loader/README.md)
**Core system services and boot process**
- Identity & authentication layer (`createMaiaOS`)
- Actor & DSL execution layer (`MaiaOS.boot()`)
- Boot process and engine initialization
- Module loading and database seeding
- Public API reference

**Sub-topics:**
- [Auth Layer](./02_maia-loader/auth-layer.md) - Identity & Authentication layer
- [Boot Process](./02_maia-loader/boot-process.md) - Boot process and execution layer
- [API Reference](./02_maia-loader/api-reference.md) - Complete API reference
- [Patterns](./02_maia-loader/patterns.md) - Common patterns and troubleshooting

### 3. [maia-schemata Package](./03_maia-schemata/README.md)
**Schema validation and transformation system**
- ValidationEngine implementation details
- Schema transformation for seeding
- CoJSON types integration
- Co-ID generation and registry

**Sub-topics:**
- [Validation](./03_maia-schemata/validation/) - Schema validation system
- [Transformation](./03_maia-schemata/transformation.md) - Schema transformation for seeding
- [CoJSON Integration](./03_maia-schemata/cojson-integration.md) - CoJSON types integration
- [Co-ID Generation](./03_maia-schemata/co-id-generation.md) - Co-ID generation and registry

### 4. [maia-engines Package](./04_maia-engines/README.md)
**Execution engines and modules** (merged from maia-script + maia-operations)
- DataEngine – **maia.do({ op, schema, key, filter, ... })** (public data API)
- Engine architecture (ActorEngine, ViewEngine, StateEngine, etc.)
- Module system and custom module creation
- MaiaScript expression language reference
- Complete API reference

**Sub-topics:**
- [Engines](./04_maia-engines/engines/) - Detailed engine descriptions
- [Modules](./04_maia-engines/modules.md) - Module system and custom modules
- [Expressions](./04_maia-engines/expressions.md) - MaiaScript expression language
- [API Reference](./04_maia-engines/api-reference.md) - Complete API reference
- [Patterns](./04_maia-engines/patterns.md) - Common patterns and troubleshooting

### 5. [maia-db Package](./05_maia-db/README.md)
**CRDT-based collaborative data layer**
- Complete cojson architecture hierarchy
- Cryptographic primitives to high-level CoValues
- CRDT operations and conflict resolution
- Storage and sync mechanisms

**Sub-topics:**
- [CoJSON Architecture](./05_maia-db/cojson.md) - Complete layer hierarchy from primitives to CoValues

### 6. [maia-operations (merged)](./06_maia-operations/README.md)
**Operations are now part of maia-engines**
- DataEngine (data.engine.js) executes **maia.do({ op, schema, key, ... })**
- Operations live in `libs/maia-engines/src/engines/data.engine.js`
- MaiaDB (maia-db) is the storage layer; no DBAdapter interface

### 7. [State and Persistence](./state-and-persistence.md)
**Ephemeral vs persistable state and storage configuration**
- What stays in memory by design
- What could be persisted (machine state, history)
- maia-sync `inMemory` vs `dbPath` for production

### 8. [Deployment](./09_deployment/README.md)
**Production deployment and DNS setup**
- Fly.io deployment (maia + moai services)
- Custom domain and DNS configuration (Hetzner)
- Troubleshooting sync, WebSocket, and TLS

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

- [Creator Documentation](../02_creators/) - For creators (user-facing)
- [Agent Documentation](../04_agents/) - For LLM agents (auto-generated)
- [Getting Started](../01_getting-started/) - Quick start guides
