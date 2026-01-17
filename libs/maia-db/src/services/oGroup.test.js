/**
 * Tests for oGroup service (Group creation)
 * 
 * Uses real LocalNode (NO MOCKS)
 */

import { describe, it, expect } from "bun:test";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { createGroup } from "./oGroup.js";

describe("createGroup", () => {
	it("should create a Group", async () => {
		// Create real LocalNode
		const crypto = await WasmCrypto.create();
		const result = await LocalNode.withNewlyCreatedAccount({
			creationProps: { name: "TestAccount" },
			crypto,
		});
		
		const group = createGroup(result.node, { name: "TestGroup" });
		
		// Verify group created
		expect(group).toBeDefined();
		expect(group.id).toMatch(/^co_z/);
		expect(group.type).toBe("comap");
	});
	
	it("should have headerMeta managed by cojson", async () => {
		const crypto = await WasmCrypto.create();
		const result = await LocalNode.withNewlyCreatedAccount({
			creationProps: { name: "TestAccount" },
			crypto,
		});
		
		const group = createGroup(result.node);
		
		// Groups don't support custom headerMeta in createGroup()
		// so headerMeta is managed by cojson (currently null)
		expect(group.headerMeta).toBeNull();
	});
});
