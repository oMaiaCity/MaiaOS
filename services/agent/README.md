# Agent Service

Server-side agent with HTTP trigger for spark registration, human registry, and todo creation.

## Endpoints

- `GET /health` - Health check
- `GET /profile` - Debug: account, sparks, profile info
- `POST /on-added` - Register human's spark. Body: `{ sparkId }`
- `POST /register-human` - Register human in spark.registries.humans. Body: `{ username, accountId }`
- `POST /trigger` - Create todo. Body: `{ text?, spark? }`

## Examples

```bash
curl http://localhost:4204/health
curl http://localhost:4204/profile
curl -X POST http://localhost:4204/on-added -H "Content-Type: application/json" -d '{"sparkId":"co_z..."}'
curl -X POST http://localhost:4204/register-human -H "Content-Type: application/json" -d '{"username":"samuel","accountId":"co_z..."}'
curl -X POST http://localhost:4204/trigger -H "Content-Type: application/json" -d '{"text":"Buy milk","spark":"@Maia"}'
```

## Environment

| Var | Required | Default |
|-----|----------|---------|
| `AGENT_MAIA_AGENT_ACCOUNT_ID` | Yes | - |
| `AGENT_MAIA_AGENT_SECRET` | Yes | - |
| `AGENT_MAIA_STORAGE` | No | `pglite` |
| `AGENT_MAIA_DB_PATH` / `DB_PATH` | No | `./local-agent.db` (when pglite) |
| `PORT` | No | `4204` |

Run `bun agent:generate --service agent` to generate credentials.
