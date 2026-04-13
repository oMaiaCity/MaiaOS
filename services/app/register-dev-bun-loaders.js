/**
 * Dev HTML bundler: mirror services/app/build.js `loader: { '.maia': 'json' }` for transitive
 * workspace imports (e.g. @MaiaOS/universe/factories/*.maia). Without this, .maia can bundle
 * as asset URLs / wrong default export — registry-core annotateMaiaConfig throws in the browser.
 *
 * Registered via bunfig.toml [serve.static] plugins so Bun.serve HTML/HMR graphs pick it up
 * (top-level `plugin()` is not reliably applied to route bundles).
 *
 * @type {import('bun').BunPlugin}
 */
export default {
	name: 'maia-maia-as-json',
	setup(build) {
		build.onLoad({ filter: /\.maia$/ }, async (args) => {
			const text = await Bun.file(args.path).text()
			return {
				contents: `export default ${JSON.stringify(JSON.parse(text))}`,
				loader: 'js',
			}
		})
	},
}
