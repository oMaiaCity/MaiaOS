/**
 * One-off: longest first-party import path (rough @MaiaOS + relative resolution).
 * Run: bun scripts/sentrux-longest-chain.mjs
 */
import { readFile } from "fs/promises"
import path from "node:path"

const root = process.cwd()
const importRe = /from\s+["']([^"']+)["']/g
/** Strip block + line comments so JSDoc `import('pkg')` is not parsed as an edge. */
function stripComments(src) {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/\/\/.*$/gm, "")
}

/** @MaiaOS/pkg → libs dirname */
const MAIA_SCOPE_TO_DIR = {
	db: "maia-db",
	runtime: "maia-runtime",
	peer: "maia-peer",
	logs: "maia-logs",
	validation: "maia-validation",
	storage: "maia-storage",
	self: "maia-self",
	seed: "maia-seed",
	universe: "maia-universe",
	flows: "maia-flows",
	"maia-distros": "maia-distros",
	game: "maia-game",
	mail: "maia-mail",
	"maia-ucan": "maia-ucan",
	timeouts: "maia-timeouts",
	brand: "maia-brand",
}

async function gitFiles() {
	const p = Bun.spawnSync(
		["git", "ls-files", "*.js", "*.mjs"],
		{ cwd: root, stdout: "pipe" },
	)
	return new TextDecoder()
		.decode(p.stdout)
		.trim()
		.split("\n")
		.filter(Boolean)
}

async function fileExists(rel) {
	try {
		const s = await Bun.file(path.join(root, rel)).stat()
		return s.isFile
	} catch {
		return false
	}
}

async function resolveWorkspaceSpec(spec) {
	const m = spec.match(/^@MaiaOS\/([^/]+)(?:\/(.+))?$/)
	if (!m) return null
	const scopeName = m[1]
	const sub = m[2]
	const dir = MAIA_SCOPE_TO_DIR[scopeName]
	if (!dir) return null
	if (!sub) {
		const idx = `libs/${dir}/src/index.js`
		if (await fileExists(idx)) return idx
		return null
	}
	const base = `libs/${dir}/src/${sub}`
	if (await fileExists(base)) return base
	if (await fileExists(`${base}.js`)) return `${base}.js`
	if (await fileExists(`${base}.mjs`)) return `${base}.mjs`
	if (await fileExists(`${base}/index.js`)) return `${base}/index.js`
	return null
}

async function resolveSpec(fromFile, spec) {
	if (spec.startsWith("@MaiaOS/")) return resolveWorkspaceSpec(spec)
	if (!spec.startsWith(".")) return null
	const dir = path.dirname(fromFile)
	let resolved = path.normalize(path.join(dir, spec)).replaceAll("\\", "/")
	if (!resolved.endsWith(".js") && !resolved.endsWith(".mjs")) {
		if (await fileExists(`${resolved}.js`)) resolved = `${resolved}.js`
		else if (await fileExists(`${resolved}.mjs`)) resolved = `${resolved}.mjs`
		else if (await fileExists(`${resolved}/index.js`)) resolved = `${resolved}/index.js`
		else return null
	}
	const rel = path.relative(root, path.join(root, resolved))
	if (rel.startsWith("..")) return null
	return rel.replaceAll("\\", "/")
}

const files = await gitFiles()
const fileSet = new Set(files)
const edges = new Map()

for (const f of files) {
	let text
	try {
		text = await readFile(path.join(root, f), "utf8")
	} catch {
		continue
	}
	const specs = new Set()
	let m
	const body = stripComments(text)
	importRe.lastIndex = 0
	while ((m = importRe.exec(body))) specs.add(m[1])
	const outs = new Set()
	for (const spec of specs) {
		const to = await resolveSpec(f, spec)
		if (to && fileSet.has(to) && to !== f) outs.add(to)
	}
	edges.set(f, [...outs])
}

/** Longest path (node count) in DAG via topo order + DP; detects cycles. */
function longestPathTopo(nodes, outAdj) {
	const indeg = new Map()
	for (const n of nodes) indeg.set(n, 0)
	for (const u of nodes) {
		for (const v of outAdj.get(u) || []) {
			indeg.set(v, (indeg.get(v) || 0) + 1)
		}
	}
	const q = []
	for (const n of nodes) {
		if (indeg.get(n) === 0) q.push(n)
	}
	const topo = []
	while (q.length) {
		const u = q.shift()
		topo.push(u)
		for (const v of outAdj.get(u) || []) {
			const k = indeg.get(v) - 1
			indeg.set(v, k)
			if (k === 0) q.push(v)
		}
	}
	if (topo.length !== nodes.size) {
		return { error: "cycle or incomplete topo (resolver graph != Sentrux DAG)" }
	}
	const nodesLen = new Map()
	const pred = new Map()
	for (const n of nodes) {
		nodesLen.set(n, 1)
		pred.set(n, null)
	}
	for (const u of topo) {
		const base = nodesLen.get(u)
		for (const v of outAdj.get(u) || []) {
			if (nodesLen.get(v) < base + 1) {
				nodesLen.set(v, base + 1)
				pred.set(v, u)
			}
		}
	}
	let end = null
	let best = 0
	for (const n of nodes) {
		const L = nodesLen.get(n)
		if (L > best) {
			best = L
			end = n
		}
	}
	const chain = []
	for (let x = end; x; x = pred.get(x)) chain.push(x)
	chain.reverse()
	return { chain, length: best }
}

const nodes = new Set(files)
for (const [u, outs] of edges) {
	for (const v of outs) nodes.add(v)
}
const outAdj = new Map()
for (const n of nodes) outAdj.set(n, [])
for (const [u, outs] of edges) {
	if (!nodes.has(u)) continue
	for (const v of outs) {
		if (!nodes.has(v)) continue
		outAdj.get(u).push(v)
	}
}

const result = longestPathTopo(nodes, outAdj)
if (result.error) {
	console.error(result.error)
	// find a cycle for debugging resolver
	const state = new Map()
	const stack = []
	function dfsCycle(u) {
		state.set(u, 1)
		stack.push(u)
		for (const v of outAdj.get(u) || []) {
			if (!state.has(v)) {
				const c = dfsCycle(v)
				if (c) return c
			} else if (state.get(v) === 1) {
				const i = stack.indexOf(v)
				return stack.slice(i).concat([v])
			}
		}
		stack.pop()
		state.set(u, 2)
		return null
	}
	for (const f of nodes) {
		if (!state.has(f)) {
			const c = dfsCycle(f)
			if (c) {
				console.error("example cycle:", c.join(" -> "))
				break
			}
		}
	}
	process.exit(1)
}

console.log("longest chain length (nodes):", result.length)
console.log(result.chain.join("\n  -> \n"))
