/**
 * Engine diagnostics: PERF + TRACE from @MaiaOS/logs.
 *
 * PERF: `maia:perf:engines:*` (see @MaiaOS/logs perf.js)
 * TRACE: `LOG_MODE` trace.* tokens (see @MaiaOS/logs trace.js)
 */
export {
	isTraceEnabled,
	perfEnginesChat,
	perfEnginesPipeline,
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
