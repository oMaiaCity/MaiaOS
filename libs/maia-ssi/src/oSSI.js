/**
 * oSSI - Self-Sovereign Identity service
 * Passkey-based authentication with deterministic account derivation via PRF
 * 
 * STRICT: PRF required, no fallbacks
 */

import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { cojsonInternals } from "cojson";
import { WebSocketPeerWithReconnection } from "cojson-transport-ws";
import { requirePRFSupport } from './feature-detection.js';
import { createPasskeyWithPRF, evaluatePRF, getExistingPasskey } from './prf-evaluator.js';
import { arrayBufferToBase64, base64ToArrayBuffer, stringToUint8Array, isValidAccountID, uint8ArrayToHex } from './utils.js';
import { getStorage } from './storage.js';

// Extract functions from cojsonInternals for cleaner code
const { accountHeaderForInitialAgentSecret, idforHeader, rawCoIDtoBytes, rawCoIDfromBytes } = cojsonInternals;

// Global state for connection monitoring
let jazzSyncState = {
	connected: false,
	syncing: false,
	error: null,
};
const syncStateListeners = new Set();

/**
 * Subscribe to sync state changes
 * @param {Function} listener - Callback function (state) => void
 * @returns {Function} Unsubscribe function
 */
export function subscribeSyncState(listener) {
	syncStateListeners.add(listener);
	listener(jazzSyncState); // Call immediately with current state
	return () => syncStateListeners.delete(listener);
}

function notifySyncStateChange() {
	for (const listener of syncStateListeners) {
		listener(jazzSyncState);
	}
}

/**
 * Create Jazz sync peer array (jazz-tools pattern)
 * Creates WebSocketPeer that will be passed to LocalNode during creation
 * 
 * @param {string} apiKey - Jazz API key
 * @returns {{peers: Array, setNode: Function, wsPeer: Object}} Peers array and node setter
 */
function setupJazzSyncPeers(apiKey) {
	const jazzCloudUrl = `wss://cloud.jazz.tools/?key=${apiKey}`;
	let node = undefined;
	const peers = [];
	
	console.log("🌐 [SYNC] Setting up Jazz sync peer...");
	console.log("   URL:", jazzCloudUrl);
	
	const wsPeer = new WebSocketPeerWithReconnection({
		peer: jazzCloudUrl,
		reconnectionTimeout: 5000,
		addPeer: (peer) => {
			console.log("📥 [SYNC] addPeer callback triggered!");
			if (node) {
				console.log("   Adding peer to node.syncManager...");
				node.syncManager.addPeer(peer);
				console.log("✅ [SYNC] Peer added to sync manager");
				jazzSyncState = { connected: true, syncing: true, error: null };
				notifySyncStateChange();
			} else {
				console.log("   Node not ready yet, storing peer in array");
				peers.push(peer);
			}
		},
		removePeer: (peer) => {
			console.log("📤 [SYNC] removePeer callback triggered!");
			const index = peers.indexOf(peer);
			if (index > -1) {
				peers.splice(index, 1);
			}
			jazzSyncState = { connected: false, syncing: false, error: "Disconnected" };
			notifySyncStateChange();
		},
	});
	
	// Subscribe to connection changes
	wsPeer.subscribe((connected) => {
		console.log(`🔔 [SYNC] Connection state changed: ${connected}`);
		jazzSyncState = { connected, syncing: connected, error: connected ? null : "Offline" };
		notifySyncStateChange();
	});
	
	// Enable the peer immediately
	wsPeer.enable();
	console.log("✅ [SYNC] WebSocket peer enabled and ready");
	
	return {
		peers,
		setNode: (n) => {
			node = n;
			console.log("🔗 [SYNC] Node assigned to peer");
		},
		wsPeer,
	};
}

/**
 * Sign up with passkey using TRUE SINGLE-PASSKEY FLOW
 * 
 * BREAKTHROUGH DISCOVERY: accountID can be re-computed deterministically!
 * Since account headers have NO random fields (createdAt: null, uniqueness: null),
 * accountID = shortHash(header) is a PURE FUNCTION of agentSecret.
 * 
 * This means:
 * 1. Create ONE passkey, evaluate PRF → get prfOutput
 * 2. Derive agentSecret from prfOutput
 * 3. Compute accountID deterministically
 * 4. Create account
 * 
 * On login: Re-evaluate PRF → same prfOutput → same agentSecret → same accountID!
 * NO STORAGE NEEDED!
 * 
 * @param {Object} options
 * @param {string} options.name - Display name for the account (default: "maia")
 * @param {string} options.salt - Salt for PRF derivation (default: "maia.city")
 * @returns {Promise<{accountID: string, agentSecret: Object, node: Object, account: Object}>}
 */
export async function signUpWithPasskey({ name = "maia", salt = "maia.city" } = {}) {
	console.log("🔐 Starting passkey sign-up (TRUE single-passkey flow)...");
	console.log("   🎯 ONE passkey, ONE biometric prompt, ZERO storage!");
	
	await requirePRFSupport();
	
	const saltBytes = stringToUint8Array(salt);
	const crypto = await WasmCrypto.create();
	
	// STEP 1: Create single passkey and evaluate PRF
	console.log("📱 Step 1/3: Creating passkey and deriving secret...");
	const { credentialId, prfOutput } = await createPasskeyWithPRF({
		name,
		userId: globalThis.crypto.getRandomValues(new Uint8Array(32)), // Random userID - we don't store anything!
		salt: saltBytes,
	});
	
	if (!prfOutput) {
		throw new Error("PRF evaluation failed");
	}
	
	console.log("✅ Passkey created and secret derived!");
	console.log("   💡 AccountID will be re-computed on every login!");
	
	// STEP 2: Compute accountID deterministically
	console.log("🧮 Step 2/3: Computing accountID deterministically...");
	const agentSecret = crypto.agentSecretFromSecretSeed(prfOutput);
	const accountHeader = accountHeaderForInitialAgentSecret(agentSecret, crypto);
	const computedAccountID = idforHeader(accountHeader, crypto);
	
	console.log("✅ AccountID computed:", computedAccountID);
	console.log("   🔑 Chain: PRF → agentSecret → header → accountID");
	console.log("   ♻️  Same passkey + salt = same accountID (always!)");
	
	// STEP 3: Create account
	console.log("🏗️ Step 3/3: Creating account...");
	const { LocalNode } = await import("cojson");
	
	// Get IndexedDB storage for persistence (BEFORE account creation!)
	const storage = await getStorage();
	
	// Setup Jazz sync peers BEFORE account creation (jazz-tools pattern!)
	const apiKey = import.meta.env?.VITE_JAZZ_API_KEY;
	let syncSetup = null;
	if (apiKey) {
		console.log("🔌 [SYNC] Setting up Jazz sync BEFORE account creation...");
		syncSetup = setupJazzSyncPeers(apiKey);
	}
	
	const result = await LocalNode.withNewlyCreatedAccount({
		creationProps: { name },
		crypto,
		initialAgentSecret: agentSecret,
		peers: syncSetup ? syncSetup.peers : [], // Pass peers array directly!
		storage, // Pass storage directly! (jazz-tools pattern)
	});
	
	// Assign node to peer callbacks
	if (syncSetup) {
		syncSetup.setNode(result.node);
		console.log("✅ [SYNC] Jazz sync peer connected to node");
	}
	
	if (storage) {
		console.log("💾 [STORAGE] Account persisted to IndexedDB");
	}
	
	const account = result.node.expectCurrentAccount("signUpWithPasskey");
	const createdAccountID = account.id;
	
	// VERIFICATION: Computed accountID MUST match created accountID!
	console.log("🔍 Verifying accountID...");
	console.log("   Computed:", computedAccountID);
	console.log("   Created: ", createdAccountID);
	
	if (createdAccountID !== computedAccountID) {
		throw new Error(
			`CRITICAL: AccountID mismatch!\n` +
			`  Computed: ${computedAccountID}\n` +
			`  Created:  ${createdAccountID}\n` +
			`This should never happen - deterministic computation failed!`
		);
	}
	
	console.log("✅ AccountID verification passed!");
	console.log("🎉 Registration complete! TRUE single-passkey flow!");
	console.log("   📱 1 passkey created");
	console.log("   👆 1 biometric prompt");
	console.log("   💾 0 secrets stored");
	
	if (!syncSetup) {
		console.warn("⚠️  [SYNC] No Jazz API key - account won't sync to cloud!");
	}
	
	return { 
		accountID: createdAccountID, 
		agentSecret,
		node: result.node,
		account,
		credentialId: arrayBufferToBase64(credentialId),
	};
}

/**
 * Sign in with existing passkey using TRUE SINGLE-PASSKEY FLOW
 * 
 * BREAKTHROUGH: Re-evaluate PRF to deterministically compute everything!
 * 
 * Flow:
 * 1. User selects passkey (biometric auth)
 * 2. Re-evaluate PRF with salt → get prfOutput
 * 3. Derive agentSecret from prfOutput
 * 4. Compute accountID deterministically
 * 5. Load account
 * 
 * NO STORAGE NEEDED - everything computed on the fly!
 * 
 * @param {Object} options
 * @param {string} options.salt - Salt for PRF derivation (must match signup, default: "maia.city")
 * @returns {Promise<{accountID: string, agentSecret: Object, node: Object, account: Object}>}
 */
export async function signInWithPasskey({ salt = "maia.city" } = {}) {
	console.log("🔐 Starting passkey sign-in (TRUE single-passkey flow)...");
	console.log("   🎯 ONE biometric prompt, ZERO storage reads!");
	
	await requirePRFSupport();
	
	const saltBytes = stringToUint8Array(salt);
	
	// Re-evaluate PRF to get prfOutput (same as signup!)
	console.log("📱 Authenticating and re-evaluating PRF...");
	const { prfOutput } = await evaluatePRF({ salt: saltBytes });
	
	if (!prfOutput) {
		throw new Error("PRF evaluation failed during sign-in");
	}
	
	console.log("✅ Passkey authenticated and PRF re-evaluated!");
	console.log("   💡 Same passkey + salt → same prfOutput (deterministic!)");
	
	// STEP 2: Derive agentSecret from prfOutput
	console.log("🔑 Deriving agentSecret...");
	const crypto = await WasmCrypto.create();
	const agentSecret = crypto.agentSecretFromSecretSeed(prfOutput);
	
	// STEP 3: ⚡ COMPUTE ACCOUNT ID DETERMINISTICALLY (same as signup!)
	console.log("🧮 Computing accountID deterministically...");
	const accountHeader = accountHeaderForInitialAgentSecret(agentSecret, crypto);
	const accountID = idforHeader(accountHeader, crypto);
	
	console.log("✅ AccountID re-computed:", accountID);
	console.log("   🔑 Chain: PRF → agentSecret → header → accountID");
	console.log("   ♻️  No storage needed - computed on the fly!");
	
	// STEP 4: Load account
	console.log("🔓 Loading account...");
	const storage = await getStorage();
	
	const apiKey = import.meta.env?.VITE_JAZZ_API_KEY;
	let syncSetup = null;
	if (apiKey) {
		console.log("🔌 [SYNC] Setting up Jazz sync...");
		syncSetup = setupJazzSyncPeers(apiKey);
	}
	
	const { LocalNode } = await import("cojson");
	
	const node = await LocalNode.withLoadedAccount({
		accountID,
		accountSecret: agentSecret,
		crypto,
		peers: syncSetup ? syncSetup.peers : [],
		storage,
	});
	
	if (syncSetup) {
		syncSetup.setNode(node);
		console.log("✅ [SYNC] Jazz sync peer connected");
	}
	
	if (storage) {
		console.log("💾 [STORAGE] Account loaded from IndexedDB");
	}
	
	const account = node.expectCurrentAccount("signInWithPasskey");
	
	console.log("✅ Account loaded! ID:", account.id);
	console.log("🎉 Sign-in complete! TRUE single-passkey flow!");
	console.log("   📱 1 biometric prompt");
	console.log("   💾 0 secrets retrieved from storage");
	console.log("   ⚡ Everything computed deterministically!");
	
	if (!apiKey) {
		console.warn("⚠️  [SYNC] No VITE_JAZZ_API_KEY - running offline");
	}
	
	return { 
		accountID: account.id, 
		agentSecret,
		node,
		account,
	};
}

/**
 * NO LOCALSTORAGE: Session-only authentication
 * All state is in memory only. Passkeys stored in hardware.
 * Account data synced to Jazz cloud server.
 */

