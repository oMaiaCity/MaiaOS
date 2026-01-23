/**
 * Maia DB View - Logged-in interface
 * Liquid glass design with widget-based layout
 */

import { truncate } from './utils.js'
// Import getSchema and getAllSchemas from schemas registry (hardcoded schemas)
import { getSchema, getAllSchemas } from '../../libs/maia-db/src/schemas/index.js'

// Helper function to escape HTML
function escapeHtml(text) {
	if (text === null || text === undefined) {
		return '';
	}
	const div = document.createElement('div');
	div.textContent = String(text);
	return div.innerHTML;
}

export async function renderApp(maia, cojsonAPI, authState, syncState, currentView, currentContextCoValueId, switchView, selectCoValue, registerSubscription) {
	// Get data based on current view
	let data, viewTitle, viewSubtitle;
	
	// Load schemas from hardcoded registry (no dynamic loading)
	const allSchemas = getAllSchemas();
	
	// Get account and node for navigation
	const account = maia.id.maiaId;
	const node = maia.id.node;
	
	// Explorer-style navigation: if a CoValue is loaded into context, show it in main container
	if (currentContextCoValueId && cojsonAPI) {
		try {
			// Use unified read API - query by ID (key parameter)
			// Note: schema is required by ReadOperation, but backend handles key-only reads
			// Using the coId as schema is a workaround - backend will use key parameter
			const store = await cojsonAPI.cojson({op: 'read', schema: currentContextCoValueId, key: currentContextCoValueId});
			// ReadOperation returns a ReactiveStore - get current value
			let contextData = store.value || store;
			console.log(`[DB Viewer] Loaded CoValue ${currentContextCoValueId.substring(0, 12)}...:`, {
				id: contextData?.id,
				loading: contextData?.loading,
				hasProperties: !!(contextData?.properties && Array.isArray(contextData.properties)),
				propertiesCount: (contextData?.properties && Array.isArray(contextData.properties)) ? contextData.properties.length : 0,
				error: contextData?.error
			});
			data = contextData;
			
			// Subscribe to ReactiveStore updates for reactivity
			if (registerSubscription && typeof store.subscribe === 'function') {
				const subscriptionKey = `coValue:${currentContextCoValueId}`;
				let lastPropertiesCount = (contextData?.properties && Array.isArray(contextData.properties)) ? contextData.properties.length : (contextData?.loading ? -1 : 0);
				let lastLoadingState = contextData?.loading || false;
				let lastDataHash = JSON.stringify({ 
					propsCount: lastPropertiesCount, 
					loading: lastLoadingState,
					hasError: !!contextData?.error
				});
				
				console.log(`[DB Viewer] Setting up subscription for ${currentContextCoValueId.substring(0, 12)}... (initial: props=${lastPropertiesCount}, loading=${lastLoadingState})`);
				
				const unsubscribe = store.subscribe((updatedData) => {
					// Check if data actually changed (properties appeared, loading state changed, etc.)
					const currentPropertiesCount = (updatedData?.properties && Array.isArray(updatedData.properties)) ? updatedData.properties.length : 0;
					const currentLoadingState = updatedData?.loading || false;
					const currentDataHash = JSON.stringify({ 
						propsCount: currentPropertiesCount, 
						loading: currentLoadingState,
						hasError: !!updatedData?.error
					});
					
					const dataChanged = currentDataHash !== lastDataHash;
					
					if (updatedData && dataChanged) {
						console.log(`🔄 [DB Viewer] Store updated for ${currentContextCoValueId.substring(0, 12)}... (props: ${lastPropertiesCount}→${currentPropertiesCount}, loading: ${lastLoadingState}→${currentLoadingState}), re-rendering...`);
						console.log(`[DB Viewer] Updated data:`, {
							id: updatedData?.id,
							loading: updatedData?.loading,
							hasProperties: !!(updatedData?.properties && Array.isArray(updatedData?.properties)),
							propertiesCount: currentPropertiesCount,
							error: updatedData?.error
						});
						lastPropertiesCount = currentPropertiesCount;
						lastLoadingState = currentLoadingState;
						lastDataHash = currentDataHash;
						// Use setTimeout to prevent infinite loops and batch updates
						setTimeout(() => {
							renderApp(maia, cojsonAPI, authState, syncState, currentView, currentContextCoValueId, switchView, selectCoValue, registerSubscription);
						}, 0);
					}
				});
				registerSubscription(subscriptionKey, unsubscribe);
			} else {
				console.warn(`[DB Viewer] Cannot subscribe to store updates - registerSubscription: ${!!registerSubscription}, store.subscribe: ${typeof store.subscribe}`);
			}
			// Clean displayName: remove (co-id ref...) part, keep only the label
			let cleanDisplayName = contextData.displayName || contextData.schema || 'CoValue';
			// Remove pattern like "Label (abc123...)" - keep only "Label"
			cleanDisplayName = cleanDisplayName.replace(/\s*\([^)]+\)\s*$/, '');
			viewTitle = cleanDisplayName;
			// No subtitle needed - co-id is shown in header
			viewSubtitle = '';
		} catch (err) {
			console.error('Error querying context CoValue:', err);
			data = { error: err.message, id: currentContextCoValueId, loading: false };
			viewTitle = 'Error';
			viewSubtitle = '';
		}
	} else if (currentView && cojsonAPI) {
		// Filter by schema
		// ReadOperation requires schema to be a co-id (co_z...)
		// If currentView is not a co-id, get all CoValues and filter manually
		try {
			if (currentView.startsWith('co_z')) {
				// Schema is already a co-id - use unified read API
				const store = await cojsonAPI.cojson({op: 'read', schema: currentView});
				// ReadOperation returns a ReactiveStore - get current value
				let result = store.value || store;
				data = Array.isArray(result) ? result : [];
				
				// Subscribe to ReactiveStore updates for reactivity
				if (registerSubscription && typeof store.subscribe === 'function') {
					const subscriptionKey = `schema:${currentView}`;
					let lastLength = result.length;
					const unsubscribe = store.subscribe((updatedResult) => {
						// Re-render when store updates (check if data actually changed)
						if (updatedResult && Array.isArray(updatedResult) && updatedResult.length !== lastLength) {
							console.log(`🔄 [DB Viewer] Store updated for schema ${currentView.substring(0, 12)}..., re-rendering...`);
							lastLength = updatedResult.length;
							// Use setTimeout to prevent infinite loops and batch updates
							setTimeout(() => {
								renderApp(maia, cojsonAPI, authState, syncState, currentView, currentContextCoValueId, switchView, selectCoValue, registerSubscription);
							}, 0);
						}
					});
					registerSubscription(subscriptionKey, unsubscribe);
				}
			} else {
				// Human-readable schema name - get all CoValues and filter by schema
				const allCoValues = maia.getAllCoValues();
				data = allCoValues
					.filter(cv => {
						// Match schema name (can be in various formats)
						const schema = cv.schema;
						return schema === currentView || 
						       schema === `@schema/${currentView}` ||
						       schema?.endsWith(`/${currentView}`);
					})
					.map(cv => ({
						id: cv.id,
						schema: cv.schema,
						type: cv.type,
						displayName: cv.schema || cv.id,
						...cv
					}));
			}
		} catch (err) {
			console.error('Error querying CoValues:', err);
			data = [];
		}
	} else if (currentView === 'account' && cojsonAPI) {
		// Default to account view - load account CoValue
		try {
			const store = await cojsonAPI.cojson({op: 'read', schema: null, key: account.id});
			// ReadOperation returns a ReactiveStore - get current value
			let accountData = store.value || store;
			data = accountData;
			
			// Subscribe to ReactiveStore updates for reactivity
			if (registerSubscription && typeof store.subscribe === 'function') {
				const subscriptionKey = `account:${account.id}`;
				const unsubscribe = store.subscribe(() => {
					// Re-render when store updates
					setTimeout(() => {
						renderApp(maia, cojsonAPI, authState, syncState, currentView, currentContextCoValueId, switchView, selectCoValue, registerSubscription);
					}, 0);
				});
				registerSubscription(subscriptionKey, unsubscribe);
			}
			
			// Set account as context if not already set
			if (!currentContextCoValueId) {
				currentContextCoValueId = account.id;
			}
		} catch (err) {
			console.error('Error loading account:', err);
			data = { error: err.message, id: account.id, loading: false };
		}
	} else {
		data = [];
	}
	
	if (currentView && currentView !== 'account') {
		// Get schema from hardcoded registry
		const schema = getSchema(currentView) || allSchemas[currentView];
		viewTitle = schema?.title || currentView;
		viewSubtitle = `${Array.isArray(data) ? data.length : 0} CoValue(s)`;
	} else {
		viewTitle = 'Account';
		viewSubtitle = '';
	}
	
	// Build account structure navigation (Account only)
	const navigationItems = [];
	
	// Entry 1: Account itself
	navigationItems.push({
		id: account.id,
		label: 'Account',
		type: 'account'
	});

	// Build table content based on view
	let tableContent = '';
	
	// Explorer-style: if context CoValue is loaded, show its properties in main container
	if (currentContextCoValueId && data) {
		// Show CoValue properties in main container (reuse property rendering from detail view)
		if (data.error && !data.loading) {
			tableContent = `<div class="empty-state">Error: ${data.error}</div>`;
		} else if (data.loading) {
			tableContent = `
				<div class="empty-state">
					<div class="loading-spinner"></div>
					<p>Loading CoValue... (waiting for verified state)</p>
				</div>
			`;
		} else if (data.properties && data.properties.definition) {
			// Schema CoMap: display schema definition
			const definition = data.properties.definition;
			tableContent = `
				<div class="schema-definition">
					<div class="schema-definition-header">
						<h3>Schema Definition</h3>
						${definition.description ? `<p class="schema-description">${escapeHtml(definition.description)}</p>` : ''}
					</div>
					<pre class="schema-json">${escapeHtml(JSON.stringify(definition, null, 2))}</pre>
				</div>
			`;
		} else if (data.specialContent) {
			// Display special content for CoText, CoStream, CoList
			const special = data.specialContent;
			
			if (special.type === 'plaintext') {
				// CoText: Display text content
				tableContent = `
					<div class="special-content-container">
						<div class="special-content-header">
							<h4>Text Content (${special.length} characters)</h4>
						</div>
						<div class="plaintext-content">
							<pre class="plaintext-display">${escapeHtml(special.text)}</pre>
						</div>
					</div>
				`;
			} else if (special.type === 'stream') {
				// CoStream: Display stream items
				tableContent = `
					<div class="special-content-container">
						<div class="special-content-header">
							<h4>Stream Items (${special.itemCount} total)</h4>
						</div>
						<div class="stream-content">
							${special.items && special.items.length > 0 ? `
								<div class="stream-items">
									${special.items.map((item, index) => {
										const renderValue = (value, depth = 0) => {
											if (depth > 2) return '<span class="nested-depth">...</span>';
											if (value === null) return '<span class="null-value">null</span>';
											if (value === undefined) return '<span class="undefined-value">undefined</span>';
											if (typeof value === 'string' && value.startsWith('co_')) {
												return `<code class="co-id clickable" onclick="selectCoValue('${value}')" title="${value}">${truncate(value, 12)}</code>`;
											}
											if (typeof value === 'string' && value.startsWith('key_')) {
												return `<code class="key-value" title="${value}">${truncate(value, 20)}</code>`;
											}
											if (typeof value === 'string' && value.startsWith('sealed_')) {
												return '<code class="sealed-value">sealed_***</code>';
											}
											if (typeof value === 'boolean') {
												return `<span class="boolean-value ${value ? 'true' : 'false'}">${value}</span>`;
											}
											if (typeof value === 'number') {
												return `<span class="number-value">${value}</span>`;
											}
											if (typeof value === 'string') {
												const maxLength = 100;
												const truncated = value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
												return `<span class="string-value" title="${value}">"${escapeHtml(truncated)}"</span>`;
											}
											if (Array.isArray(value)) {
												return `<span class="array-value">[${value.length} items]</span>`;
											}
											if (typeof value === 'object' && value !== null) {
												const keys = Object.keys(value);
												return `
													<div class="nested-object">
														${keys.slice(0, 3).map(key => `
															<div class="nested-property">
																<span class="nested-key">${key}:</span>
																<span class="nested-value">${renderValue(value[key], depth + 1)}</span>
															</div>
														`).join('')}
														${keys.length > 3 ? `<div class="nested-more">+${keys.length - 3} more</div>` : ''}
													</div>
												`;
											}
											return `<span>${escapeHtml(String(value))}</span>`;
										};
										
										// Generic rendering: handle objects, arrays, primitives
										const itemKeys = typeof item === 'object' && item !== null ? Object.keys(item) : [];
										
										return `
											<div class="stream-item-card">
												<div class="stream-item-header">
													<span class="stream-item-index">#${index + 1}</span>
													${itemKeys.length > 0 ? `<span class="stream-item-type">Object (${itemKeys.length} properties)</span>` : ''}
												</div>
												${typeof item === 'object' && item !== null ? `
													<div class="stream-item-properties">
														${itemKeys.map(key => `
															<div class="stream-item-property">
																<span class="stream-item-property-key">${key}:</span>
																<span class="stream-item-property-value">${renderValue(item[key])}</span>
															</div>
														`).join('')}
													</div>
												` : `
													<div class="stream-item-value">
														${renderValue(item)}
													</div>
												`}
											</div>
										`;
									}).join('')}
								</div>
							` : `
								<div class="empty-state">
									<p>No items in this stream</p>
								</div>
							`}
						</div>
					</div>
				`;
			} else if (special.type === 'list') {
				// CoList: Display list items
				tableContent = `
					<div class="special-content-container">
						<div class="special-content-header">
							<h4>List Items (${special.itemCount} total)</h4>
						</div>
						<div class="list-content">
							${special.items && special.items.length > 0 ? `
								<div class="list-items">
									${special.items.map((item, index) => {
										const renderValue = (value, depth = 0) => {
											if (depth > 2) return '<span class="nested-depth">...</span>';
											if (value === null) return '<span class="null-value">null</span>';
											if (value === undefined) return '<span class="undefined-value">undefined</span>';
											if (typeof value === 'string' && value.startsWith('co_')) {
												return `<code class="co-id clickable" onclick="selectCoValue('${value}')" title="${value}">${truncate(value, 12)}</code>`;
											}
											if (typeof value === 'string' && value.startsWith('key_')) {
												return `<code class="key-value" title="${value}">${truncate(value, 20)}</code>`;
											}
											if (typeof value === 'string' && value.startsWith('sealed_')) {
												return '<code class="sealed-value">sealed_***</code>';
											}
											if (typeof value === 'boolean') {
												return `<span class="boolean-value ${value ? 'true' : 'false'}">${value}</span>`;
											}
											if (typeof value === 'number') {
												return `<span class="number-value">${value}</span>`;
											}
											if (typeof value === 'string') {
												const maxLength = 100;
												const truncated = value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
												return `<span class="string-value" title="${value}">"${escapeHtml(truncated)}"</span>`;
											}
											if (Array.isArray(value)) {
												return `<span class="array-value">[${value.length} items]</span>`;
											}
											if (typeof value === 'object' && value !== null) {
												const keys = Object.keys(value);
												return `
													<div class="nested-object">
														${keys.slice(0, 3).map(key => `
															<div class="nested-property">
																<span class="nested-key">${key}:</span>
																<span class="nested-value">${renderValue(value[key], depth + 1)}</span>
															</div>
														`).join('')}
														${keys.length > 3 ? `<div class="nested-more">+${keys.length - 3} more</div>` : ''}
													</div>
												`;
											}
											return `<span>${escapeHtml(String(value))}</span>`;
										};
										
										const itemKeys = typeof item === 'object' && item !== null ? Object.keys(item) : [];
										
										return `
											<div class="list-item-card">
												<div class="list-item-header">
													<span class="list-item-index">#${index + 1}</span>
													${itemKeys.length > 0 ? `<span class="list-item-type">Object (${itemKeys.length} properties)</span>` : ''}
												</div>
												${typeof item === 'object' && item !== null ? `
													<div class="list-item-properties">
														${itemKeys.map(key => `
															<div class="list-item-property">
																<span class="list-item-property-key">${key}:</span>
																<span class="list-item-property-value">${renderValue(item[key])}</span>
															</div>
														`).join('')}
													</div>
												` : `
													<div class="list-item-value">
														${renderValue(item)}
													</div>
												`}
											</div>
										`;
									}).join('')}
								</div>
							` : `
								<div class="empty-state">
									<p>No items in this list</p>
								</div>
							`}
						</div>
					</div>
				`;
			} else if (special.type === 'binary') {
				// BinaryCoStream: Display binary info
				tableContent = `
					<div class="special-content-container">
						<div class="special-content-header">
							<h4>Binary Content</h4>
						</div>
						<div class="binary-content">
							<p>${special.preview}</p>
						</div>
					</div>
				`;
			}
		} else if (data.loading) {
			// Show loading state
			tableContent = `
				<div class="empty-state">
					<div class="loading-spinner"></div>
					<p>Loading CoValue... (waiting for verified state)</p>
				</div>
			`;
		} else if (data.properties && Array.isArray(data.properties) && data.properties.length > 0) {
			// CoMap: Display properties
			// Get schema definition for property labels
			const schemaDef = data.schema ? getSchema(data.schema) : null;
			
			// Use properties from cojson query result
			const propertyItems = data.properties.map(prop => {
				const value = prop.value;
				const propType = prop.type;
				const key = prop.key;
				
				// Get property label from schema definition
				const propSchema = schemaDef?.properties?.[key];
				const propLabel = propSchema?.title || key; // Use schema title if available
				
				// Format type badge
				const typeBadge = propType || 'unknown';
				const typeClass = typeBadge.replace(/-/g, ''); // Remove hyphens for CSS class
				
				const isCoIdClickable = propType === 'co-id';
				const isExpandable = propType === 'object' || propType === 'array';
				const isClickable = isCoIdClickable || isExpandable;
				
				// Generate unique ID for expandable sections
				const expandId = isExpandable ? `expand-${key}-${Math.random().toString(36).substr(2, 9)}` : '';
				
				// For object/array, format as pretty JSON string
				let expandedContent = '';
				if (isExpandable) {
					try {
						const parsed = typeof value === 'string' ? JSON.parse(value) : value;
						const formattedJson = JSON.stringify(parsed, null, 2);
						expandedContent = `<pre class="json-display">${escapeHtml(formattedJson)}</pre>`;
					} catch (e) {
						expandedContent = `<pre class="json-display error">Error parsing ${propType}: ${e.message}</pre>`;
					}
				}
				
				// Create single onclick handler
				let onclickHandler = '';
				if (isCoIdClickable) {
					onclickHandler = `onclick="selectCoValue('${value}')"`;
				} else if (isExpandable) {
					onclickHandler = `onclick="event.stopPropagation(); toggleExpand('${expandId}')"`;
				}
				
				return `
					<div class="property-item-wrapper">
						<button 
							type="button"
							class="list-item-card property-item-button ${isClickable ? 'hoverable' : ''}"
							${onclickHandler}
						>
							<div class="flex justify-between items-center gap-2">
								<!-- Left side: Property Key -->
								<div class="flex items-center gap-1.5 flex-shrink-0 min-w-0">
									<span class="text-xs font-medium text-slate-500 uppercase tracking-wide truncate" title="${key}">
										${propLabel}
									</span>
									${isExpandable ? `<svg class="w-3 h-3 text-slate-400 expand-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>` : ''}
								</div>
								
								<!-- Right side: Value and Badge -->
							<div class="flex items-center gap-2 flex-1 justify-end min-w-0">
								${propType === 'co-id' ? `<code class="co-id text-xs text-slate-600 hover:underline" title="${value}">${truncate(value, 12)}</code>` :
								  propType === 'key' ? `<code class="key-value text-xs text-slate-600" title="${value}">${truncate(value, 30)}</code>` :
								  propType === 'sealed' ? '<code class="text-xs text-slate-600">sealed_***</code>' :
								  propType === 'null' ? '<span class="text-xs text-slate-400 italic">null</span>' :
								  propType === 'array' ? `<span class="text-xs text-slate-600 break-all min-w-0 text-right">${value}</span>` :
								  `<span class="text-xs text-slate-600 break-all min-w-0 text-right">${truncate(String(value), 50)}</span>`}
								<span class="badge badge-type badge-${typeClass}">${typeBadge}</span>
								${isClickable ? `
									<svg class="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
									</svg>
								` : ''}
							</div>
						</div>
					</button>
					${isExpandable ? `
						<div id="${expandId}" class="expanded-content" style="display: none;">
							${expandedContent}
						</div>
					` : ''}
				</div>
				`;
			}).join('');
			
			tableContent = `
				<div class="list-view-container">
					${propertyItems}
				</div>
			`;
		} else {
			// Fallback: empty or no properties
			tableContent = '<div class="empty-state">No properties available</div>';
		}
	} else {
		// Default account view or other views - show empty state or error
		if (data && data.error) {
			tableContent = `<div class="empty-state">Error: ${data.error}</div>`;
		} else if (!data || (data.properties && data.properties.length === 0)) {
			tableContent = '<div class="empty-state">No properties available</div>';
		} else {
			tableContent = '<div class="empty-state">No data available</div>';
		}
	}
	
	// Build sidebar navigation items (flat structure, same visual level)
	const sidebarItems = navigationItems.map(item => {
		// Account navigation - select account CoValue
		const isActive = currentContextCoValueId === item.id || (currentView === 'account' && !currentContextCoValueId);
		
		const clickHandler = `onclick="selectCoValue('${item.id}')"`;
		
		return `
			<div class="sidebar-item ${isActive ? 'active' : ''}" ${clickHandler}>
				<div class="sidebar-label">
					<span class="sidebar-name">${item.label}</span>
					${item.count !== undefined ? `<span class="sidebar-count">${item.count}</span>` : ''}
				</div>
			</div>
		`;
	}).join('');

	// Get account ID for header status
	const accountId = maia?.id?.maiaId?.id || '';
	
	// Metadata sidebar (explorer-style navigation)
	let metadataSidebar = '';
	if (currentContextCoValueId && data && !data.error && !data.loading) {
		const groupInfo = data.groupInfo || null;
		const hasMembers = groupInfo && (groupInfo.accountMembers?.length > 0 || groupInfo.groupMembers?.length > 0);
		
		// Sort account members: "everyone" first
		const sortedAccountMembers = groupInfo?.accountMembers ? [...groupInfo.accountMembers].sort((a, b) => {
			if (a.id === 'everyone') return -1;
			if (b.id === 'everyone') return 1;
			return 0;
		}) : [];
		
		metadataSidebar = `
			<aside class="db-metadata db-card whitish-card">
				<div class="metadata-content">
					<!-- Consolidated Metadata View (no tabs) -->
					<div class="metadata-info-list">
						${data.schema ? `
							<div class="metadata-info-item">
								<span class="metadata-info-key">@SCHEMA</span>
								${data.schema.startsWith('co_') ? `
									<code class="metadata-info-value co-id" onclick="selectCoValue('${data.schema}')" title="${data.schema}" style="cursor: pointer; text-decoration: underline;">
										${truncate(data.schema, 24)}
									</code>
								` : `
									<code class="metadata-info-value" title="${data.schema}">
										${data.schema}
									</code>
								`}
							</div>
						` : ''}
						<div class="metadata-info-item">
							<span class="metadata-info-key">ID</span>
							<code class="metadata-info-value" title="${data.id}">${truncate(data.id, 24)}</code>
						</div>
						<div class="metadata-info-item">
							<span class="metadata-info-key">CONTENT TYPE</span>
							<span class="badge badge-type badge-${(data.type || 'unknown').replace(/-/g, '')}">${data.type || 'unknown'}</span>
						</div>
						${groupInfo?.groupId ? `
							<div class="metadata-info-item">
								<span class="metadata-info-key">GROUP</span>
								<code class="metadata-info-value co-id" onclick="selectCoValue('${groupInfo.groupId}')" title="${groupInfo.groupId}">${truncate(groupInfo.groupId, 24)}</code>
							</div>
						` : ''}
					</div>
					
					<!-- Members Section (if group info available) -->
					${groupInfo ? (
						hasMembers ? `
							<div class="metadata-members">
								${sortedAccountMembers.length > 0 ? `
									<div class="metadata-section">
										<h4 class="metadata-section-title">Account Members</h4>
										<div class="metadata-members-list">
											${sortedAccountMembers.map(member => {
												const isEveryone = member.id === 'everyone';
												const isAdmin = member.role?.toLowerCase() === 'admin';
												const roleClass = member.role?.toLowerCase() || 'member';
												return `
													<div class="metadata-member-item ${isEveryone ? 'everyone' : ''} ${isAdmin ? 'admin' : ''}">
														<div class="metadata-member-info">
															<span class="metadata-member-id">${isEveryone ? 'Everyone' : truncate(member.id, 16)}</span>
														</div>
														<span class="badge badge-role badge-${roleClass}">${member.role || 'member'}</span>
													</div>
												`;
											}).join('')}
										</div>
									</div>
								` : ''}
								${groupInfo.groupMembers && groupInfo.groupMembers.length > 0 ? `
									<div class="metadata-section">
										<h4 class="metadata-section-title">Group Members</h4>
										<div class="metadata-members-list">
											${groupInfo.groupMembers.map(member => {
												const roleClass = member.role?.toLowerCase() || 'admin';
												return `
													<div class="metadata-member-item">
														<div class="metadata-member-info">
															<code class="metadata-member-id co-id" onclick="selectCoValue('${member.id}')" title="${member.id}">${truncate(member.id, 16)}</code>
														</div>
														<span class="badge badge-role badge-${roleClass}">${member.role || 'admin'}</span>
													</div>
												`;
											}).join('')}
										</div>
									</div>
								` : ''}
							</div>
						` : ''
					) : ''}
				</div>
			</aside>
		`;
	}
	
	document.getElementById("app").innerHTML = `
		<div class="db-container">
			<header class="db-header db-card whitish-card">
				<div class="header-content">
					<div class="header-left">
						<h1>Maia DB</h1>
						<code class="db-status">Connected • ${truncate(accountId, 12)}</code>
					</div>
					<div class="header-right">
						<!-- Sync Status Indicator -->
						<div class="sync-status ${syncState.connected ? 'connected' : 'disconnected'}">
							<span class="sync-dot"></span>
							<span class="sync-text">
								${syncState.connected && syncState.syncing ? 'Syncing' : 
								  syncState.connected ? 'Connected' : 
								  syncState.error || 'Offline'}
							</span>
						</div>
						${authState.signedIn ? `
							<button class="seed-btn" onclick="window.handleSeed()" title="Seed database with schemas and configs (dev only)">
								🌱 Seed
							</button>
							<button class="sign-out-btn" onclick="window.handleSignOut()">
								Sign Out
							</button>
						` : ''}
					</div>
				</div>
			</header>
			
			<div class="db-layout">
				<aside class="db-sidebar db-card whitish-card">
					<div class="sidebar-content-inner">
						<div class="sidebar-header">
							<h3>Navigation</h3>
						</div>
						<div class="sidebar-content">
							${sidebarItems}
						</div>
					</div>
				</aside>
				
				<main class="db-main">
					<div class="inspector db-card whitish-card">
						<div class="inspector-content-inner">
						<div class="inspector-header">
							<div class="flex items-center gap-2 flex-grow">
								${currentContextCoValueId ? `
									<button class="back-btn" onclick="selectCoValue(null)" title="Back to list">
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
										</svg>
										<span class="back-label">Back</span>
									</button>
								` : ''}
								<h2>${viewTitle}</h2>
							</div>
							${currentContextCoValueId && data?.id ? `<code class="co-id-header">${data.id}</code>` : ''}
						</div>
							${tableContent}
						</div>
					</div>
				</main>
				
				${metadataSidebar}
			</div>
		</div>
	`;
}
