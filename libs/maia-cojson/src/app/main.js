/**
 * MaiaCojson - Simple Blog Demo
 * 
 * A clean, minimal blog built with CRDTs
 */

import { MaiaCRUD } from "../index.js";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";

// Schemas
const POST_SCHEMA = {
  type: "co-map",
  properties: {
    title: { type: "string" },
    content: { type: "string" },
    author: { type: "co-id" },
    likes: { type: "number" },
  },
  required: ["title", "content", "author"],
};

// Global state
let o = null;
let allPosts = [];

// Initialize MaiaCRUD
async function initializeMaiaCRUD() {
  if (o) return o;
  
  const crypto = await WasmCrypto.create();
  
  // Create new account each session (ephemeral for now)
  const result = await LocalNode.withNewlyCreatedAccount({
    creationProps: { name: "Blog Author" },
    peers: [],
    crypto,
  });
  
  const { node, accountID } = result;
  const group = node.createGroup();
  
  o = new MaiaCRUD({ node, accountID, group });
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
  const api = await initializeMaiaCRUD();
  
  const post1 = await api.create({
    type: "co-map",
    schema: POST_SCHEMA,
    data: {
      title: "Welcome to MaiaCojson",
      content: "A simple, clean blog built with JSON Schema and CRDTs. Everything is collaborative by default.",
      author: api.accountID,
      likes: 12,
    },
  });
  
  const post2 = await api.create({
    type: "co-map",
    schema: POST_SCHEMA,
    data: {
      title: "JSON-based CRUD API",
      content: "Create, read, update, and delete - all with simple JSON operations. No complex APIs to learn.",
      author: api.accountID,
      likes: 8,
    },
  });
  
  allPosts = [post1, post2];
  return allPosts;
}

// Create random post
async function createRandomPost() {
  const api = await initializeMaiaCRUD();
  
  const randomTitle = sampleTitles[Math.floor(Math.random() * sampleTitles.length)];
  const randomContent = sampleContent[Math.floor(Math.random() * sampleContent.length)];
  const randomLikes = Math.floor(Math.random() * 50);
  
  const newPost = await api.create({
    type: "co-map",
    schema: POST_SCHEMA,
    data: {
      title: randomTitle,
      content: randomContent,
      author: api.accountID,
      likes: randomLikes,
    },
  });
  
  allPosts.unshift(newPost);
  renderBlog();
  return newPost;
}

// Like a post (increment likes)
async function likePost(postIndex) {
  const post = allPosts[postIndex];
  const newLikes = (post.likes || 0) + 1;
  
  // Update directly through wrapper (which updates CRDT)
  post.likes = newLikes;
  
  console.log(`✅ Liked post: ${post.title} (${newLikes} likes)`);
  renderBlog();
}

// Enable inline title editing
function enableTitleEdit(postIndex) {
  const post = allPosts[postIndex];
  const titleElement = document.querySelector(`[data-index="${postIndex}"] .post-title`);
  
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
  const saveTitle = () => {
    const newTitle = titleElement.textContent.trim();
    titleElement.contentEditable = false;
    
    if (newTitle && newTitle !== originalTitle) {
      post.title = newTitle;
      console.log(`✅ Updated title: "${originalTitle}" → "${newTitle}"`);
      renderBlog();
    } else {
      titleElement.textContent = originalTitle;
    }
  };
  
  titleElement.addEventListener('blur', saveTitle, { once: true });
  titleElement.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      titleElement.blur();
    } else if (e.key === 'Escape') {
      titleElement.textContent = originalTitle;
      titleElement.blur();
    }
  }, { once: true });
}

// Delete a post
async function deletePost(postIndex) {
  const post = allPosts[postIndex];
  
  if (confirm(`Delete "${post.title}"?`)) {
    // Just remove from local array (CRDT cleanup would happen with proper sync)
    allPosts.splice(postIndex, 1);
    console.log(`🗑️  Deleted post: ${post.title}`);
    renderBlog();
  }
}

// SVG Icons
const icons = {
  heart: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  heartFilled: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
  plus: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  document: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  edit: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
};

// Render blog
function renderBlog() {
  const app = document.getElementById("app");
  const totalLikes = allPosts.reduce((sum, post) => sum + (post.likes || 0), 0);
  
  app.innerHTML = `
    <div class="container">
      <header class="header">
        <h1>Simple Blog</h1>
        <p class="subtitle">Built with MaiaCojson</p>
      </header>
      
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
        ${allPosts.map((post, index) => `
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
        `).join("")}
      </div>
    </div>
  `;
  
  // Attach event listener
  document.getElementById("create-post-btn").addEventListener("click", async () => {
    const btn = document.getElementById("create-post-btn");
    btn.disabled = true;
    btn.textContent = "Creating...";
    
    await createRandomPost();
    
    btn.disabled = false;
    btn.innerHTML = `${icons.plus}<span>Create Random Post</span>`;
  });
}

// Initialize app
async function init() {
  try {
    await createInitialPosts();
    renderBlog();
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

init();
