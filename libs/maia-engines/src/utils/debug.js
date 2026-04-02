/**
 * Engine diagnostics: PERF + TRACE from @MaiaOS/logs.
 *
 * PERF: `maia:perf:engines:*` (see @MaiaOS/logs perf.js)
 * TRACE: `maia:debug:trace` or `?maia_trace=1`
 */
export {
	isTraceEnabled,
	perfEnginesChat,
	perfEnginesPipeline,
	TRACE_STORAGE_KEY,
	traceContextOnError,
	traceInbox,
	traceProcess,
	traceView,
} from '@MaiaOS/logs'
