# Account authentication types (taxonomy)

This page fixes overloaded words: **human**, **Aven**, **agent** mean different things in different layers.

## Two separate axes

### 1. Operator (who is using the runtime)

- **Human** — A person using the browser app (the usual case).
- **Agent** — Automated process: sync server identity, workers, headless jobs. Not the same as "has a secret key": both humans and agents can use `AgentSecret`-style material.

### 2. Auth surface (how the account key is established)

| Auth surface | Mechanism | Typical use |
|---|---|---|
| **Passkey** | WebAuthn + PRF extension; no shared secret in env | Production browser sign-up / sign-in |
| **Secret key** | Pre-provisioned `AgentSecret` from environment | Dev-only browser sign-in (`VITE_AVEN_TEST_*`), sync server account (`AVEN_MAIA_ACCOUNT` / `AVEN_MAIA_SECRET`), test harnesses |

Both **passkey** and **secret key** browser flows are **human operator** flows: one chooses credentials interactively (passkey), the other reads a dev secret from `.env` (secret key). Naming one "Aven" in the UI was misleading: **Aven** in the product stack often means the **server-side Maia agent**, not "humans who use a static secret in the browser."

### Storage mode (`getStorage`) is not the same as auth surface

- **`mode: 'human'`** (browser) — OPFS / IndexedDB: used for **both** passkey accounts and **secret key dev** accounts in Chromium/Safari.
- **`mode: 'agent'`** (Node) — PGlite / Postgres: sync server and other long-lived agents.

## Common combinations

| Scenario | Operator | Auth surface | Storage |
|---|---|---|---|
| Production app | Human | Passkey | Browser (`human`) |
| Local dev “second login” without passkeys | Human | Secret key (`VITE_AVEN_TEST_*`) | Browser (`human`) |
| Sync service process | Agent | Secret key (`AVEN_MAIA_*`) | Node (`agent`) |

## Identity index and CoJSON vocabulary

- **`identity.factory.maia`** (`type: human|aven`) — Indexed under `spark.os.indexes`; membership for approved people, unrelated to “passkey vs secret key”.
- **`POST /register` `type: 'aven'`** — Creates an **Aven-class identity** (product type), not “browser secret key login”.

## Legacy env names

`VITE_AVEN_TEST_*` keeps the **AVEN** prefix for backward compatibility with `.env`; it enables **secret key dev sign-in** in the browser — not the sync server agent account.
