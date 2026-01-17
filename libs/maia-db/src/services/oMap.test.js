/**
 * Tests for oMap service (Generic CoMap creation)
 * 
 * Uses real Group (NO MOCKS)
 */

import { describe, it, expect } from "bun:test";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { createCoMap } from "./oMap.js";

describe("createCoMap", () => {
	it("should create CoMap with schema in headerMeta", async () => {
		// Create real LocalNode and Group
		const crypto = await WasmCrypto.create();
		const result = await LocalNode.withNewlyCreatedAccount({
			creationProps: { name: "TestAccount" },
			crypto,
		});
		const group = result.node.createGroup();
		
		const comap = createCoMap(group, { title: "Test Post" }, "PostSchema");
		
		// Verify CoMap created
		expect(comap).toBeDefined();
		expect(comap.id).toMatch(/^co_z/);
		
		// Verify headerMeta has schema
		expect(comap.headerMeta).toBeDefined();
		expect(comap.headerMeta.$schema).toBe("PostSchema");
		
		// Verify initial properties
		expect(comap.get("title")).toBe("Test Post");
	});
	
	it("should create CoMap without schema if not provided", async () => {
		const crypto = await WasmCrypto.create();
		const result = await LocalNode.withNewlyCreatedAccount({
			creationProps: { name: "TestAccount" },
			crypto,
		});
		const group = result.node.createGroup();
		
		const comap = createCoMap(group, { data: "test" });
		
		// Verify CoMap created
		expect(comap).toBeDefined();
		expect(comap.id).toMatch(/^co_z/);
		
		// No schema provided, so headerMeta should be null
		expect(comap.headerMeta).toBeNull();
	});
	
	it("should support different schema names", async () => {
		const crypto = await WasmCrypto.create();
		const result = await LocalNode.withNewlyCreatedAccount({
			creationProps: { name: "TestAccount" },
			crypto,
		});
		const group = result.node.createGroup();
		
		const task = createCoMap(group, { title: "Task" }, "TaskSchema");
		const post = createCoMap(group, { title: "Post" }, "PostSchema");
		
		// Verify different schemas
		expect(task.headerMeta.$schema).toBe("TaskSchema");
		expect(post.headerMeta.$schema).toBe("PostSchema");
	});
});
