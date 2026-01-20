/**
 * Maia DB View - Logged-in interface
 * Liquid glass design with widget-based layout
 */

import { truncate } from './utils.js'

export async function renderApp(maia, cojsonAPI, authState, syncState, currentView, selectedCoValueId, switchView, selectCoValue) {
	// Get data based on current view
	let data, viewTitle, viewSubtitle;
	
	if (currentView === 'account') {
		// Query account using cojson API (schema: @self)
		if (cojsonAPI && maia?.id?.maiaId) {
			try {
				const result = await cojsonAPI.cojson({op: 'query', schema: '@self'});
				// Convert array result to object format expected by UI
				if (Array.isArray(result) && result.length > 0) {
					data = result[0]; // Account is first (and only) result
				} else {
					data = result;
				}
			} catch (err) {
				console.error('Error querying account:', err);
				data = { error: err.message };
			}
		} else {
			data = { error: 'Not initialized' };
		}
		viewTitle = 'Account';
		viewSubtitle = 'Raw cojson Account primitive';
	} else if (currentView === 'all') {
		// Query all CoValues using cojson API
		if (cojsonAPI) {
			try {
				const result = await cojsonAPI.cojson({op: 'query'});
				data = Array.isArray(result) ? result : [];
			} catch (err) {
				console.error('Error querying all CoValues:', err);
				data = [];
			}
		} else {
			data = [];
		}
		viewTitle = 'All CoValues';
		viewSubtitle = `${Array.isArray(data) ? data.length : 0} CoValue(s) in system`;
	}
	
	// Schema types available
	const schemaTypes = [
		{ id: 'account', label: 'Account', count: 1 },
		{ id: 'all', label: 'All CoValues', count: data && currentView === 'all' ? data.length : '...' }
	];

	// Build table content based on view
	let tableContent = '';
	
	if (currentView === 'account') {
		// Account view - show properties from cojson query result
		// Data structure: {id, type, schema, properties: [{key, value, type}], ...}
		let propertyRows = '';
		
		if (data.error) {
			propertyRows = `<tr><td colspan="3">Error: ${data.error}</td></tr>`;
		} else if (data.properties && Array.isArray(data.properties)) {
			// Use properties from cojson query result
			propertyRows = data.properties.map(prop => {
				const value = prop.value;
				const propType = prop.type;
				const key = prop.key;
				
				if (propType === 'co-id') {
					const truncatedId = truncate(value, 12);
					return `
						<tr class="clickable-row ${selectedCoValueId === value ? 'selected' : ''}" onclick="selectCoValue('${value}')">
							<td class="prop-name">${truncate(key, 20)}</td>
							<td class="prop-type">co-id</td>
							<td class="prop-value">
								<code class="co-id" title="${value}">${truncatedId}</code>
							</td>
						</tr>
					`;
				} else if (propType === 'key') {
					const truncatedKey = truncate(value, 30);
					return `
						<tr>
							<td class="prop-name">${truncate(key, 20)}</td>
							<td class="prop-type">key</td>
							<td class="prop-value"><code class="key-value" title="${value}">${truncatedKey}</code></td>
						</tr>
					`;
				} else if (propType === 'sealed') {
					return `
						<tr>
							<td class="prop-name" title="${key}">${truncate(key, 20)}</td>
							<td class="prop-type">sealed</td>
							<td class="prop-value"><code class="sealed-value">sealed_***</code></td>
						</tr>
					`;
				} else {
					const truncatedValue = truncate(String(value), 30);
					return `
						<tr>
							<td class="prop-name">${truncate(key, 20)}</td>
							<td class="prop-type">${propType}</td>
							<td class="prop-value"><code title="${value}">${truncatedValue}</code></td>
						</tr>
					`;
				}
			}).join('');
		} else {
			// Fallback: empty or no properties
			propertyRows = '<tr><td colspan="3">No properties available</td></tr>';
		}
		
		tableContent = `
				<table class="db-table">
					<thead>
						<tr>
							<th>Property</th>
							<th>Type</th>
							<th>Value</th>
						</tr>
					</thead>
				<tbody>
					${propertyRows}
				</tbody>
			</table>
		`;
	} else if (currentView === 'all') {
		// AllCoValues view - show all CoValues from cojson query
		const coValueRows = Array.isArray(data) ? data.map(cv => `
			<tr class="clickable-row ${selectedCoValueId === cv.id ? 'selected' : ''}" onclick="selectCoValue('${cv.id}')">
				<td class="prop-type">${cv.type || 'unknown'}</td>
				<td class="prop-value"><code class="co-id" title="${cv.id}">${truncate(cv.id, 12)}</code></td>
				<td class="prop-value">${cv.schema || '—'}</td>
			</tr>
		`).join('') : '<tr><td colspan="3">No CoValues found</td></tr>';
		
		tableContent = `
			<table class="db-table">
				<thead>
					<tr>
						<th>Type</th>
						<th>CoValue ID</th>
						<th>Schema</th>
					</tr>
				</thead>
				<tbody>
					${coValueRows}
				</tbody>
			</table>
		`;
	}
	
	// Build sidebar schema types
	const sidebarItems = schemaTypes.map(schema => `
		<div class="sidebar-item ${currentView === schema.id ? 'active' : ''}" onclick="switchView('${schema.id}')">
			<div class="sidebar-label">
				<span class="sidebar-name">${schema.label}</span>
				<span class="sidebar-count">${schema.count}</span>
			</div>
		</div>
	`).join('');

	// Get account ID for header status
	const accountId = currentView === 'account' && data?.id ? data.id : (maia?.id?.maiaId?.id || '');
	
	// Get detail view if a CoValue is selected
	let detailView = '';
	if (selectedCoValueId && cojsonAPI) {
		let detailData;
		try {
			detailData = await cojsonAPI.cojson({op: 'query', id: selectedCoValueId});
		} catch (err) {
			console.error('Error querying CoValue detail:', err);
			detailData = { error: err.message, id: selectedCoValueId };
		}
		
		// Handle loading state
		if (detailData.loading) {
			detailView = `
				<aside class="db-detail db-card whitish-card">
					<div class="detail-content-inner">
						<div class="detail-header">
							<h3>Detail View</h3>
							<button class="close-btn" onclick="selectCoValue(null)">×</button>
						</div>
						<div class="detail-loading">
							<div class="loading-spinner"></div>
							<p>Loading CoValue... (waiting for verified state)</p>
							<p class="loading-hint">This happens when accessing newly created CoValues</p>
						</div>
					</div>
				</aside>
			`;
		} else if (detailData.error && !detailData.loading) {
			detailView = `
				<aside class="db-detail db-card whitish-card">
					<div class="detail-content-inner">
						<div class="detail-header">
							<h3>Detail View</h3>
							<button class="close-btn" onclick="selectCoValue(null)">×</button>
						</div>
						<div class="detail-error">
							<p>Error loading CoValue: ${detailData.error}</p>
						</div>
					</div>
				</aside>
			`;
		} else {
			detailView = `
				<aside class="db-detail db-card whitish-card">
					<div class="detail-content-inner">
						<div class="detail-header">
							<div class="header-top">
								<code class="co-id-header" title="${detailData.id}">${detailData.id}</code>
								<button class="close-detail" onclick="selectCoValue(null)">×</button>
							</div>
						</div>
						<div class="detail-content">
							<div class="detail-meta-compact">
								<span class="meta-compact-item">
									<strong>Type:</strong> <span class="property-type">${detailData.type}</span>
								</span>
								<span class="meta-compact-item">
									<strong>Created:</strong> ${detailData.createdAt || 'N/A'}
								</span>
								${detailData.schema ? `
									<span class="meta-compact-item">
										<strong>Schema:</strong> ${detailData.schema}
									</span>
								` : ''}
							</div>
							
							${detailData.schema ? `
								<div class="detail-header-meta">
									<h4>Schema</h4>
									<div class="header-meta-content">
										<div class="header-meta-item">
											<span class="header-meta-key">$schema:</span>
											<span class="header-meta-value">
												<code>${detailData.schema}</code>
											</span>
										</div>
									</div>
								</div>
							` : ''}
							
							${detailData.properties && Array.isArray(detailData.properties) && detailData.properties.length > 0 ? `
							<div class="detail-properties">
								<h4>Properties (${detailData.properties.length})</h4>
								<div class="property-list">
									${detailData.properties.map(prop => `
										<div class="property-item">
											<div class="property-header">
												<span class="property-type">${prop.type}</span>
												<span class="property-key" title="${prop.key}">${truncate(prop.key, 30)}</span>
											</div>
											<div class="property-value-box">
												${prop.type === 'sealed' ? '<code>sealed_***</code>' : 
												  prop.type === 'co-id' ? `<code class="co-id">${truncate(prop.value, 12)}</code>` :
												  prop.type === 'key' ? `<code class="key-value">${prop.value}</code>` :
												  `<code>${prop.value}</code>`}
											</div>
										</div>
									`).join('')}
								</div>
							</div>
							` : ''}
							${detailData.specialContent ? `
								<div class="detail-special-content">
									${detailData.specialContent.type === 'plaintext' ? `
										<h4>Text Content (${detailData.specialContent.length} characters)</h4>
										<div class="plaintext-content">
											<pre>${detailData.specialContent.text}</pre>
										</div>
									` : detailData.specialContent.type === 'stream' ? `
										<h4>Stream Items (${detailData.specialContent.itemCount} total)</h4>
										<div class="stream-content">
											<pre>${JSON.stringify(detailData.specialContent.items, null, 2)}</pre>
										</div>
									` : detailData.specialContent.type === 'list' ? `
										<h4>List Items (${detailData.specialContent.itemCount} total)</h4>
										<div class="list-content">
											${detailData.specialContent.items.length === 0 ? `
												<div class="empty-list">
													<p>No items in this list</p>
												</div>
											` : `
												<div class="list-items">
													${detailData.specialContent.items.map((item, index) => {
														const renderValue = (value, depth = 0) => {
															if (depth > 2) return '<span class="nested-depth">...</span>';
															if (value === null) return '<span class="null-value">null</span>';
															if (value === undefined) return '<span class="undefined-value">undefined</span>';
															if (typeof value === 'string' && value.startsWith('co_')) {
																return `<code class="co-id" title="${value}">${truncate(value, 12)}</code>`;
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
																return `<span class="string-value" title="${value}">"${truncated}"</span>`;
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
															return `<span>${String(value)}</span>`;
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
											`}
										</div>
									` : detailData.specialContent.type === 'binary' ? `
										<h4>Binary Content</h4>
										<div class="binary-content">
											<p>${detailData.specialContent.preview}</p>
										</div>
									` : ''}
								</div>
							` : ''}
						</div>
					</div>
				</aside>
			`;
		}
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
							<button class="sign-out-btn" onclick="window.handleSignOut()">
								Sign Out
							</button>
						` : ''}
					</div>
				</div>
			</header>
			
			<div class="db-layout ${selectedCoValueId ? 'with-detail' : ''}">
				<aside class="db-sidebar db-card whitish-card">
					<div class="sidebar-content-inner">
						<div class="sidebar-header">
							<h3>Schema Types</h3>
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
								<div>
									<h2>${viewTitle}</h2>
									<p class="inspector-subtitle">${viewSubtitle}</p>
								</div>
								${currentView === 'account' ? `<code class="account-id">${data.id}</code>` : ''}
							</div>
							${tableContent}
						</div>
					</div>
				</main>
				
				${detailView}
			</div>
		</div>
	`;
}
