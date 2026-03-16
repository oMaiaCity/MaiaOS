export function formatBytes(bytes) {
	if (bytes == null || bytes < 0) return '0 B'
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Compute upload progress updates for actor context.
 * @param {number} loadedBytes - Bytes uploaded so far
 * @param {number} totalBytes - Total bytes to upload
 * @param {'reading'|'bytes'|'storing'|'done'} phase - Pipeline phase
 * @returns {Object} Updates for updateContextCoValue
 */
export function getUploadProgressUpdates(loadedBytes, totalBytes, phase) {
	const pct =
		phase === 'reading'
			? 0
			: phase === 'storing'
				? 95
				: phase === 'done'
					? 100
					: totalBytes > 0
						? Math.round((loadedBytes / totalBytes) * 95)
						: 0
	const isComplete = phase === 'done'
	const status =
		phase === 'reading'
			? `Reading file... (${formatBytes(totalBytes)})`
			: phase === 'storing'
				? `Persisting to storage... (${formatBytes(totalBytes)})`
				: phase === 'done'
					? 'Done'
					: `Saving... ${pct}% (${formatBytes(loadedBytes)} / ${formatBytes(totalBytes)})`
	const style = `width: ${pct}%`
	return {
		uploadStatus: status,
		uploadError: null,
		uploadProgressVisible: true,
		uploadProgressSectionClass: 'upload-progress-section',
		uploadProgressPercent: isComplete ? null : pct,
		uploadProgressStyle: style,
		uploadLoadedBytes: loadedBytes,
		uploadTotalBytes: totalBytes,
	}
}
