import { describe, it, expect, beforeEach } from "bun:test";
import { deepResolve } from "./resolver.js";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { CoMap, CoList, SchemaStore } from "@maiaos/maia-cojson";

describe("Deep Resolution Engine (Real CRDTs)", () => {
	let kernel;
	let node;
	let group;

	beforeEach(async () => {
		// Initialize real cojson runtime (ZERO MOCKS!)
		const crypto = await WasmCrypto.create();
		const result = await LocalNode.withNewlyCreatedAccount({
			creationProps: { name: "Test User" },
			peers: [],
			crypto,
		});

		node = result.node;
		group = node.createGroup();

		// Create kernel context
		const schemaCoMap = group.createMap();
		const dataCoMap = group.createMap();

		const schemaStore = new SchemaStore({
			schema: schemaCoMap,
			data: dataCoMap,
			group,
			node,
		});

		await schemaStore.initializeRegistry();
		await schemaStore.bootstrapMetaSchema();

		kernel = {
			node,
			accountID: result.accountID,
			group,
			schema: schemaCoMap,
			data: dataCoMap,
			schemaStore,
		};
	});

	describe("Basic Resolution", () => {
		it("should resolve primitive values without loading", async () => {
			const map = group.createMap();
			map.set("title", "Hello World");
			map.set("count", 42);
			const coMap = CoMap.fromRaw(map, null);

			const resolved = await deepResolve(
				coMap,
				{
					title: true,
					count: true,
				},
				kernel,
			);

			expect(resolved.title).toBe("Hello World");
			expect(resolved.count).toBe(42);
		});

		it("should resolve single co-id reference", async () => {
			// Create Author
			const authorMap = group.createMap();
			authorMap.set("name", "Alice");
			authorMap.set("bio", "Developer");

			// Create Post with author reference
			const postMap = group.createMap();
			postMap.set("title", "Hello");
			postMap.set("author", authorMap.id);

			const post = CoMap.fromRaw(postMap, null);

			const resolved = await deepResolve(
				post,
				{
					title: true,
					author: true,
				},
				kernel,
			);

			expect(resolved.title).toBe("Hello");
			expect(resolved.author).toBeInstanceOf(CoMap);
			expect(resolved.author.name).toBe("Alice");
		});
	});

	describe("Nested Resolution", () => {
		it("should resolve nested fields", async () => {
			// Create Author
			const authorMap = group.createMap();
			authorMap.set("name", "Bob");
			authorMap.set("email", "bob@example.com");

			// Create Post
			const postMap = group.createMap();
			postMap.set("title", "Deep Nesting");
			postMap.set("author", authorMap.id);

			const post = CoMap.fromRaw(postMap, null);

			const resolved = await deepResolve(
				post,
				{
					title: true,
					author: {
						fields: {
							name: true,
							email: true,
						},
					},
				},
				kernel,
			);

			expect(resolved.title).toBe("Deep Nesting");
			expect(resolved.author.name).toBe("Bob");
			expect(resolved.author.email).toBe("bob@example.com");
		});

		it("should resolve multiple levels deep", async () => {
			// Create Profile
			const profileMap = group.createMap();
			profileMap.set("avatar", "https://example.com/avatar.png");

			// Create Author
			const authorMap = group.createMap();
			authorMap.set("name", "Charlie");
			authorMap.set("profile", profileMap.id);

			// Create Post
			const postMap = group.createMap();
			postMap.set("title", "Multi-Level");
			postMap.set("author", authorMap.id);

			const post = CoMap.fromRaw(postMap, null);

			const resolved = await deepResolve(
				post,
				{
					title: true,
					author: {
						fields: {
							name: true,
							profile: {
								fields: {
									avatar: true,
								},
							},
						},
					},
				},
				kernel,
			);

			expect(resolved.title).toBe("Multi-Level");
			expect(resolved.author.name).toBe("Charlie");
			expect(resolved.author.profile.avatar).toBe(
				"https://example.com/avatar.png",
			);
		});
	});

	describe("List Resolution (each)", () => {
		it("should resolve each item in a list", async () => {
			// Create authors
			const author1 = group.createMap();
			author1.set("name", "Alice");

			const author2 = group.createMap();
			author2.set("name", "Bob");

			// Create authors list
			const authorsList = group.createList();
			authorsList.append(author1.id);
			authorsList.append(author2.id);

			// Create post with authors list
			const postMap = group.createMap();
			postMap.set("title", "Collaborative Post");
			postMap.set("authors", authorsList.id);

			const post = CoMap.fromRaw(postMap, null);

			const resolved = await deepResolve(
				post,
				{
					title: true,
					authors: {
						each: {},
					},
				},
				kernel,
			);

			expect(resolved.title).toBe("Collaborative Post");
			expect(resolved.authors).toBeInstanceOf(Array);
			expect(resolved.authors.length).toBe(2);
			expect(resolved.authors[0]).toBeInstanceOf(CoMap);
			expect(resolved.authors[0].name).toBe("Alice");
			expect(resolved.authors[1].name).toBe("Bob");
		});

		it("should resolve nested fields for each item", async () => {
			// Create comments with authors
			const author1 = group.createMap();
			author1.set("name", "Alice");

			const author2 = group.createMap();
			author2.set("name", "Bob");

			const comment1 = group.createMap();
			comment1.set("text", "Great post!");
			comment1.set("author", author1.id);

			const comment2 = group.createMap();
			comment2.set("text", "Thanks!");
			comment2.set("author", author2.id);

			const commentsList = group.createList();
			commentsList.append(comment1.id);
			commentsList.append(comment2.id);

			const postMap = group.createMap();
			postMap.set("title", "Post with Comments");
			postMap.set("comments", commentsList.id);

			const post = CoMap.fromRaw(postMap, null);

			const resolved = await deepResolve(
				post,
				{
					title: true,
					comments: {
						each: {
							fields: {
								text: true,
								author: {
									fields: {
										name: true,
									},
								},
							},
						},
					},
				},
				kernel,
			);

			expect(resolved.comments.length).toBe(2);
			expect(resolved.comments[0].text).toBe("Great post!");
			expect(resolved.comments[0].author.name).toBe("Alice");
			expect(resolved.comments[1].text).toBe("Thanks!");
			expect(resolved.comments[1].author.name).toBe("Bob");
		});
	});

	describe("Error Handling", () => {
		it("should throw on missing reference by default", async () => {
			const postMap = group.createMap();
			postMap.set("title", "Post");
			postMap.set("author", "co_zNonExistent");

			const post = CoMap.fromRaw(postMap, null);

			await expect(
				deepResolve(
					post,
					{
						title: true,
						author: true,
					},
					kernel,
				),
			).rejects.toThrow(/unavailable/);
		});

		it("should skip missing reference with onError: skip", async () => {
			const postMap = group.createMap();
			postMap.set("title", "Post");
			postMap.set("author", "co_zNonExistent");
			postMap.set("likes", 10);

			const post = CoMap.fromRaw(postMap, null);

			const resolved = await deepResolve(
				post,
				{
					title: true,
					author: {
						onError: "skip",
					},
					likes: true,
				},
				kernel,
			);

			expect(resolved.title).toBe("Post");
			expect(resolved.author).toBeUndefined();
			expect(resolved.likes).toBe(10);
		});

		it("should return null for missing reference with onError: null", async () => {
			const postMap = group.createMap();
			postMap.set("title", "Post");
			postMap.set("author", "co_zNonExistent");

			const post = CoMap.fromRaw(postMap, null);

			const resolved = await deepResolve(
				post,
				{
					title: true,
					author: {
						onError: "null",
					},
				},
				kernel,
			);

			expect(resolved.title).toBe("Post");
			expect(resolved.author).toBe(null);
		});

		it("should handle errors in each with onError: skip", async () => {
			const author1 = group.createMap();
			author1.set("name", "Alice");

			const commentsList = group.createList();
			commentsList.append(author1.id);
			commentsList.append("co_zNonExistent");
			commentsList.append(author1.id);

			const postMap = group.createMap();
			postMap.set("title", "Post");
			postMap.set("comments", commentsList.id);

			const post = CoMap.fromRaw(postMap, null);

			const resolved = await deepResolve(
				post,
				{
					comments: {
						each: {
							onError: "skip",
						},
					},
				},
				kernel,
			);

			expect(resolved.comments.length).toBe(2); // Skipped the missing one
			expect(resolved.comments[0].name).toBe("Alice");
			expect(resolved.comments[1].name).toBe("Alice");
		});
	});

	describe("Circular Reference Detection", () => {
		it("should detect direct circular reference", async () => {
			// Create circular reference: A → A
			const mapA = group.createMap();
			mapA.set("name", "A");
			mapA.set("self", mapA.id);

			const coMapA = CoMap.fromRaw(mapA, null);

			await expect(
				deepResolve(
					coMapA,
					{
						name: true,
						self: {
							fields: {
								name: true,
							},
						},
					},
					kernel,
				),
			).rejects.toThrow(/Circular reference detected/);
		});

		it("should detect indirect circular reference", async () => {
			// Create circular reference: A → B → A
			const mapA = group.createMap();
			mapA.set("name", "A");

			const mapB = group.createMap();
			mapB.set("name", "B");
			mapB.set("parent", mapA.id);

			mapA.set("child", mapB.id);

			const coMapA = CoMap.fromRaw(mapA, null);

			await expect(
				deepResolve(
					coMapA,
					{
						child: {
							fields: {
								parent: {
									fields: {
										child: true,
									},
								},
							},
						},
					},
					kernel,
				),
			).rejects.toThrow(/Circular reference detected/);
		});
	});

	describe("Depth Limiting", () => {
		it("should prevent infinite recursion with depth limit", async () => {
			// Create a chain of 12 levels (should exceed MAX_DEPTH of 10)
			const maps = [];
			for (let i = 0; i < 12; i++) {
				const map = group.createMap();
				map.set("level", i);
				maps.push(map);
			}

			// Link them: 0 → 1 → 2 → ... → 11
			for (let i = 0; i < maps.length - 1; i++) {
				maps[i].set("next", maps[i + 1].id);
			}

			const start = CoMap.fromRaw(maps[0], null);

			// Build nested resolution config (12 levels deep)
			let resolveConfig = { level: true };
			for (let i = 0; i < 11; i++) {
				resolveConfig = { level: true, next: { fields: resolveConfig } };
			}

			await expect(deepResolve(start, resolveConfig, kernel)).rejects.toThrow(
				/Max resolution depth/,
			);
		});
	});

	describe("Complex Integration", () => {
		it("should resolve complex nested structure", async () => {
			// Create author with profile
			const profileMap = group.createMap();
			profileMap.set("avatar", "https://example.com/avatar.png");
			profileMap.set("bio", "Software Developer");

			const authorMap = group.createMap();
			authorMap.set("name", "Alice");
			authorMap.set("profile", profileMap.id);

			// Create comments with authors
			const comment1 = group.createMap();
			comment1.set("text", "Great post!");
			comment1.set("author", authorMap.id);

			const comment2 = group.createMap();
			comment2.set("text", "Thanks!");
			comment2.set("author", authorMap.id);

			const commentsList = group.createList();
			commentsList.append(comment1.id);
			commentsList.append(comment2.id);

			// Create post
			const postMap = group.createMap();
			postMap.set("title", "Complex Structure");
			postMap.set("author", authorMap.id);
			postMap.set("comments", commentsList.id);

			const post = CoMap.fromRaw(postMap, null);

			// Deep resolve everything
			const resolved = await deepResolve(
				post,
				{
					title: true,
					author: {
						fields: {
							name: true,
							profile: {
								fields: {
									avatar: true,
									bio: true,
								},
							},
						},
					},
					comments: {
						each: {
							fields: {
								text: true,
								author: {
									fields: {
										name: true,
									},
								},
							},
						},
					},
				},
				kernel,
			);

			// Verify structure
			expect(resolved.title).toBe("Complex Structure");
			expect(resolved.author.name).toBe("Alice");
			expect(resolved.author.profile.avatar).toBe(
				"https://example.com/avatar.png",
			);
			expect(resolved.author.profile.bio).toBe("Software Developer");
			expect(resolved.comments.length).toBe(2);
			expect(resolved.comments[0].text).toBe("Great post!");
			expect(resolved.comments[0].author.name).toBe("Alice");
			expect(resolved.comments[1].text).toBe("Thanks!");
			expect(resolved.comments[1].author.name).toBe("Alice");
		});
	});
});
