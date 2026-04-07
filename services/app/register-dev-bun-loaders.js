/**
 * Dev HTML bundler: mirror services/app/build.js `loader: { '.maia': 'json' }` for transitive
 * workspace imports (e.g. @MaiaOS/universe/factories/*.maia). Without this, .maia can bundle
 * as asset URLs / wrong default export and withCanonicalFactorySchema throws in the browser.
 */
import { plugin } from 'bun'

plugin({
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
})
