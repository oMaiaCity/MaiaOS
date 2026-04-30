/**
 * Narrow entry for sync boot: engines + WebSocket peer. Avoids pulling the runtime root barrel.
 */

export { createWebSocketPeer } from 'cojson-transport-ws'
export { DataEngine } from './data/index.js'
export { Evaluator as MaiaScriptEvaluator } from './evaluator.js'
