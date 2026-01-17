/**
 * MaiaCity Inspector - First Principles
 * 
 * Minimal frontend: Display MaiaID primitive in inspector.
 */

import { createMaiaOS } from "@MaiaOS/core";

let maia;
let currentView = 'account'; // Current schema type being viewed
let selectedCoValueId = null; // Selected CoValue for detail view

async function init() {
	try {
		console.log("🚀 Initializing MaiaOS...");
		
		maia = await createMaiaOS();
		window.maia = maia; // Expose for debugging
		
		renderApp();
		
		console.log("✅ MaiaOS initialized!");
	} catch (error) {
		console.error("Failed to initialize:", error);
		document.getElementById("app").innerHTML = `
			<div style="padding: 2rem;">
				<h1>Error</h1>
				<pre>${error.message}\n\n${error.stack}</pre>
			</div>
		`;
	}
}

function switchView(view) {
	currentView = view;
	selectedCoValueId = null; // Reset selection when switching views
	renderApp();
}

function selectCoValue(coId) {
	selectedCoValueId = coId;
	renderApp();
}

// Expose globally for onclick handlers
window.switchView = switchView;
window.selectCoValue = selectCoValue;

function truncate(str, maxLen = 40) {
	if (typeof str !== 'string') return str;
	if (str.length <= maxLen) return str;
	return str.substring(0, maxLen) + '...';
}

function renderApp() {
	// Get data based on current view
	let data, viewTitle, viewSubtitle;
	
	if (currentView === 'account') {
		data = maia.inspector();
		viewTitle = 'Account';
		viewSubtitle = 'Raw cojson Account primitive';
	} else if (currentView === 'all') {
		data = maia.getAllCoValues();
		viewTitle = 'All CoValues';
		viewSubtitle = `${data.length} CoValue(s) in system`;
	}
	
	// Schema types available
	const schemaTypes = [
		{ id: 'account', label: 'Account', count: 1 },
		{ id: 'all', label: 'All CoValues', count: data && currentView === 'all' ? data.length : '...' }
	];

	// Build table content based on view
	let tableContent = '';
	
	if (currentView === 'account') {
		// Account view - show properties
		const maiaIdData = data;
		const propertyRows = Object.entries(maiaIdData)
			.filter(([key]) => key !== 'id')
			.map(([key, value]) => {
			if (value && typeof value === 'object' && value._co_id) {
				// Resolved co-id reference
				const coId = value._co_id;
				const truncatedId = truncate(coId, 30);
				const resolvedContent = JSON.stringify(value._resolved, null, 2);
				
				return `
					<tr>
						<td class="prop-name">${truncate(key, 20)}</td>
						<td class="prop-type">co-id</td>
						<td class="prop-value">
							<code class="co-id" title="${coId}">${truncatedId}</code>
							<details style="margin-top: 4px;">
								<summary>View Content</summary>
								<pre>${resolvedContent}</pre>
							</details>
						</td>
					</tr>
				`;
			} else if (typeof value === 'string' && value.startsWith('co_')) {
				// Unresolved co-id
				const truncatedId = truncate(value, 30);
				return `
					<tr>
						<td class="prop-name">${truncate(key, 20)}</td>
						<td class="prop-type">co-id</td>
						<td class="prop-value">
							<code class="co-id" title="${value}">${truncatedId}</code>
							<em style="color: #888; font-size: 12px;">(not loaded)</em>
						</td>
					</tr>
				`;
			} else if (typeof value === 'string' && value.startsWith('key_')) {
				// Key value
				const truncatedKey = truncate(value, 30);
				return `
					<tr>
						<td class="prop-name">${truncate(key, 20)}</td>
						<td class="prop-type">key</td>
						<td class="prop-value"><code class="key-value" title="${value}">${truncatedKey}</code></td>
					</tr>
				`;
			} else if (typeof value === 'string' && value.startsWith('sealed_')) {
				// Sealed value
				return `
					<tr>
						<td class="prop-name" title="${key}">${truncate(key, 20)}</td>
						<td class="prop-type">sealed</td>
						<td class="prop-value"><code class="sealed-value">sealed_***</code></td>
					</tr>
				`;
			} else if (typeof value === 'string' && (key.includes('sealer_') || key.includes('signer_'))) {
				// Permission role
				return `
					<tr>
						<td class="prop-name" title="${key}">${truncate(key, 20)}</td>
						<td class="prop-type">role</td>
						<td class="prop-value"><span class="role-badge">${value}</span></td>
					</tr>
				`;
			} else {
				// Regular value
				const truncatedValue = truncate(String(value), 30);
				return `
					<tr>
						<td class="prop-name">${truncate(key, 20)}</td>
						<td class="prop-type">${typeof value}</td>
						<td class="prop-value"><code title="${value}">${truncatedValue}</code></td>
					</tr>
				`;
			}
		})
		.join('');
		
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
		// AllCoValues view - show all CoValues
		const coValueRows = data.map(cv => `
			<tr class="clickable-row ${selectedCoValueId === cv.id ? 'selected' : ''}" onclick="selectCoValue('${cv.id}')">
				<td class="prop-value"><code class="co-id" title="${cv.id}">${truncate(cv.id, 25)}</code></td>
				<td class="prop-type">${cv.type}</td>
				<td class="prop-value">${cv.schema || '—'}</td>
				<td class="prop-value">${cv.keys !== undefined ? cv.keys : 'N/A'}</td>
				<td class="prop-value">${typeof cv.headerMeta === 'object' ? JSON.stringify(cv.headerMeta) : cv.headerMeta || '—'}</td>
				<td class="prop-value">${cv.createdAt || '—'}</td>
			</tr>
		`).join('');
		
		tableContent = `
			<table class="db-table">
				<thead>
					<tr>
						<th>CoValue ID</th>
						<th>Type</th>
						<th>Schema</th>
						<th>Keys</th>
						<th>Meta</th>
						<th>Created</th>
					</tr>
				</thead>
				<tbody>
					${coValueRows}
				</tbody>
			</table>
		`;
	}
	
	// Build sidebar schema types (no emoji icons)
	const sidebarItems = schemaTypes.map(schema => `
		<div class="sidebar-item ${currentView === schema.id ? 'active' : ''}" onclick="switchView('${schema.id}')">
			<div class="sidebar-label">
				<div class="sidebar-name">${schema.label}</div>
				<div class="sidebar-count">${schema.count}</div>
			</div>
		</div>
	`).join('');

	// Get account ID for header status
	const accountId = currentView === 'account' ? data.id : maia.id.maiaId.id;
	
	// Get detail view if a CoValue is selected
	let detailView = '';
	if (selectedCoValueId) {
		const detailData = maia.getCoValueDetail(selectedCoValueId);
		
		if (detailData.error) {
			detailView = `
				<aside class="db-detail">
					<div class="detail-header">
						<h3>Detail View</h3>
						<button class="close-btn" onclick="selectCoValue(null)">×</button>
					</div>
					<div class="detail-error">
						<p>Error loading CoValue: ${detailData.error}</p>
					</div>
				</aside>
			`;
		} else {
			const propertyRows = detailData.properties.map(prop => `
				<tr>
					<td class="prop-name" title="${prop.key}">${truncate(prop.key, 25)}</td>
					<td class="prop-type">${prop.type}</td>
					<td class="prop-value" title="${prop.value}">
						${prop.type === 'sealed' ? '<code class="sealed-value">sealed_***</code>' : 
						  prop.type === 'co-id' ? `<code class="co-id">${truncate(prop.value, 25)}</code>` :
						  prop.type === 'key' ? `<code class="key-value">${truncate(prop.value, 25)}</code>` :
						  `<code>${truncate(String(prop.value), 30)}</code>`}
					</td>
				</tr>
			`).join('');
			
			detailView = `
				<aside class="db-detail">
					<div class="detail-header">
						<code class="co-id-header" title="${detailData.id}">${detailData.id}</code>
						<button class="close-btn" onclick="selectCoValue(null)">×</button>
					</div>
					<div class="detail-content">
						<div class="detail-meta-compact">
							<span class="meta-compact-item">
								<strong>Type:</strong> <span class="prop-type">${detailData.type}</span>
							</span>
							<span class="meta-compact-item">
								<strong>Created:</strong> ${detailData.createdAt || 'N/A'}
							</span>
							${detailData.headerMeta ? `
								<span class="meta-compact-item">
									<strong>Meta:</strong> <code>${truncate(JSON.stringify(detailData.headerMeta), 40)}</code>
								</span>
							` : ''}
						</div>
						<div class="detail-properties">
							<h4>Properties (${detailData.properties.length})</h4>
							<table class="detail-table">
								<thead>
									<tr>
										<th>Key</th>
										<th>Type</th>
										<th>Value</th>
									</tr>
								</thead>
								<tbody>
									${propertyRows}
								</tbody>
							</table>
						</div>
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
										<pre>${JSON.stringify(detailData.specialContent.items, null, 2)}</pre>
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
				</aside>
			`;
		}
	}
	
	document.getElementById("app").innerHTML = `
		<div class="db-container">
			<header class="db-header">
				<h1>Maia DB</h1>
				<code class="db-status">Connected • ${accountId}</code>
			</header>
			
			<div class="db-layout ${selectedCoValueId ? 'with-detail' : ''}">
				<aside class="db-sidebar">
					<div class="sidebar-header">
						<h3>Schema Types</h3>
					</div>
					<div class="sidebar-content">
						${sidebarItems}
					</div>
				</aside>
				
				<main class="db-main">
					<div class="inspector">
						<div class="inspector-header">
							<div>
								<h2>${viewTitle}</h2>
								<p class="inspector-subtitle">${viewSubtitle}</p>
							</div>
							${currentView === 'account' ? `<code class="account-id">${data.id}</code>` : ''}
						</div>
						${tableContent}
					</div>
				</main>
				
				${detailView}
			</div>
		</div>
	`;
}

init();
