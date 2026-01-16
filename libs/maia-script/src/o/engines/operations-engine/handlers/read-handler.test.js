import { describe, it, expect, beforeEach } from "bun:test";
import { handleRead } from "./read-handler.js";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import {
	CoMap,
	CoList,
	SchemaStore,
	SubscriptionCache,
} from "@maiaos/maia-cojson";

describe("Read Operation Handler (Real CRDTs)", () => {
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
			subscriptionCache: new SubscriptionCache(5000),
		};
	});

	describe("Basic Read", () => {
		it("should read a CoMap", async () => {
			const map = group.createMap();
			map.set("title", "Hello World");
			map.set("likes", 42);

			const operation = {
				op: "read",
				target: { id: map.id },
			};

			const result = await handleRead(operation, kernel);

			expect(result).toBeInstanceOf(CoMap);
			expect(result.title).toBe("Hello World");
			expect(result.likes).toBe(42);
			expect(result.$id).toBe(map.id);
		});

		it("should read a CoList", async () => {
			const list = group.createList();
			list.append("item1");
			list.append("item2");
			list.append("item3");

			const operation = {
				op: "read",
				target: { id: list.id },
			};

			const result = await handleRead(operation, kernel);

			expect(result).toBeInstanceOf(CoList);
			expect(result.length).toBe(3);
		});

		it("should throw error for unavailable CoValue", async () => {
			const operation = {
				op: "read",
				target: { id: "co_zNonExistent" },
			};

			await expect(handleRead(operation, kernel)).rejects.toThrow(
				/unavailable/,
			);
		});
	});

	describe("Read with Resolution", () => {
		it("should resolve single reference", async () => {
			// Create author
			const authorMap = group.createMap();
			authorMap.set("name", "Alice");
			authorMap.set("email", "alice@example.com");

			// Create post
			const postMap = group.createMap();
			postMap.set("title", "Hello");
			postMap.set("author", authorMap.id);

			const operation = {
				op: "read",
				target: { id: postMap.id },
				resolve: {
					title: true,
					author: {
						fields: {
							name: true,
							email: true,
						},
					},
				},
			};

			const result = await handleRead(operation, kernel);

			expect(result.title).toBe("Hello");
			expect(result.author.name).toBe("Alice");
			expect(result.author.email).toBe("alice@example.com");
		});

		it("should resolve list items with each", async () => {
			// Create posts
			const post1 = group.createMap();
			post1.set("title", "Post 1");

			const post2 = group.createMap();
			post2.set("title", "Post 2");

			// Create posts list
			const postsList = group.createList();
			postsList.append(post1.id);
			postsList.append(post2.id);

			// Create blog
			const blogMap = group.createMap();
			blogMap.set("name", "My Blog");
			blogMap.set("posts", postsList.id);

			const operation = {
				op: "read",
				target: { id: blogMap.id },
				resolve: {
					name: true,
					posts: {
						each: {
							fields: {
								title: true,
							},
						},
					},
				},
			};

			const result = await handleRead(operation, kernel);

			expect(result.name).toBe("My Blog");
			expect(result.posts).toBeInstanceOf(Array);
			expect(result.posts.length).toBe(2);
			expect(result.posts[0].title).toBe("Post 1");
			expect(result.posts[1].title).toBe("Post 2");
		});

		it("should resolve deeply nested structure", async () => {
			// Create profile
			const profileMap = group.createMap();
			profileMap.set("avatar", "avatar.png");

			// Create author
			const authorMap = group.createMap();
			authorMap.set("name", "Bob");
			authorMap.set("profile", profileMap.id);

			// Create post
			const postMap = group.createMap();
			postMap.set("title", "Deep Post");
			postMap.set("author", authorMap.id);

			const operation = {
				op: "read",
				target: { id: postMap.id },
				resolve: {
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
			};

			const result = await handleRead(operation, kernel);

			expect(result.title).toBe("Deep Post");
			expect(result.author.name).toBe("Bob");
			expect(result.author.profile.avatar).toBe("avatar.png");
		});
	});

	describe("Subscription Management", () => {
		it("should add subscriber to cache", async () => {
			const map = group.createMap();
			map.set("title", "Test");

			const operation = {
				op: "read",
				target: { id: map.id },
			};

			await handleRead(operation, kernel);

			// Verify subscriber was added
			const entry = kernel.subscriptionCache.getEntry(map.id);
			expect(entry).toBeDefined();
			expect(entry.subscriberCount).toBe(1);
		});
	});

	describe("Integration: Full Read Workflow", () => {
		it("should handle complex blog structure", async () => {
			// Create authors
			const alice = group.createMap();
			alice.set("name", "Alice");
			alice.set("email", "alice@example.com");

			const bob = group.createMap();
			bob.set("name", "Bob");
			bob.set("email", "bob@example.com");

			// Create comments
			const comment1 = group.createMap();
			comment1.set("text", "Great post!");
			comment1.set("author", alice.id);

			const comment2 = group.createMap();
			comment2.set("text", "Thanks!");
			comment2.set("author", bob.id);

			const commentsList = group.createList();
			commentsList.append(comment1.id);
			commentsList.append(comment2.id);

			// Create post
			const postMap = group.createMap();
			postMap.set("title", "My First Post");
			postMap.set("content", "This is the content");
			postMap.set("author", alice.id);
			postMap.set("likes", 10);
			postMap.set("comments", commentsList.id);

			const operation = {
				op: "read",
				target: { id: postMap.id },
				resolve: {
					title: true,
					content: true,
					likes: true,
					author: {
						fields: {
							name: true,
							email: true,
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
			};

			const result = await handleRead(operation, kernel);

			// Verify full structure
			expect(result.title).toBe("My First Post");
			expect(result.content).toBe("This is the content");
			expect(result.likes).toBe(10);
			expect(result.author.name).toBe("Alice");
			expect(result.author.email).toBe("alice@example.com");
			expect(result.comments.length).toBe(2);
			expect(result.comments[0].text).toBe("Great post!");
			expect(result.comments[0].author.name).toBe("Alice");
			expect(result.comments[1].text).toBe("Thanks!");
			expect(result.comments[1].author.name).toBe("Bob");
		});
	});
});
