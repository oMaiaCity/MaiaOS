# Sentrux test gaps (workflow)

After structural work lands, re-run **Sentrux** (`sentrux .`, MCP `scan` → `test_gaps`, or IDE integration) and treat the ranked **untested high-risk files** as the backlog.

## Order of work

1. **Structure first** — `sentrux check .` green on `.sentrux/rules.toml` (layers + cycle budget).
2. **Test gaps second** — from the latest `test_gaps` report, take the **top 20** by risk score and add targeted tests (behavioural, not coverage theater).
3. **Re-scan** — depth/coupling and gap list both move; deprioritize files that dropped out of the hotspot list.

## Local parity

- CI already runs **`sentrux check .`** on PRs (see `.github/workflows/biome.yml`).
- For the numeric gap list, use the **Sentrux MCP** `test_gaps` tool or the GUI treemap after `sentrux scan`.

No standalone script is required — the tool owns the ranking.
