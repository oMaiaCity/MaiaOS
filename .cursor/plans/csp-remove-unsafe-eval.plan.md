---
title: CSP — remove unsafe-eval (AJV / JSON Schema)
parent: central-planning-board.md
status: backlog-ready
---

# CSP hardening — remove `unsafe-eval`

Linked from [.cursor/plans/central-planning-board.md](central-planning-board.md) (**CSP-001**). Move that card to **1 — Plan** when this file is actively being executed.

## Context

**Why it exists today:** `services/app/server.js` sets `script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'` so AJV can compile validators when opening vibes. Interim fix; production should return to stricter `script-src` after validation is precompiled or moved off `eval`.

**Related files:** `services/app/server.js` (web CSP), `services/app/src-tauri/tauri.conf.json` (desktop — align when tightening).

---

## PRD (lightweight)

### Problem

Strict CSP blocks vibe/schema flows that use runtime code generation (AJV compile). Relaxed CSP widens XSS blast radius.

### Goal

Restore **strict `script-src`** (no `'unsafe-eval'`) without breaking vibes, sign-in, or schema validation.

### Success criteria

- [ ] `script-src` does **not** include `'unsafe-eval'` in production app server CSP.
- [ ] Opening vibes and schema-heavy paths works in production (smoke).
- [ ] Document chosen approach (precompile, alternate validator, worker isolation, etc.).

### Non-goals (first pass)

- Rewriting all JSON Schema usage across the monorepo in one PR (can phase).

### Candidate approaches

- AJV standalone / precompile validators at build time.
- Validator with no `eval` (bundle/parity tradeoffs).
- Compilation in a **locked-down worker** (evaluate worker CSP separately).

---

## Work checklist

### Backlog / research

- [ ] Spike: map `eval` / `new Function` / AJV compile paths in the browser bundle for “open vibe” and related flows.
- [ ] Choose primary strategy (precompile vs alternate lib vs worker).
- [ ] Align web server CSP and Tauri CSP after web fix where possible.
- [ ] Optional: CI grep that production CSP omits `unsafe-eval`.

### Implementation

- [ ] _(add after strategy choice)_

### Done

- [x] **Interim (2026-04):** `'unsafe-eval'` added to web `server.js`; `next-maia-city` deployed. Remove when this plan is complete.
