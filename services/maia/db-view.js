/**
 * Maia DB View - Logged-in interface
 * Liquid glass design with widget-based layout
 */

import { truncate, getSyncStatusMessage } from './utils.js'
// Import from kernel bundle - everything bundled (no direct @MaiaOS/db in production)
import { getSchema, getAllSchemas, resolveAccountCoIdsToProfileNames, resolveGroupCoIdsToCapabilityNames } from '@MaiaOS/kernel'
import { renderDashboard, renderVibeViewer } from './dashboard.js'

// Helper function to escape HTML
function escapeHtml(text) {
	if (text === null || text === undefined) {
		return '';
	}
	const div = document.createElement('div');
	div.textContent = String(text);
	return div.innerHTML;
}

export async function renderApp(maia, authState, syncState, currentScreen, currentView, currentContextCoValueId, currentVibe, currentSpark, switchView, selectCoValue, loadVibe, loadSpark, navigateToScreen) {
	// Route to appropriate screen based on currentScreen
	if (currentScreen === 'dashboard') {
		await renderDashboard(maia, authState, syncState, navigateToScreen, currentSpark, loadSpark, loadVibe);
		return;
	}

	if (currentScreen === 'vibe-viewer' && currentVibe) {
		await renderVibeViewer(maia, authState, syncState, currentVibe, navigateToScreen, currentSpark);
		return;
	}
	
	// Default: render DB viewer (currentScreen === 'db-viewer')
	// Helper to render any value consistently
	const renderValue = (value, depth = 0) => {
		if (depth > 2) return '<span class="nested-depth">...</span>';
		if (value === null) return '<span class="text-xs italic null-value text-slate-400">null</span>';
		if (value === undefined) return '<span class="text-xs italic undefined-value text-slate-400">undefined</span>';
		
		if (typeof value === 'string') {
			if (value.startsWith('co_')) {
				return `<code class="text-xs co-id text-marine-blue-muted hover:underline clickable" onclick="selectCoValue('${value}')" title="${value}">${truncate(value, 12)}</code>`;
			}
			if (value.startsWith('key_')) {
				return `<code class="text-xs key-value text-marine-blue-muted" title="${value}">${truncate(value, 30)}</code>`;
			}
			if (value.startsWith('sealed_')) {
				return '<code class="text-xs italic sealed-value text-marine-blue-muted">sealed_***</code>';
			}
			
			const maxLength = 100;
			const truncated = value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
			return `<span class="min-w-0 text-xs text-right break-all string-value text-marine-blue-muted" title="${value}">"${escapeHtml(truncated)}"</span>`;
		}
		
		if (typeof value === 'boolean') {
			return `<span class="boolean-value ${value ? 'true' : 'false'} text-xs font-semibold ${value ? 'text-lush-green bg-lush-green/10' : 'text-marine-blue-muted bg-white/10'} px-1.5 py-0.5 rounded">${value}</span>`;
		}
		
		if (typeof value === 'number') {
			return `<span class="text-xs font-medium number-value text-marine-blue-muted">${value}</span>`;
		}
		
		if (Array.isArray(value)) {
			// Truncate array preview to max 24 characters
			const preview = `[${value.length} ${value.length === 1 ? 'item' : 'items'}]`;
			const truncated = preview.length > 24 ? preview.substring(0, 21) + '...' : preview;
			return `<span class="text-xs italic array-value text-marine-blue-light" title="${escapeHtml(JSON.stringify(value))}">${escapeHtml(truncated)}</span>`;
		}
		
		if (typeof value === 'object' && value !== null) {
			// Create a compact JSON preview string, truncated to max 24 characters total (including "OBJECT >")
			const objectIndicator = ' OBJECT >';
			const maxJsonLength = 24 - objectIndicator.length; // Reserve space for " OBJECT >"
			
			try {
				const jsonString = JSON.stringify(value);
				let truncated = jsonString;
				if (jsonString.length > maxJsonLength) {
					truncated = jsonString.substring(0, maxJsonLength - 3) + '...';
				}
				return `<span class="text-xs italic object-value text-marine-blue-light" title="${escapeHtml(jsonString)}">${escapeHtml(truncated)}<span class="text-marine-blue-light/50">${objectIndicator}</span></span>`;
			} catch (e) {
				// Fallback if JSON.stringify fails
				const keys = Object.keys(value);
				const preview = `{${keys.length} ${keys.length === 1 ? 'key' : 'keys'}}`;
				let truncated = preview;
				if (preview.length > maxJsonLength) {
					truncated = preview.substring(0, maxJsonLength - 3) + '...';
				}
				return `<span class="text-xs italic object-value text-marine-blue-light">${escapeHtml(truncated)}<span class="text-marine-blue-light/50">${objectIndicator}</span></span>`;
			}
		}
		
		return `<span class="text-xs text-marine-blue-muted">${escapeHtml(String(value))}</span>`;
	};

	// Helper to format JSON properly (parse if string, then stringify with indentation)
	const formatJSON = (value) => {
		if (typeof value === 'string') {
			// Try to parse as JSON first
			try {
				const parsed = JSON.parse(value);
				return JSON.stringify(parsed, null, 2);
			} catch (e) {
				// Not valid JSON, return as-is
				return value;
			}
		} else if (Array.isArray(value)) {
			// Explicitly handle arrays
			return JSON.stringify(value, null, 2);
		} else if (typeof value === 'object' && value !== null) {
			// Handle objects
			return JSON.stringify(value, null, 2);
		} else {
			return String(value);
		}
	};

	// Helper to render a property row consistently
	const renderPropertyRow = (label, value, type, key, isExpandable = false, expandId = '', schemaTitle = '') => {
		const typeClass = type ? type.replace(/-/g, '') : 'unknown';
		const isCoIdClickable = type === 'co-id';
		const isClickable = isCoIdClickable || isExpandable;
		
		let onclickHandler = '';
		if (isCoIdClickable) {
			onclickHandler = `onclick="selectCoValue('${value}')"`;
		} else if (isExpandable) {
			onclickHandler = `onclick="event.stopPropagation(); toggleExpand('${expandId}')"`;
		}

		return `
			<div class="w-full property-item-wrapper">
				<button 
					type="button"
					class="list-item-card property-item-button w-full ${isClickable ? 'hoverable' : ''} group"
					${onclickHandler}
				>
					<div class="flex gap-3 justify-between items-center">
						<!-- Left side: Property Key -->
						<div class="flex flex-shrink-0 gap-2 items-center min-w-0">
							<span class="text-[10px] font-bold text-marine-blue-light uppercase tracking-widest truncate group-hover:text-marine-blue transition-colors" title="${key}">
								${label}
							</span>
							${isExpandable ? `<svg class="w-3 h-3 transition-colors text-marine-blue-light/50 group-hover:text-marine-blue expand-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>` : ''}
						</div>
						
						<!-- Right side: Value and Badge -->
						<div class="flex flex-1 gap-2.5 justify-end items-center min-w-0">
							<div class="flex flex-1 justify-end truncate value-container">
								${renderValue(value)}
							</div>
							<span class="badge badge-type badge-${typeClass} text-[9px] px-1.5 py-0.5 font-bold uppercase tracking-tighter rounded-md border border-white/50 shadow-sm">${type.toUpperCase()}</span>
							${isClickable ? `
								<svg class="w-3 h-3 transition-colors text-marine-blue-light/50 group-hover:text-marine-blue shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
								</svg>
							` : ''}
						</div>
					</div>
				</button>
				${isExpandable ? `
					<div id="${expandId}" class="p-3 mt-1 rounded-b-xl border-t backdrop-blur-md expanded-content bg-white/20 border-white/10" style="display: none;">
						<pre class="json-display text-[11px] font-mono text-marine-blue-muted leading-relaxed whitespace-pre-wrap break-words">${escapeHtml(formatJSON(value))}</pre>
					</div>
				` : ''}
			</div>
		`;
	};

	// Get data based on current view
	let data, viewTitle, viewSubtitle;
	
	// Load schemas from hardcoded registry (no dynamic loading)
	const allSchemas = getAllSchemas();
	
	// Get account and node for navigation
	const account = maia.id.maiaId;
	const node = maia.id.node;

	// Default to showing account if no context is set
	if (!currentContextCoValueId && account?.id) {
		currentContextCoValueId = account.id;
	}

	// Explorer-style navigation: if a CoValue is loaded into context, show it in main container
	if (currentContextCoValueId && maia) {
		try {
			// Use unified read API - query by ID (key parameter)
			// Note: schema is required by ReadOperation, but backend handles key-only reads
			// Using the coId as schema is a workaround - backend will use key parameter
			const store = await maia.db({op: 'read', schema: currentContextCoValueId, key: currentContextCoValueId});
			// ReadOperation returns a ReactiveStore - get current value
			let contextData = store.value || store;
			// Operations API returns flat objects: {id: '...', profile: '...', vibes: '...'}
			// Convert to normalized format for DB Viewer display
			const hasProperties = contextData && typeof contextData === 'object' && !Array.isArray(contextData) && Object.keys(contextData).filter(k => k !== 'id' && k !== 'loading' && k !== 'error' && k !== '$schema' && k !== 'type').length > 0;
			const propertiesCount = hasProperties ? Object.keys(contextData).filter(k => k !== 'id' && k !== 'loading' && k !== 'error' && k !== '$schema' && k !== 'type').length : 0;
			
			data = contextData;
			
			// Subscribe to ReactiveStore updates for reactivity
			if (typeof store.subscribe === 'function') {
				// Count properties from flat object (exclude metadata keys)
				const flatPropertyCount = contextData && typeof contextData === 'object' && !Array.isArray(contextData) 
					? Object.keys(contextData).filter(k => k !== 'id' && k !== 'loading' && k !== 'error' && k !== '$schema' && k !== 'type').length 
					: 0;
				let lastPropertiesCount = contextData?.loading ? -1 : flatPropertyCount;
				let lastLoadingState = contextData?.loading || false;
				let lastDataHash = JSON.stringify({ 
					propsCount: lastPropertiesCount, 
					loading: lastLoadingState, 
					hasError: !!contextData?.error
				});
				
				store.subscribe((updatedData) => {
					// Check if data actually changed (properties appeared, loading state changed, etc.)
					// Count properties from flat object (exclude metadata keys)
					const currentFlatPropertyCount = updatedData && typeof updatedData === 'object' && !Array.isArray(updatedData)
						? Object.keys(updatedData).filter(k => k !== 'id' && k !== 'loading' && k !== 'error' && k !== '$schema' && k !== 'type').length
						: 0;
					const currentPropertiesCount = updatedData?.loading ? -1 : currentFlatPropertyCount;
					const currentLoadingState = updatedData?.loading || false;
					const currentDataHash = JSON.stringify({ 
						propsCount: currentPropertiesCount, 
						loading: currentLoadingState,
						hasError: !!updatedData?.error
					});
					
					const dataChanged = currentDataHash !== lastDataHash;
					
					if (updatedData && dataChanged) {
						lastPropertiesCount = currentPropertiesCount;
						lastLoadingState = currentLoadingState;
						lastDataHash = currentDataHash;
						setTimeout(() => {
							renderApp(maia, authState, syncState, currentScreen, currentView, currentContextCoValueId, currentVibe, currentSpark, switchView, selectCoValue, loadVibe, loadSpark, navigateToScreen);
						}, 0);
					}
				});
				// ReactiveStore handles cleanup automatically
			}
			// Use ID as title (no displayName logic)
			viewTitle = contextData.id ? truncate(contextData.id, 24) : 'CoValue';
			viewSubtitle = '';
		} catch (err) {
			console.error('Error querying context CoValue:', err);
			data = { error: err.message, id: currentContextCoValueId, loading: false };
			viewTitle = 'Error';
			viewSubtitle = '';
		}
	} else if (currentView && maia) {
		// Filter by schema
		// ReadOperation requires schema to be a co-id (co_z...)
		// If currentView is not a co-id, get all CoValues and filter manually
		try {
			if (currentView.startsWith('co_z')) {
				// Schema is already a co-id - use unified read API
				const store = await maia.db({op: 'read', schema: currentView});
				// ReadOperation returns a ReactiveStore - get current value
				let result = store.value || store;
				data = Array.isArray(result) ? result : [];
				
				// Subscribe to ReactiveStore updates for reactivity
				if (typeof store.subscribe === 'function') {
					let lastLength = result.length;
					store.subscribe((updatedResult) => {
						// Re-render when store updates (check if data actually changed)
						if (updatedResult && Array.isArray(updatedResult) && updatedResult.length !== lastLength) {
							lastLength = updatedResult.length;
							// Use setTimeout to prevent infinite loops and batch updates
							setTimeout(() => {
								renderApp(maia, authState, syncState, currentScreen, currentView, currentContextCoValueId, currentVibe, currentSpark, switchView, selectCoValue, loadVibe, loadSpark, navigateToScreen);
							}, 0);
						}
					});
					// ReactiveStore handles cleanup automatically
				}
			} else {
				// Human-readable schema name - get all CoValues and filter by schema
				const allCoValues = maia.getAllCoValues();
				data = allCoValues
					.filter(cv => {
						// Match schema name (can be in various formats)
						const schema = cv.$schema; // STRICT: Only $schema, no fallback
						return schema === currentView || 
							   schema === `@maia/schema/${currentView}` ||
							   (cv.headerMeta?.$schema === currentView);
					})
					.map(cv => ({
						displayName: cv.$schema || cv.id, // STRICT: Only $schema, no fallback
						...cv
					}));
			}
		} catch (err) {
			console.error('Error querying by schema:', err);
			data = [];
		}
		const schema = getSchema(currentView) || allSchemas[currentView];
		viewTitle = schema?.title || currentView;
		viewSubtitle = `${Array.isArray(data) ? data.length : 0} CoValue(s)`;
	} else {
		// Default: show account ID if available
		viewTitle = account?.id ? truncate(account.id, 24) : 'CoValue';
		viewSubtitle = '';
	}
	
	// Build account structure navigation (Account only - vibes removed from sidebar)
	const navigationItems = [];
	
	// Entry 1: Account itself
	navigationItems.push({
		id: account.id,
		label: 'Account',
		type: 'account'
	});

	// Build table content based on view
	let tableContent = '';
	let headerInfo = null; // Store header info for colist/costream to display in inspector-header
	
	// DB Viewer only shows DB content (no vibe rendering here)
	if (currentContextCoValueId && data) {
		// Explorer-style: if context CoValue is loaded, show its properties in main container
		// Show CoValue properties in main container (reuse property rendering from detail view)
		if (data.error && !data.loading) {
			tableContent = `<div class="p-8 font-medium text-center text-rose-500 rounded-2xl border border-rose-100 empty-state bg-rose-50/50">Error: ${data.error}</div>`;
		} else if (data.loading) {
			tableContent = `
				<div class="flex flex-col justify-center items-center p-12 rounded-2xl border empty-state bg-slate-50/50 border-slate-100">
					<div class="w-8 h-8 rounded-full border-4 animate-spin loading-spinner border-slate-200 border-t-slate-400"></div>
					<p class="mt-4 font-medium text-slate-500">Loading CoValue... (waiting for verified state)</p>
				</div>
			`;
		} else if ((data.cotype || data.type) === 'colist' || (data.cotype || data.type) === 'costream') {
			// CoList/CoStream: Display items directly (they ARE the list/stream, no properties)
			const items = data.items || [];
			const isStream = (data.cotype || data.type) === 'costream';
			const typeLabel = isStream ? 'CoStream' : 'CoList';
			
			// Store header info for display in inspector-header
			headerInfo = {
				type: data.cotype || data.type,
				typeLabel: typeLabel,
				itemCount: items.length,
				description: isStream ? 'Append-only stream' : 'Ordered list'
			};
			
			const itemRows = items.map((item, index) => {
				const label = `#${index + 1}`;
				let type = typeof item;
				if (typeof item === 'string' && item.startsWith('co_')) {
					type = 'co-id';
				} else if (Array.isArray(item)) {
					type = 'array';
				} else if (typeof item === 'object' && item !== null) {
					type = 'object';
				}
				
				// Make objects and arrays expandable
				const isExpandable = (typeof item === 'object' && item !== null) || Array.isArray(item);
				const expandId = isExpandable ? `expand-item-${index}-${Math.random().toString(36).substr(2, 9)}` : '';
				
				return renderPropertyRow(label, item, type, label, isExpandable, expandId);
			}).join('');

			tableContent = `
				<div class="space-y-4 list-stream-container">
					<div class="space-y-1 list-view-container">
						${items.length > 0 ? itemRows : `<div class="p-8 italic text-center rounded-xl border border-dashed text-slate-400 bg-slate-50/30 border-slate-200">No items in this ${typeLabel.toLowerCase()}</div>`}
					</div>
				</div>
			`;
		} else if (data && typeof data === 'object' && !Array.isArray(data) && !data.error && !data.loading) {
			// CoMap: Display properties from flat object format (operations API)
			// Convert flat object to normalized format for display
			const schemaCoId = data.$schema; // STRICT: Only $schema, no fallback
			const schemaDef = schemaCoId ? getSchema(schemaCoId) : null;
			
			// Extract properties from flat object (exclude metadata keys)
			// groupInfo is backend-derived metadata (not a co-value property) - only show in metadata sidebar
			const propertyKeys = Object.keys(data).filter(k => 
				k !== 'id' && 
				k !== 'loading' && 
				k !== 'error' && 
				k !== '$schema' && 
				k !== 'schema' && 
				k !== 'type' &&
				k !== 'cotype' &&  // Display only in metadata aside, not as main content property
				k !== 'displayName' &&
				k !== 'headerMeta' &&
				k !== 'groupInfo'  // Backend metadata - displayed in metadata sidebar, not as a property
			);
			
			if (propertyKeys.length === 0) {
				// No properties - show empty state
				tableContent = '<div class="p-12 italic text-center rounded-2xl border border-dashed empty-state text-slate-400 bg-slate-50/30 border-slate-200">No properties available</div>';
			} else {
				const propertyItems = propertyKeys.map(key => {
					const value = data[key];
					let propType = typeof value;
				
					// Detect co-id references
					if (typeof value === 'string' && value.startsWith('co_')) {
						propType = 'co-id';
					} else if (typeof value === 'string' && value.startsWith('key_')) {
						propType = 'key';
					} else if (typeof value === 'string' && value.startsWith('sealed_')) {
						propType = 'sealed';
					} else if (Array.isArray(value)) {
						propType = 'array';
					} else if (typeof value === 'object' && value !== null) {
						propType = 'object';
					}
					
					const propSchema = schemaDef?.properties?.[key];
					const propLabel = propSchema?.title || key;
					
					// Make objects and arrays expandable
					const isExpandable = propType === 'object' || propType === 'array' || 
						(typeof value === 'object' && value !== null && !Array.isArray(value)) ||
						Array.isArray(value);
					const expandId = isExpandable ? `expand-${key}-${Math.random().toString(36).substr(2, 9)}` : '';
					
					return renderPropertyRow(propLabel, value, propType, key, isExpandable, expandId);
				}).join('');
			
				tableContent = `
					<div class="space-y-1 list-view-container">
						${propertyItems}
					</div>
				`;
			}
		} else {
			// Fallback: empty or no properties
			tableContent = '<div class="p-12 italic text-center rounded-2xl border border-dashed empty-state text-slate-400 bg-slate-50/30 border-slate-200">No properties available</div>';
		}
	} else {
		// Default view - show list of CoValues or error
		tableContent = '<div class="p-12 italic text-center rounded-2xl border border-dashed empty-state text-slate-400 bg-slate-50/30 border-slate-200">Select a CoValue to explore its content</div>';
	}

	// Get account ID for header status; resolve to profile name for navbar display
	const accountId = maia?.id?.maiaId?.id || '';
	let accountDisplayName = truncate(accountId, 12);
	if (accountId && accountId.startsWith('co_z') && maia?.db) {
		try {
			const profileNames = await resolveAccountCoIdsToProfileNames(maia, [accountId]);
			accountDisplayName = profileNames.get(accountId) ?? accountDisplayName;
		} catch (e) {
			console.warn('[DB Viewer] Failed to resolve account profile name:', e);
		}
	}
	// Metadata sidebar (explorer-style navigation)
	let metadataSidebar = '';
	if (currentContextCoValueId && data && !data.error && !data.loading) {
		const groupInfo = data.groupInfo || null;

		// Flattened "Members with access": each row is (who, role, source)
		// Inherited roles (= via parent group) are only shown under "via" to avoid duplicates
		const flattenedMembers = [];
		const viaMemberIds = new Set();
		if (groupInfo?.groupMembers) {
			for (const g of groupInfo.groupMembers) {
				for (const m of g.members || []) {
					viaMemberIds.add(m.id);
					flattenedMembers.push({
						who: m.id,
						role: m.role || 'reader',
						source: `via ${truncate(g.id, 12)}`,
						viaGroupId: g.id  // Parent group/capability – link to this CoValue, not the account
					});
				}
			}
		}
		if (groupInfo?.accountMembers) {
			for (const m of groupInfo.accountMembers) {
				// Skip inherited: already shown under "via" above
				if (m.isInherited && viaMemberIds.has(m.id)) continue;
				flattenedMembers.push({
					who: m.id,
					role: m.role || 'reader',
					source: m.isInherited ? 'inherited' : 'direct'
				});
			}
		}
		// Sort: everyone first, then by source (direct, then via…, then inherited)
		const sourceOrder = (s) => (s === 'direct' ? 0 : s === 'inherited' ? 2 : 1);
		flattenedMembers.sort((a, b) => {
			if (a.who === 'everyone') return -1;
			if (b.who === 'everyone') return 1;
			return sourceOrder(a.source) - sourceOrder(b.source) || String(a.who).localeCompare(b.who);
		});
		const hasMembers = flattenedMembers.length > 0;

		// Fetch schema title if schema is a co-id using the abstracted read operation API
		let schemaTitle = null;
		const schemaCoId = data.$schema || data.schema; // Prefer $schema, fallback to schema
		if (schemaCoId && schemaCoId.startsWith('co_z') && maia) {
			try {
				// Use unified read API - same pattern as loading main context data
				const schemaStore = await maia.db({op: 'read', schema: schemaCoId, key: schemaCoId});
				const schemaData = schemaStore.value || schemaStore;
				
				if (schemaData && !schemaData.error && !schemaData.loading) {
					// Operations API returns flat objects: {id: '...', title: '...', definition: {...}, ...}
					if (schemaData && typeof schemaData === 'object' && !Array.isArray(schemaData)) {
						// Check title directly
						if (schemaData.title && typeof schemaData.title === 'string') {
							schemaTitle = schemaData.title;
						}
						// Also check definition.title for schema definitions
						if (!schemaTitle && schemaData.definition && typeof schemaData.definition === 'object') {
							schemaTitle = schemaData.definition.title || null;
						}
					}
				}
			} catch (e) {
				console.warn('[DB Viewer] Failed to fetch schema title:', e);
			}
		}
		
		// Fetch group name if group ID is available (groups are CoMaps, so they can have a "name" property)
		let groupName = null;
		if (groupInfo?.groupId && maia) {
			try {
				// Use unified read API with @group schema hint (groups don't have $schema)
				const groupStore = await maia.db({op: 'read', schema: '@group', key: groupInfo.groupId});
				
				// Wait for group data to be available (if it's loading)
				if (groupStore.loading) {
					await new Promise((resolve, reject) => {
						const timeout = setTimeout(() => {
							reject(new Error('Timeout waiting for group data'));
						}, 5000);
						const unsubscribe = groupStore.subscribe(() => {
							if (!groupStore.loading) {
								clearTimeout(timeout);
								unsubscribe();
								resolve();
							}
						});
					});
				}
				
				const groupData = groupStore.value || groupStore;
				
				if (groupData && !groupData.error && !groupData.loading) {
					// Groups are CoMaps, so they can have a "name" property
					// Check both direct property access and properties array (for normalized format)
					if (groupData.name && typeof groupData.name === 'string') {
						groupName = groupData.name;
					} else if (groupData.properties && Array.isArray(groupData.properties)) {
						// Check properties array format (from extractCoValueData)
						const nameProp = groupData.properties.find(p => p.key === 'name');
						if (nameProp && nameProp.value && typeof nameProp.value === 'string') {
							groupName = nameProp.value;
						}
					}
					
					// Group name will be available after sync if not immediately visible
				}
			} catch (e) {
				console.warn('[DB Viewer] Failed to fetch group name:', e);
			}
		}

		// Resolve account co-ids to profile names for members display
		let profileNames = new Map();
		if (hasMembers && maia) {
			try {
				const accountCoIds = flattenedMembers.map(row => row.who).filter(id => id);
				profileNames = await resolveAccountCoIdsToProfileNames(maia, accountCoIds);
			} catch (e) {
				console.warn('[DB Viewer] Failed to resolve account profile names:', e);
			}
		}

		// Resolve capability group co-ids to display names (e.g. @maia/Guardian)
		let capabilityNames = new Map();
		if (maia && account?.id) {
			try {
				const groupCoIds = [...new Set([
					...(groupInfo?.groupId ? [groupInfo.groupId] : []),
					...(flattenedMembers?.map(row => row.viaGroupId).filter(Boolean) ?? [])
				])];
				capabilityNames = await resolveGroupCoIdsToCapabilityNames(maia, groupCoIds, account.id);
			} catch (e) {
				console.warn('[DB Viewer] Failed to resolve capability group names:', e);
			}
		}
		
		metadataSidebar = `
			<aside class="db-metadata">
				<div class="metadata-content">
					<!-- Consolidated Metadata View (no tabs) -->
					<div class="metadata-info-list">
						<!-- ID first (item's own ID) -->
						<div class="metadata-info-item metadata-info-id-row">
							<span class="metadata-info-key">ID</span>
							<div class="metadata-info-value-wrap">
								<code class="metadata-info-value" title="${escapeHtml(data.id || '')}">${truncate(data.id, 24)}</code>
								<button type="button" class="metadata-copy-id" title="Copy full ID" data-copy-id="${escapeHtml(data.id || '')}" onclick="(function(btn){const id=btn.dataset.copyId;if(id)navigator.clipboard.writeText(id).then(()=>{btn.textContent='✓';setTimeout(()=>btn.textContent='⎘',800)});})(this)">⎘</button>
							</div>
						</div>
						${schemaCoId ? `
							<div class="metadata-info-item">
								<span class="metadata-info-key">@SCHEMA</span>
								${schemaCoId.startsWith('co_') ? `
									${schemaTitle ? `
										<code class="metadata-info-value co-id" onclick="selectCoValue('${schemaCoId}')" title="${schemaCoId}" style="cursor: pointer; text-decoration: underline;">
											${escapeHtml(schemaTitle)}
										</code>
										<div class="metadata-info-schema-id" title="${schemaCoId}">${truncate(schemaCoId, 24)}</div>
									` : `
										<code class="metadata-info-value co-id" onclick="selectCoValue('${schemaCoId}')" title="${schemaCoId}" style="cursor: pointer; text-decoration: underline;">
											${truncate(schemaCoId, 24)}
										</code>
									`}
								` : `
									<code class="metadata-info-value" title="${schemaCoId}">
										${schemaCoId}
									</code>
								`}
							</div>
						` : ''}
						<div class="metadata-info-item">
							<span class="metadata-info-key">CO TYPE</span>
							<span class="badge badge-type badge-${String(data.cotype || data.type || 'unknown').replace(/-/g, '')}">
								${(data.cotype || data.type) === 'colist' ? 'COLIST' : (data.cotype || data.type) === 'costream' ? 'COSTREAM' : String(data.cotype || data.type || 'unknown').toUpperCase()}
							</span>
						</div>
						${groupInfo?.groupId ? `
							<div class="metadata-info-item">
								<span class="metadata-info-key">OWNER</span>
								${(groupName || capabilityNames.get(groupInfo.groupId)) ? `
									<div style="display: flex; flex-direction: column; gap: 2px;">
										<span class="metadata-info-value" style="font-weight: 600; color: #1e293b;">
											${escapeHtml(groupName || capabilityNames.get(groupInfo.groupId))}
										</span>
										<code class="co-id" onclick="selectCoValue('${groupInfo.groupId}')" title="${groupInfo.groupId}" style="cursor: pointer; text-decoration: underline; font-size: 11px; color: #64748b;">
											${truncate(groupInfo.groupId, 24)}
										</code>
									</div>
								` : `
									<code class="metadata-info-value co-id" onclick="selectCoValue('${groupInfo.groupId}')" title="${groupInfo.groupId}" style="cursor: pointer; text-decoration: underline;">
										${truncate(groupInfo.groupId, 24)}
									</code>
								`}
							</div>
						` : ''}
					</div>
					
					<!-- Members with access: single flattened list (who, role, source) - no separate Parent Groups section -->
					${groupInfo ? (
						hasMembers ? `
							<div class="metadata-members">
								<div class="metadata-section">
									<h4 class="metadata-section-title">Members with access</h4>
									<div class="metadata-info-hint" style="font-size: 10px; color: #64748b; margin-bottom: 8px;">
										Who has access, their role, and whether it's direct or via a group
									</div>
									<div class="metadata-members-list">
										${flattenedMembers.map(row => {
											const isEveryone = row.who === 'everyone';
											const roleClass = row.role?.toLowerCase() || 'reader';
											const displayName = isEveryone ? 'Everyone' : (profileNames.get(row.who) ?? truncate(row.who, 16));
											// Row 1: account name. Row 2: group name (link) or "direct", both left-aligned
											const groupLinkHtml = row.viaGroupId
												? `<code class="co-id" onclick="selectCoValue('${row.viaGroupId}')" title="${row.viaGroupId}" style="cursor: pointer; text-decoration: underline; font-size: 9px;">${escapeHtml(capabilityNames.get(row.viaGroupId) ?? truncate(row.viaGroupId, 12))}</code>`
												: null;
											const sourceLine = row.viaGroupId ? groupLinkHtml : (row.source ? escapeHtml(row.source) : null);
											return `
												<div class="metadata-member-item ${isEveryone ? 'everyone' : ''}" title="${escapeHtml(String(row.role))} access — ${escapeHtml(row.source)}${!isEveryone ? ` (${escapeHtml(row.who)})` : ''}">
													<div class="metadata-member-info">
														<span class="metadata-member-id">${escapeHtml(displayName)}</span>
														${sourceLine ? `<div class="metadata-member-via">${sourceLine}</div>` : ''}
													</div>
													<span class="badge badge-role badge-${roleClass}">${row.role}</span>
												</div>
											`;
										}).join('')}
									</div>
								</div>
							</div>
						` : `
							<div class="metadata-empty">No member information available for this group.</div>
						`
					) : ''}
				</div>
			</aside>
		`;
	}
	
	// Build sidebar navigation items (Account only - no vibes)
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

	document.getElementById("app").innerHTML = `
		<div class="db-container">
			<header class="db-header whitish-card">
				<div class="header-content">
					<div class="header-left">
						<div class="sync-status ${syncState.connected ? 'connected' : 'disconnected'}" title="${getSyncStatusMessage(syncState)}" aria-label="${getSyncStatusMessage(syncState)}">
							<span class="sync-dot"></span>
						</div>
						<h1>Maia DB</h1>
					</div>
					<div class="header-center">
						<!-- Logo centered in navbar -->
						<img src="/brand/logo_dark.svg" alt="Maia City" class="header-logo-centered" />
					</div>
					<div class="header-right">
						${authState.signedIn ? `
							<span class="db-status db-status-name" title="Account: ${accountId}">${escapeHtml(accountDisplayName)}</span>
						` : ''}
						<!-- Hamburger menu button (mobile only) -->
						<button class="hamburger-btn" onclick="window.toggleMobileMenu()" aria-label="Toggle menu">
							<span></span>
							<span></span>
							<span></span>
						</button>
						${authState.signedIn ? `
							<button class="sign-out-btn" onclick="window.handleSignOut()">
								Sign Out
							</button>
						` : ''}
					</div>
				</div>
				<!-- Mobile menu (collapsed by default) - account ID shown inside -->
				<div class="mobile-menu" id="mobile-menu">
					${authState.signedIn && accountId ? `
						<div class="mobile-menu-account-id">
							<code class="mobile-menu-account-id-value" title="${escapeHtml(accountId)}">${escapeHtml(accountId)}</code>
							<button type="button" class="mobile-menu-copy-id" title="Copy ID" data-copy-id="${escapeHtml(accountId)}" onclick="(function(btn){const id=btn.dataset.copyId;if(id)navigator.clipboard.writeText(id).then(()=>{btn.textContent='✓';setTimeout(()=>btn.textContent='⎘',800)});})(this)">⎘</button>
						</div>
					` : ''}
					${authState.signedIn ? `
						<button class="mobile-menu-item sign-out-btn" onclick="window.handleSignOut(); window.toggleMobileMenu();">
							Sign Out
						</button>
					` : ''}
				</div>
			</header>

			<div class="db-layout">
				<aside class="db-sidebar">
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
					<div class="inspector">
						<div class="inspector-content-inner">
							<div class="inspector-header">
								<div class="flex flex-grow gap-3 items-center">
									${currentContextCoValueId && data?.id ? `
										<code class="co-id-header">${truncate(data.id, 32)}</code>
									` : `
										<h2>${viewTitle}</h2>
									`}
									${headerInfo ? `
										<span class="badge badge-type badge-${headerInfo.type} text-[10px] px-2 py-1 font-bold uppercase tracking-widest rounded-lg border border-white/50 shadow-sm">${headerInfo.typeLabel}</span>
										<span class="text-sm font-semibold text-marine-blue">${headerInfo.itemCount} ${headerInfo.itemCount === 1 ? 'Item' : 'Items'}</span>
										<span class="text-xs italic font-medium text-marine-blue-light">${headerInfo.description}</span>
									` : ''}
									${!headerInfo && (data?.cotype || data?.type) ? `
										<span class="badge badge-type badge-${String(data.cotype || data.type || 'comap').replace(/-/g, '')} text-[10px] px-2 py-1 font-bold uppercase tracking-widest rounded-lg border border-white/50 shadow-sm">${(data.cotype || data.type) === 'colist' ? 'COLIST' : (data.cotype || data.type) === 'costream' ? 'COSTREAM' : String(data.cotype || data.type || 'COMAP').toUpperCase()}</span>
									` : ''}
								</div>
							</div>
							<div class="inspector-content">
								${tableContent}
							</div>
						</div>
					</div>
				</main>
				
				${metadataSidebar}
			</div>
			
			<!-- Bottom navbar area for mobile -->
			<div class="bottom-navbar">
				<div class="bottom-navbar-left">
					<button class="sidebar-toggle-btn sidebar-toggle-left" onclick="window.toggleDBLeftSidebar()" aria-label="Toggle navigation sidebar">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<line x1="3" y1="12" x2="21" y2="12"></line>
							<line x1="3" y1="6" x2="21" y2="6"></line>
							<line x1="3" y1="18" x2="21" y2="18"></line>
						</svg>
					</button>
					${currentContextCoValueId ? `
						<button class="back-btn bottom-back-btn" onclick="goBack()" title="Back in navigation">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M19 12H5M12 19l-7-7 7-7"/>
							</svg>
							<span class="back-label">Back</span>
						</button>
					` : ''}
				</div>
				<div class="bottom-navbar-center">
					<button class="home-btn bottom-home-btn" onclick="window.navigateToScreen('dashboard')" title="Home">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
							<polyline points="9 22 9 12 15 12 15 22"></polyline>
						</svg>
						<span class="home-label">Home</span>
					</button>
				</div>
				<div class="bottom-navbar-right">
					<button class="sidebar-toggle-btn sidebar-toggle-right" onclick="window.toggleDBRightSidebar()" aria-label="Toggle detail sidebar">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="10"></circle>
							<path d="M12 16v-4M12 8h.01"/>
						</svg>
					</button>
				</div>
			</div>
		</div>
	`;
	
	// Add sidebar toggle handlers for DB viewer
	setTimeout(() => {
		// Ensure sidebars are initialized with collapsed class by default
		// Don't add sidebar-ready class initially to prevent ghost animations
		const leftSidebar = document.querySelector('.db-sidebar');
		const rightSidebar = document.querySelector('.db-metadata');
		
		if (leftSidebar) {
			// Start collapsed by default, no transitions
			leftSidebar.classList.add('collapsed');
		}
		if (rightSidebar) {
			// Start collapsed by default, no transitions
			rightSidebar.classList.add('collapsed');
		}
	}, 100);
}
