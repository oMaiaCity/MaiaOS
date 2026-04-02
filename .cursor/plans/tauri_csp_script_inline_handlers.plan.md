---
name: Tauri CSP — remove inline handlers
overview: Refactor services/app away from inline onclick and inline scripts so Tauri can use default script-src CSP hardening; then drop 'unsafe-inline', remove dangerousDisableAssetCspModification for script-src, and re-verify mic + login in the desktop bundle.
todos:
  - id: audit-inline
    content: Grep inventory of onclick= / inline handlers in services/app (signin, landing, dashboard, db-view, maia-ai-global); note dynamic innerHTML templates.
    status: pending
  - id: refactor-handlers
    content: Replace inline handlers with addEventListener (or delegated click on stable containers); expose only needed functions on window where routing requires it.
    status: pending
  - id: tighten-tauri-csp
    content: In tauri.conf.json remove 'unsafe-inline' from script-src, remove dangerousDisableAssetCspModification (or set false); keep connect-src + media headers as needed for STT.
    status: pending
  - id: verify-desktop-web
    content: Run web SPA + Tauri debug build; test sign-in, dashboard, DB view, Maia AI voice, passkeys.
    status: pending
isProject: false
---

# Plan: Tighten Tauri `script-src` (remove inline handlers)

## Goal

Restore **Tauri’s default script CSP behavior** (nonce/hash-based tightening for bundled assets) by eliminating reliance on:

- `**'unsafe-inline'`** in `script-src`
- `**dangerousDisableAssetCspModification: ["script-src"]`** in `services/app/src-tauri/tauri.conf.json`

After this work, the app should behave the same in **browser** and **Maia City.app**, with **stricter** CSP than the current compromise.

## Why (context)

- Inline `onclick="..."` and similar **inline event handlers** require CSP to allow `**'unsafe-inline'`** (or hashes per attribute), which conflicts with Tauri’s **asset CSP modification** for `script-src`.
- **Connect-src** for `tauri://localhost` / `https://tauri.localhost` is separate: keep whatever is needed for `fetch` to the app origin; **do not** conflate with “unsafe script” — the risky part is **inline script execution**.

## Current state (baseline)

- `**services/app/src-tauri/tauri.conf.json`**: custom `csp` string plus `dangerousDisableAssetCspModification: ["script-src"]` and `'unsafe-inline'` in `script-src` (introduced to unblock login + mic after adding stricter CSP).
- **Inline HTML handlers** (non-exhaustive; re-grep before starting):

  | File                             | Rough use                                      |
  | -------------------------------- | ---------------------------------------------- |
  | `services/app/signin.js`         | Test Aven / sign-in buttons                    |
  | `services/app/landing.js`        | Landing CTAs                                   |
  | `services/app/dashboard.js`      | Cards, mobile menu, account UI                 |
  | `services/app/db-view.js`        | CoValue navigation, metadata actions, sidebars |
  | `services/app/maia-ai-global.js` | Retry button in injected HTML                  |


## Recommended approach

1. **Inventory**
  Run a repo-wide search for `onclick=` (and any `onerror=` / `javascript:` in templates) under `services/app/`. Treat **template literals that set `innerHTML`** as part of the same problem.
2. **Refactor patterns** (pick per screen; prefer consistency within a file):
  - **Direct binding:** After `innerHTML` / DOM creation, `querySelector` / `querySelectorAll` and `addEventListener('click', ...)`.
  - **Delegation:** One listener on a stable parent (e.g. `#app-root`, `.dashboard-shell`) using `event.target.closest('[data-action]')` — good for long lists and repeated markup.
  - `**data-*` attributes:** Replace `onclick="window.foo()"` with `data-action="foo"` and a single handler.
3. **Global `window.*`:**
  Today some handlers call `window.navigateToScreen`, `window.handleSignOut`, etc. Prefer **module-local functions** + listeners; only attach to `window` if something outside the module must call it (keep the surface small).
4. **Tauri CSP rollback (after no inline handlers remain)**
  In `tauri.conf.json`:
  - Remove `**'unsafe-inline'`** from `script-src`.
  - Remove `**dangerousDisableAssetCspModification`** entirely (or set to `**false**`).
  - **Keep** `connect-src` entries needed for the app + IPC (`ipc:`, `http://ipc.localhost`, `tauri://localhost`, `https://tauri.localhost`, etc.) and **media / COOP / COEP** headers if still required for RunAnywhere / mic — those are separate from `script-src`.
5. **Verification**
  - **Web:** `bun dev` — sign-in, landing, dashboard, DB view, Maia AI modal.
  - **Desktop:** `bun run build:desktop:debug` — same flows + **passkeys** + **voice STT** (confirm `navigator.mediaDevices` still OK).

## Acceptance criteria

- No `onclick=` (and no inline `on`* handlers) in `**services/app`** templates that ship in the SPA bundle.
- `tauri.conf.json` has **no** `'unsafe-inline'` in `script-src` and **no** `dangerousDisableAssetCspModification` for `script-src`.
- No new CSP console errors for **script** or **connect** on the sign-in page or post-login shell in **Tauri**.
- Existing behavior preserved (navigation, menus, DB view actions, Maia AI retry, test sign-in if applicable).

## Out of scope (unless you expand the plan)

- **Third-party** scripts loaded from CDN (if any) — would need `script-src` entries or hashes.
- **Refactoring** unrelated HTML/CSS; **only** interaction wiring and CSP-related config.

## References

- Tauri security / CSP: [v2 docs — Security](https://v2.tauri.app/reference/config/#securityconfig) (`dangerousDisableAssetCspModification`, `csp`).
- Current config: `services/app/src-tauri/tauri.conf.json`.

