/**
 * MaiaOS Blog Demo (Operations-Based)
 * 
 * Demonstrates the new o.db({ op }) API
 * ALL operations go through the operations engine
 */

// Import everything from o.js (includes cojson re-exports)
import { createMaiaOS, LocalNode, WasmCrypto } from "../../o/o.js";

// Global state
let o = null; // MaiaOS context
let allPosts = [];
let currentView = "blog"; // Current view: 'blog', 'schemas', or 'inspector'
let schemaIds = {}; // Store registered schema co-ids

// Initialize MaiaOS
async function initializeMaiaOS() {
	if (o) return o;

	console.log("🚀 Initializing MaiaOS...");

	const crypto = await WasmCrypto.create();

	// Create new account each session (ephemeral for demo)
	const result = await LocalNode.withNewlyCreatedAccount({
		creationProps: { name: "Blog Author" },
		peers: [],
		crypto,
	});

	const { node, accountID } = result;
	const group = node.createGroup();

	// Create MaiaOS context
	o = await createMaiaOS({ node, accountID, group });

	console.log("✅ MaiaOS initialized!");
	console.log("Account ID:", accountID);

	// Register schemas in dependency order

	// 1. Register Author schema FIRST (no dependencies)
	const authorResult = await o.db({
		op: "registerSchema",
		name: "Author",
		definition: {
			type: "co-map",
			properties: {
				name: { type: "string" },
			},
		},
	});
	schemaIds.author = authorResult.schemaId;

	// 2. Register Post schema with $ref to Author
	const postResult = await o.db({
		op: "registerSchema",
		name: "Post",
		definition: {
			type: "co-map",
			properties: {
				title: { type: "string" },
				content: { type: "string" },
				author: {
					$ref: `https://maia.city/${schemaIds.author}`,
				},
				likes: { type: "number" },
			},
			required: ["title", "content", "author"],
		},
	});
	schemaIds.post = postResult.schemaId;

	console.log("📋 Schemas registered:", schemaIds);

	return o;
}

// Sample post content
const sampleTitles = [
	"Building with CRDTs",
	"Collaborative Data Structures",
	"JSON Schema Validation",
	"Reactive State Management",
	"Distributed Systems Made Simple",
	"Real-time Collaboration",
	"Modern Web Architecture",
	"Offline-First Applications",
];

const sampleContent = [
	"Exploring the power of conflict-free replicated data types in modern web applications.",
	"How CRDTs enable seamless real-time collaboration without complex conflict resolution.",
	"JSON Schema provides a clean, declarative way to validate and structure your data.",
	"Reactive programming patterns make state management intuitive and predictable.",
	"Building distributed systems doesn't have to be complicated with the right abstractions.",
	"Enable real-time collaboration with automatic data synchronization across devices.",
	"Modern architecture patterns for building scalable, maintainable applications.",
	"Building applications that work seamlessly offline and sync when connected.",
];

// Create initial posts
async function createInitialPosts() {
	await initializeMaiaOS();

	console.log("Creating initial posts...");

	// Create post 1 (operations-only!)
	const result1 = await o.db({
		op: "create",
		schema: schemaIds.post,
		data: {
			title: "Welcome to MaiaOS",
			content:
				"A simple, clean blog built with operations-based API. Complete schema validation!",
			author: o._kernel.accountID,
			likes: 12,
		},
	});

	// Create post 2
	const result2 = await o.db({
		op: "create",
		schema: schemaIds.post,
		data: {
			title: "Pure Operations API",
			content:
				"All interactions through o.db({ op }). Schemas stored as CoMaps!",
			author: o._kernel.accountID,
			likes: 8,
		},
	});

	allPosts = [result1.coValue, result2.coValue];
	return allPosts;
}

// Create random post
async function createRandomPost() {
	const randomTitle =
		sampleTitles[Math.floor(Math.random() * sampleTitles.length)];
	const randomContent =
		sampleContent[Math.floor(Math.random() * sampleContent.length)];
	const randomLikes = Math.floor(Math.random() * 50);

	const result = await o.db({
		op: "create",
		schema: schemaIds.post,
		data: {
			title: randomTitle,
			content: randomContent,
			author: o._kernel.accountID,
			likes: randomLikes,
		},
	});

	allPosts.unshift(result.coValue);
	renderBlog();
	return result.coValue;
}

// Like a post (increment likes via operation)
async function likePost(postIndex) {
	const post = allPosts[postIndex];
	const postId = post.$id;

	// Update via operation (operations-only!)
	await o.db({
		op: "update",
		target: { id: postId },
		changes: {
			likes: { op: "increment", by: 1 },
		},
	});

	// Reload post to get updated value
	const updated = await o.db({
		op: "read",
		target: { id: postId },
	});

	allPosts[postIndex] = updated;

	console.log(`✅ Liked post: ${updated.title} (${updated.likes} likes)`);
	renderBlog();
}

// Enable inline title editing
function enableTitleEdit(postIndex) {
	const post = allPosts[postIndex];
	const titleElement = document.querySelector(
		`[data-index="${postIndex}"] .post-title`,
	);

	if (!titleElement) return;

	const originalTitle = post.title;
	titleElement.contentEditable = true;
	titleElement.focus();

	// Select all text
	const range = document.createRange();
	range.selectNodeContents(titleElement);
	const sel = window.getSelection();
	sel.removeAllRanges();
	sel.addRange(range);

	// Save on blur or Enter key
	const saveTitle = async () => {
		const newTitle = titleElement.textContent.trim();
		titleElement.contentEditable = false;

		if (newTitle && newTitle !== originalTitle) {
			// Update via operation (operations-only!)
			await o.db({
				op: "update",
				target: { id: post.$id },
				changes: {
					title: newTitle,
				},
			});

			// Reload post
			const updated = await o.db({
				op: "read",
				target: { id: post.$id },
			});

			allPosts[postIndex] = updated;

			console.log(`✅ Updated title: "${originalTitle}" → "${newTitle}"`);
			renderBlog();
		} else {
			titleElement.textContent = originalTitle;
		}
	};

	titleElement.addEventListener("blur", saveTitle, { once: true });
	titleElement.addEventListener(
		"keydown",
		(e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				titleElement.blur();
			} else if (e.key === "Escape") {
				titleElement.textContent = originalTitle;
				titleElement.blur();
			}
		},
		{ once: true },
	);
}

// Delete a post
async function deletePost(postIndex) {
	const post = allPosts[postIndex];

	// Delete via operation (operations-only!)
	await o.db({
		op: "delete",
		target: { id: post.$id },
	});

	allPosts.splice(postIndex, 1);
	console.log(`🗑️  Deleted post: ${post.title}`);
	renderBlog();
}

// SVG Icons
const icons = {
	heart: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
	heartFilled: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
	plus: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
	document: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
	edit: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
	trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
	schema: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
	inspector: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
	chevron: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`,
};

// Switch view
function switchView(view) {
	currentView = view;
	renderBlog();
}

// Toggle schema expansion
async function toggleSchema(schemaIdx, definition) {
	const defEl = document.getElementById(`schema-def-${schemaIdx}`);
	const card = document.querySelector(`[data-schema-idx="${schemaIdx}"]`);

	if (defEl.classList.contains("expanded")) {
		// Collapse
		defEl.classList.remove("expanded");
		card.classList.remove("expanded");
	} else {
		// Expand and display schema
		defEl.classList.add("expanded");
		card.classList.add("expanded");

		// Display schema definition (already passed as parameter)
		try {
			defEl.innerHTML = `<pre><code>${JSON.stringify(definition, null, 2)}</code></pre>`;
		} catch (error) {
			defEl.innerHTML = `<div class="error">Failed to display schema: ${error.message}</div>`;
		}
	}
}

// Refresh inspector view
async function refreshInspector() {
	renderBlog();
}

// Render blog
async function renderBlog() {
	const app = document.getElementById("app");
	const totalLikes = allPosts.reduce((sum, post) => sum + (post.likes || 0), 0);

	// Get schemas list via operation
	let schemasList = [];
	if (o) {
		try {
			const result = await o.db({ op: "listSchemas" });
			schemasList = result.schemas;
		} catch (error) {
			console.error("Failed to load schemas:", error);
		}
	}

	// Get inspector data via operation
	let inspectorData = null;
	if (o && currentView === "inspector") {
		try {
			inspectorData = await o.db({ op: "allLoaded" });
		} catch (error) {
			console.error("Failed to load inspector data:", error);
		}
	}

	app.innerHTML = `
    <div class="container">
      <header class="header">
        <h1>MaiaOS Blog</h1>
        <p class="subtitle">Operations-Based Demo: o.db({ op })</p>
      </header>
      
      <div class="tabs">
        <button class="tab ${currentView === "blog" ? "active" : ""}" onclick="window.switchView('blog')">
          ${icons.document} Blog
        </button>
        <button class="tab ${currentView === "schemas" ? "active" : ""}" onclick="window.switchView('schemas')">
          ${icons.schema} Schemas
        </button>
        <button class="tab ${currentView === "inspector" ? "active" : ""}" onclick="window.switchView('inspector')">
          ${icons.inspector} Inspector
        </button>
      </div>

      
      <div class="view-content">
        ${currentView === "blog" ? renderBlogView(totalLikes) : ""}
        ${currentView === "schemas" ? renderSchemasView(schemasList) : ""}
        ${currentView === "inspector" ? renderInspectorView(inspectorData) : ""}
      </div>
    </div>
  `;

	// Attach event listeners if blog view
	if (currentView === "blog") {
		const createBtn = document.getElementById("create-post-btn");
		if (createBtn) {
			createBtn.addEventListener("click", async () => {
				createBtn.disabled = true;
				createBtn.textContent = "Creating...";

				await createRandomPost();

				createBtn.disabled = false;
				createBtn.innerHTML = `${icons.plus}<span>Create Random Post</span>`;
			});
		}
	}

	// Attach refresh button for inspector
	if (currentView === "inspector") {
		const refreshBtn = document.getElementById("refresh-inspector-btn");
		if (refreshBtn) {
			refreshBtn.addEventListener("click", async () => {
				await refreshInspector();
			});
		}
	}
}

// Render blog view
function renderBlogView(totalLikes) {
	return `
    <div class="toolbar">
      <button id="create-post-btn" class="btn-create">
        ${icons.plus}
        <span>Create Random Post</span>
      </button>
      <div class="stats-mini">
        <span class="stat-mini">
          ${icons.document}
          <strong>${allPosts.length}</strong> posts
        </span>
        <span class="stat-mini">
          ${icons.heart}
          <strong>${totalLikes}</strong> likes
        </span>
      </div>
    </div>
    
    <div class="posts">
      ${allPosts
				.map(
					(post, index) => `
        <article class="post" data-index="${index}">
          <div class="post-header">
            <h2 class="post-title" onclick="window.enableTitleEdit(${index})" title="Click to edit">${post.title || "Untitled"}</h2>
            <button class="btn-icon" onclick="window.enableTitleEdit(${index})" title="Edit title">
              ${icons.edit}
            </button>
          </div>
          <p class="post-content">${post.content || ""}</p>
          <div class="post-footer">
            <button class="btn-like" onclick="window.likePost(${index})" title="Like this post">
              ${icons.heart}
              <span>${post.likes || 0}</span>
            </button>
            <button class="btn-delete" onclick="window.deletePost(${index})" title="Delete post">
              ${icons.trash}
            </button>
          </div>
        </article>
      `,
				)
				.join("")}
    </div>
  `;
}

// Render schemas view
function renderSchemasView(schemasList) {
	return `
    <div class="schemas-view">
      <h2 class="schemas-title">Data Schemas</h2>
      <p class="schemas-subtitle">Schemas stored as CoMaps in Schema.Registry (CoList)</p>
      
      <div class="schemas-list">
        ${schemasList
					.map(
						(s, idx) => `
          <div class="schema-card" data-schema-idx="${idx}" data-schema-type="data">
            <div class="schema-header" onclick="window.toggleSchema('${idx}', ${JSON.stringify(s.definition).replace(/"/g, "&quot;")})">
              <div class="schema-header-left">
                <h3 class="schema-name">${s.name}</h3>
                ${s.name === "MetaSchema" ? '<span class="badge">Self-Referencing</span>' : ""}
              </div>
              <button class="btn-expand">
                ${icons.chevron}
              </button>
            </div>
            <code class="schema-id">${s.id}</code>
            ${s.name === "MetaSchema" ? '<p class="schema-note">Self-referencing meta-schema (validates all schemas)</p>' : ""}
            <div class="schema-definition" id="schema-def-${idx}">
              <div class="loading">Click to view schema...</div>
            </div>
          </div>
        `,
					)
					.join("")}
      </div>
    </div>
  `;
}

// Render inspector view
function renderInspectorView(inspectorData) {
	if (!inspectorData) {
		return `
      <div class="inspector-view">
        <div class="loading">Loading inspector data...</div>
      </div>
    `;
	}

	return `
    <div class="inspector-view">
      <div class="inspector-header">
        <div>
          <h2>CoValue Inspector</h2>
          <p class="inspector-subtitle">Debug view of all loaded CoValues</p>
        </div>
        <button id="refresh-inspector-btn" class="btn-create">
          Refresh
        </button>
      </div>
      
      <div class="inspector-stats">
        <div class="stat-card">
          <div class="stat-value">${inspectorData.totalCount}</div>
          <div class="stat-label">CoValues</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${inspectorData.totalSize}</div>
          <div class="stat-label">Total Size</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${inspectorData.byType["comap"] || 0}</div>
          <div class="stat-label">CoMaps</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${inspectorData.byType["colist"] || 0}</div>
          <div class="stat-label">CoLists</div>
        </div>
      </div>
      
      <div class="inspector-table-container">
        <table class="inspector-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>CoValue ID</th>
              <th>Schema</th>
              <th>Properties</th>
              <th>Size</th>
              <th>Loaded At</th>
            </tr>
          </thead>
          <tbody>
            ${inspectorData.coValues
							.map(
								(cv) => `
              <tr>
                <td><span class="type-badge ${cv.type}">${cv.type}</span></td>
                <td><code class="co-id">${cv.id}</code></td>
                <td>${cv.schema ? `<span class="schema-name">${cv.schema.name}</span>` : '<span class="no-schema">—</span>'}</td>
                <td><span class="properties-list">${cv.properties.length > 0 ? cv.properties.join(", ") : "—"}</span></td>
                <td><span class="size-badge">${cv.size}</span></td>
                <td><span class="timestamp">${new Date(cv.loadedAt).toLocaleTimeString()}</span></td>
              </tr>
            `,
							)
							.join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Initialize app
async function init() {
	try {
		await createInitialPosts();
		renderBlog();
		console.log("✅ Blog initialized!");
	} catch (error) {
		console.error("Failed to initialize:", error);
		document.getElementById("app").innerHTML = `
      <div style="padding: 2rem;">
        <h1>Error</h1>
        <pre>${error.message}</pre>
      </div>
    `;
	}
}

// Expose functions for onclick handlers
window.likePost = likePost;
window.enableTitleEdit = enableTitleEdit;
window.deletePost = deletePost;
window.switchView = switchView;
window.toggleSchema = toggleSchema;
window.refreshInspector = refreshInspector;

init();
