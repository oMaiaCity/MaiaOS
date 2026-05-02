#!/usr/bin/env bun
/**
 * Runs each workspace `test` script one at a time to avoid EMFILE when many
 * packages spawn `bun test` in parallel via `bun run --workspaces --if-present test`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, "..");

const workspaceDirs = [
	...["services/app", "services/aven", "services/sync"].map((w) => join(root, w)),
	...readdirSync(join(root, "libs"))
		.filter((n) => !n.startsWith("."))
		.map((n) => join(root, "libs", n)),
];

let failed = false;
for (const dir of workspaceDirs) {
	const pkgPath = join(dir, "package.json");
	if (!existsSync(pkgPath)) continue;
	const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
	if (!pkg.scripts?.test) continue;
	const name = pkg.name ?? dir;
	process.stdout.write(`\n>>> ${name}\n\n`);
	const proc = Bun.spawn(["bun", "run", "test"], {
		cwd: dir,
		stdout: "inherit",
		stderr: "inherit",
	});
	await proc.exited;
	if (proc.exitCode !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
