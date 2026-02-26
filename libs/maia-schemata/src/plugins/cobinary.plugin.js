/**
 * CoBinary validation plugin for MaiaOS schemata
 *
 * CoBinary = binary stream (RawBinaryCoStream) for files.
 * Registers format "binary-metadata" for validating BinaryStreamInfo objects
 * (mimeType required, optional fileName, totalSizeBytes).
 */

export const pluginId = '@schemata/cobinary'

function isValidBinaryMetadata(obj) {
	if (!obj || typeof obj !== 'object') return false
	if (typeof obj.mimeType !== 'string' || obj.mimeType.length === 0) return false
	if (obj.fileName !== undefined && typeof obj.fileName !== 'string') return false
	if (obj.totalSizeBytes !== undefined) {
		if (
			typeof obj.totalSizeBytes !== 'number' ||
			!Number.isInteger(obj.totalSizeBytes) ||
			obj.totalSizeBytes < 0
		) {
			return false
		}
	}
	return true
}

export const formats = [
	{
		name: 'binary-metadata',
		definition: {
			type: 'object',
			validate: (obj) => isValidBinaryMetadata(obj),
		},
	},
]

export const plugin = {
	formats,
}
