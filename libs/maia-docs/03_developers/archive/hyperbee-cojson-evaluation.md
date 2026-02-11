# Hyperbee as cojson Storage Backend: Deep Evaluation

**Last Updated**: 2026-02-03

*Archived evaluation document - reference for future backend architecture decisions.*

This document evaluates **Hyperbee** (the key-value database from the Pear ecosystem) as a storage backend for MaiaOS sync servers, comparing it to SQLite.

---

## TL;DR - The Verdict

**Hyperbee is actually a surprisingly good match for cojson's storage needs!**

- Key-value API maps cleanly to cojson's StorageAPI
- Batch operations support atomic transactions
- Sparse downloading = only download data you need
- P2P replication = distributed sync server mesh
- Built on mature Hypercore infrastructure

**However:** SQLite is simpler for single-server scenarios. Hyperbee shines for distributed/P2P sync architectures.

---

## Part 1: Understanding the Abstraction Layers

### Pear Ecosystem Stack

```
Application Layer
    ↓
Hyperdrive (File System)    Hyperbee (Database)    Autobase (Multi-writer)
    ↓                            ↓                        ↓
Corestore (Hypercore Factory) ←────────────────────────────
    ↓
Hypercore (Append-Only Log)
    ↓
Hyperswarm (P2P Discovery + Replication)
```

**Key Insight:** Raw Hypercore is too low-level (append-only log), but **Hyperbee** provides a key-value database abstraction - exactly what cojson needs!

### Hyperbee: Key-Value Database on Hypercore

**What is Hyperbee?**
- Append-only B-tree database built on Hypercore
- Provides key-value store API
- Supports sorted iteration, range queries
- **Sparse downloading** - only downloads blocks needed for queries
- Atomic batch operations

---

## Part 2: cojson Storage API Requirements

cojson's StorageAPI needs: load, store, loadKnownState, getKnownState, sync tracking, waitForSync, deletion, cleanup. SQLite schema uses coValues, sessions, transactions, signatures, syncState, deletedCoValues tables.

---

## Part 3: Mapping Hyperbee to cojson Storage

**Approach:** Flat key-value with composite keys. Key structure:
- `${coValueId}:header` → header
- `${coValueId}:session:${sessionId}` → session
- `${coValueId}:tx:${sessionId}:${idx}` → transaction
- `sync:${coValueId}:${peerId}` → sync state

**Pros:** Simple mapping, atomic batches, range queries, sparse downloading, P2P replication.

**Cons:** No joins, no foreign keys, no indexes, JSON encoding overhead.

---

## Part 4: SQLite vs Hyperbee Comparison

| Aspect | SQLite | Hyperbee |
|--------|--------|----------|
| Data Model | Relational | Key-value |
| Transactions | Full ACID | Atomic batches |
| Replication | Manual | Built-in P2P |
| Sparse Loading | No | Yes |
| Use Case | Single server | Distributed |

---

## Part 5: Use Cases

**SQLite:** Single sync server, simplicity, SQL expertise, no distribution needed.

**Hyperbee:** Distributed sync, sparse storage, P2P mesh, selective replication.

---

## Part 6: Sparse Downloading (Killer Feature)

Hyperbee only downloads B-tree blocks needed for queries. Enables multi-region sync where servers store partial data.

---

## Part 7: Hybrid Approach

SQLite for local storage + Hyperbee for P2P sync layer. Best of both: simple local, distributed replication.

---

## Part 8: Recommended Approach

**Phase 1:** SQLite (simplest, single server, MVP).

**Phase 2:** Add Hyperbee if distribution needed.

**Phase 3:** Pure Hyperbee for truly decentralized MaiaOS.

---

## Summary

**Can Hyperbee work?** Yes - great fit. **Use now?** Start with SQLite. **Explore later?** Yes - enables distributed architectures SQLite can't match.
