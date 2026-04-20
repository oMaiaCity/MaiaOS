---
title: MaiaOS — central planning board
type: kanban-hub
---

# Central planning board

Single place to **track epics and todos** across MaiaOS. This file stays **high level**. When work is ready to be scoped, move the card to **1 — Plan** and **add a link** to a dedicated plan file under `.cursor/plans/` (one file per epic or feature). Detailed PRDs, spikes, and checklists live in those linked plans—not here.

**Workflow**

1. Capture ideas in **0 — Backlog** (one line per card; optional short id).
2. When you start scoping: move to **1 — Plan** and create `.cursor/plans/<slug>.plan.md` (or `.md`), then paste the **relative path** on the card.
3. **2 — Doing** → **3 — Review** → **4 — Done** as usual; update links if the plan file is renamed.

**Card format (suggested)**

```text
- [ ] **ID-001** Short title — one-line context. Plan: (add when in Plan) [.cursor/plans/foo.plan.md](foo.plan.md)
```

---

## 0 — Backlog

- [ ] **CSP-001** Remove `unsafe-eval` from app CSP — AJV / JSON Schema refactor; interim fix is in production. Optional detail doc (create or link when moving to Plan): [csp-remove-unsafe-eval.plan.md](csp-remove-unsafe-eval.plan.md)
- [ ] **PLN-000** _(template)_ Add the next epic here; add a linked plan file when the card moves to **1 — Plan**.

---

## 1 — Plan

_(Items being scoped: each line must include a link to its plan file under `.cursor/plans/`.)_

_(Empty — move **CSP-001** here when scheduling that work; keep [csp-remove-unsafe-eval.plan.md](csp-remove-unsafe-eval.plan.md) as the living doc.)_

---

## 2 — Doing

_(Empty.)_

---

## 3 — Review

_(Empty.)_

---

## 4 — Done

- [x] **BRD-001** Central planning hub + CSP detail plan split (this doc structure, 2026-04).

---

## Archive / pointers

- Older Cursor plan exports may live beside this file with names like `*_*.plan.md`; prefer linking them from a Backlog card before editing heavily.
