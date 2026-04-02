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
	traceActorProcessEvents,
	traceContextOnError,
	traceDataCreate,
	traceInbox,
	traceProcess,
	traceProcessOp,
	traceRuntimeProcess,
	traceView,
	traceViewDeliver,
} from '@MaiaOS/logs'
