/**
 * Parse `°maia/data/<file>.data.maia[<nanoid>]` bracket refs (seed / manifests).
 * @param {string} ref
 * @returns {{ dataFile: string, itemNanoid: string, pathKey: string } | null}
 */
export function parseDataMaiaBracketRef(ref) {
	if (typeof ref !== 'string' || !ref.startsWith('°maia/data/')) return null
	const m = /^°maia\/data\/([^[\]]+\.data\.maia)\[([^\]]+)\]$/.exec(ref)
	if (!m) return null
	const dataFile = m[1]
	const itemNanoid = m[2]
	const pathKey = `data/${dataFile}`
	return { dataFile, itemNanoid, pathKey }
}
