/**
 * Tests for oProfile service (Profile creation)
 * 
 * Uses real Group (NO MOCKS)
 */

import { describe, it, expect } from "bun:test";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { createProfile } from "./oProfile.js";

describe("createProfile", () => {
	it("should create Profile with ProfileSchema in headerMeta", async () => {
		// Create real LocalNode and Group
		const crypto = await WasmCrypto.create();
		const result = await LocalNode.withNewlyCreatedAccount({
			creationProps: { name: "TestAccount" },
			crypto,
		});
		const group = result.node.createGroup();
		
		const profile = createProfile(group, { name: "Bob" });
		
		// Verify Profile created
		expect(profile).toBeDefined();
		expect(profile.id).toMatch(/^co_z/);
		
		// Verify headerMeta has ProfileSchema
		expect(profile.headerMeta).toBeDefined();
		expect(profile.headerMeta.$schema).toBe("ProfileSchema");
		
		// Verify name
		expect(profile.get("name")).toBe("Bob");
	});
	
	it("should use default name if not provided", async () => {
		const crypto = await WasmCrypto.create();
		const result = await LocalNode.withNewlyCreatedAccount({
			creationProps: { name: "TestAccount" },
			crypto,
		});
		const group = result.node.createGroup();
		
		const profile = createProfile(group);
		
		// Should have default name
		expect(profile.get("name")).toBe("User");
		
		// Should still have ProfileSchema
		expect(profile.headerMeta.$schema).toBe("ProfileSchema");
	});
});
