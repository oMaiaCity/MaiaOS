#!/usr/bin/env bun
/**
 * Archived one-shot — bulk replace already applied. Do not re-run (would corrupt paths).
 */
import { bootstrapNodeLogging, createLogger } from '../libs/maia-logs/src/index.js'

bootstrapNodeLogging()
const noopLog = createLogger('scripts')
noopLog.log('No-op: factory ref migration was applied once.')
