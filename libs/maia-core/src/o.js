import { signInWithPasskey, isPRFSupported } from "@MaiaOS/ssi";

/**
 * MaiaOS Kernel - Unified 'o' object
 * 
 * STRICT: Account creation handled by @MaiaOS/ssi
 * No manual account creation, passkey authentication required
 */
export async function createMaiaOS(options = {}) {
	const { node, account, accountID, name } = options;

	// STRICT: node and account REQUIRED (must come from signInWithPasskey)
	if (!node || !account) {
		throw new Error(
			"Node and Account required. Use signInWithPasskey() first.\n" +
			"Example:\n" +
			"  const { node, account } = await signInWithPasskey();\n" +
			"  const o = await createMaiaOS({ node, account });"
		);
	}

	console.log("✅ MaiaOS initialized with authenticated account:", accountID || account.id);
	console.log("📋 Account type:", account.type);
	console.log("📋 Account keys:", account.keys());

	return {
		// o.id - Identity layer (MaiaID)
		id: {
			maiaId: account,
			node: node,
		},

		// o.auth - Authentication layer (NEW!)
		auth: createAuthAPI(),

		// o.db - Database layer (future)
		db: {},

		// o.script - DSL/Execution layer (future)
		script: {},

		// Inspector (dev tool)
		inspector: () => {
			const maiaIdData = { id: accountID };
			
			// Get all keys from the Account CoMap using .keys() method
			const accountKeys = account.keys();
			
			// Iterate through all CoMap keys and resolve co-ids
			for (const key of accountKeys) {
				try {
					const value = account.get(key); // Use CoMap.get() method
					
					// Check if it's a co-id reference (string starting with "co_")
					if (typeof value === "string" && value.startsWith("co_")) {
						// Try to load and resolve the CoValue
						try {
							const resolved = node.expectCoValueLoaded(value);
							if (resolved) {
								const content = resolved.getCurrentContent();
								
								// Get the content as an object (it's a CoMap)
								let resolvedData = {};
								if (content.asObject) {
									resolvedData = content.asObject();
								} else {
									// Fallback: try to extract properties manually
									for (const resKey in content) {
										try {
											const propValue = content[resKey];
											if (typeof propValue !== 'function' && resKey !== 'core' && resKey !== 'node') {
												resolvedData[resKey] = propValue;
											}
										} catch {}
									}
								}
								
								maiaIdData[key] = {
									"_co_id": value,
									"_resolved": resolvedData
								};
							} else {
								maiaIdData[key] = value; // Co-id not loaded yet
							}
						} catch (error) {
							maiaIdData[key] = `${value} (not loaded: ${error.message})`;
						}
					} else {
						maiaIdData[key] = value;
					}
				} catch (error) {
					maiaIdData[key] = `<error: ${error.message}>`;
				}
			}
			
			return maiaIdData;
		},
		
		// Get all CoValues stored in the system
		getAllCoValues: () => {
			const allCoValues = [];
			
			console.log("🔍 LocalNode structure:", Object.keys(node));
			console.log("🔍 LocalNode.coValues type:", node.coValues?.constructor?.name);
			
			// Try different ways to access coValues
			let coValuesMap = node.coValues;
			
			// If it's a Map, iterate correctly
			if (coValuesMap && typeof coValuesMap.entries === 'function') {
				console.log("🔍 coValues is a Map with", coValuesMap.size, "entries");
				
				for (const [coId, coValueCore] of coValuesMap.entries()) {
					try {
						// Get the current content (the actual CoValue)
						const content = coValueCore.getCurrentContent();
						
						console.log(`🔍 CoValue ${coId}:`, {
							type: content?.type,
							hasKeys: !!content?.keys,
							content: content,
							core: coValueCore
						});
						
						// Access header from coValueCore.verified.header
						const header = coValueCore.verified?.header;
						
						// Get type from content
						const type = content?.type || 'unknown';
						
						// Get keys count (only for CoMaps)
						let keysCount = 'N/A';
						if (content && content.keys && typeof content.keys === 'function') {
							try {
								const keys = content.keys();
								keysCount = keys.length;
							} catch (e) {
								console.warn("Keys error:", e);
							}
						}
						
					// Get metadata from header
					const headerMeta = header?.meta || null;
					
					// Extract schema from headerMeta
					const schema = headerMeta?.$schema || null;
					
					// Get created timestamp
					const createdAt = header?.createdAt || null;
					
					// Extract special content based on type
					let specialContent = null;
					if (type === 'costream') {
						// Get stream items (stored by session)
						try {
							const streamData = content.toJSON();
							if (streamData instanceof Uint8Array) {
								// Binary stream
								specialContent = {
									type: 'stream',
									itemCount: 'binary',
									preview: `${streamData.length} bytes`
								};
							} else if (streamData && typeof streamData === 'object') {
								// JSON stream - flatten all sessions
								const allItems = [];
								for (const sessionKey in streamData) {
									if (Array.isArray(streamData[sessionKey])) {
										allItems.push(...streamData[sessionKey]);
									}
								}
								specialContent = {
									type: 'stream',
									itemCount: allItems.length,
									preview: allItems.slice(0, 3)
								};
							}
						} catch (e) {
							console.warn("Stream content error:", e);
						}
					} else if (type === 'coplaintext') {
						// Get plaintext content
						try {
							const text = content.toString();
							specialContent = {
								type: 'plaintext',
								length: text.length,
								preview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
							};
						} catch (e) {
							console.warn("Plaintext content error:", e);
						}
					} else if (type === 'colist') {
						// Get list items count
						try {
							const items = content.toJSON();
							specialContent = {
								type: 'list',
								itemCount: items.length,
								preview: items.slice(0, 3)
							};
						} catch (e) {
							console.warn("List content error:", e);
						}
					}
					
					allCoValues.push({
						id: coId,
						type: type,
						schema: schema,  // NEW: Add schema field
						headerMeta: headerMeta,
						keys: keysCount,
						createdAt: createdAt,
						content: specialContent,  // NEW: Add special content
					});
				} catch (error) {
					console.warn(`Failed to load CoValue ${coId}:`, error);
					allCoValues.push({
						id: coId,
						type: 'error',
						schema: null,  // NEW: Add schema field
						headerMeta: null,
						keys: 'N/A',
						createdAt: null,
						error: error.message,
					});
				}
				}
			} else {
				console.warn("🔍 coValues is not a Map or doesn't exist");
			}
			
				console.log("🔍 Final CoValues list:", allCoValues);
			
			return allCoValues;
		},
		
		// Get detailed data for a specific CoValue
		getCoValueDetail: (coId) => {
			try {
				console.log(`🔍 Getting detail for CoValue: ${coId}`);
				
				// Get the CoValue from the node
				const coValueCore = node.getCoValue(coId);
				if (!coValueCore) {
					return { error: "CoValue not found" };
				}
				
				const content = coValueCore.getCurrentContent();
				const header = coValueCore.verified?.header;
				
				const detail = {
					id: coId,
					type: content?.type || 'unknown',
					headerMeta: header?.meta || null,
					createdAt: header?.createdAt || null,
					properties: [],
					specialContent: null  // NEW: Add special content field
				};
				
				// Handle different CoValue types
				if (content?.type === 'costream') {
					// CoStream or BinaryCoStream
					try {
						const streamData = content.toJSON();
						if (streamData instanceof Uint8Array) {
							detail.specialContent = {
								type: 'binary',
								size: streamData.length,
								preview: `Binary data: ${streamData.length} bytes`
							};
						} else if (streamData && typeof streamData === 'object') {
							// JSON stream - flatten all sessions
							const allItems = [];
							for (const sessionKey in streamData) {
								if (Array.isArray(streamData[sessionKey])) {
									allItems.push(...streamData[sessionKey]);
								}
							}
							detail.specialContent = {
								type: 'stream',
								itemCount: allItems.length,
								items: allItems
							};
						}
					} catch (e) {
						console.warn("Stream detail error:", e);
					}
				} else if (content?.type === 'coplaintext') {
					// CoPlainText
					try {
						const text = content.toString();
						detail.specialContent = {
							type: 'plaintext',
							length: text.length,
							text: text
						};
					} catch (e) {
						console.warn("Plaintext detail error:", e);
					}
				} else if (content?.type === 'colist') {
					// CoList
					try {
						const items = content.toJSON();
						detail.specialContent = {
							type: 'list',
							itemCount: items.length,
							items: items
						};
					} catch (e) {
						console.warn("List detail error:", e);
					}
				}
				
				// If it's a CoMap, get all keys and values
				if (content && content.keys && typeof content.keys === 'function') {
					const keys = content.keys();
					
					for (const key of keys) {
						try {
							const value = content.get(key);
							let type = typeof value;
							let displayValue = value;
							
							// Detect co-id references
							if (typeof value === 'string' && value.startsWith('co_')) {
								type = 'co-id';
							} else if (typeof value === 'string' && value.startsWith('key_')) {
								type = 'key';
							} else if (typeof value === 'string' && value.startsWith('sealed_')) {
								type = 'sealed';
								displayValue = 'sealed_***';
							} else if (typeof value === 'object' && value !== null) {
								displayValue = JSON.stringify(value);
							}
							
							detail.properties.push({
								key: key,
								value: displayValue,
								type: type
							});
						} catch (e) {
							detail.properties.push({
								key: key,
								value: `<error: ${e.message}>`,
								type: 'error'
							});
						}
					}
				} else if (content && content.length !== undefined) {
					// It's a CoList
					try {
						const items = [];
						for (let i = 0; i < content.length; i++) {
							items.push(content.get(i));
						}
						detail.properties.push({
							key: 'items',
							value: JSON.stringify(items),
							type: 'array'
						});
					} catch (e) {
						detail.properties.push({
							key: 'items',
							value: `<error: ${e.message}>`,
							type: 'error'
						});
					}
				}
				
				console.log("🔍 CoValue detail:", detail);
				return detail;
			} catch (error) {
				console.error(`Failed to get CoValue detail for ${coId}:`, error);
				return { 
					id: coId,
					error: error.message 
				};
			}
		},
	};
}

/**
 * Create auth API for managing authentication state
 * STRICT: PRF required, throws if unsupported
 */
function createAuthAPI() {
	return {
		/**
		 * Initialize auth system - check PRF support
		 * STRICT: Throws if PRF not supported
		 */
		init: async () => {
			try {
				await isPRFSupported();
				console.log("✅ Auth system initialized - PRF supported");
			} catch (error) {
				throw new Error(
					"WebAuthn PRF not supported. Please use:\n" +
					"- Chrome on macOS/Linux/Windows 11\n" +
					"- Safari on macOS 13+/iOS 16+\n" +
					"Firefox and Windows 10 are NOT supported."
				);
			}
		},

		/**
		 * Sign in with passkey (auto-detects register vs login)
		 * @param {Object} options
		 * @param {string} options.salt - Salt for PRF (default: "maia.city")
		 * @returns {Promise<{accountID: string, agentSecret: Object, node: Object, account: Object}>}
		 */
		signIn: async (options = {}) => {
			const { salt = "maia.city" } = options;
			console.log("🔐 Signing in with passkey...");
			// Note: signInWithPasskey now creates/loads the account internally
			return await signInWithPasskey({ salt });
		},

		/**
		 * REMOVED: No localStorage, session-only authentication
		 * Use signIn() to create a new session
		 */
	};
}
