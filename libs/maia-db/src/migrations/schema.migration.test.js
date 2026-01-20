/**
 * Tests for MINIMAL schema migration
 * 
 * Tests the absolute minimal migration that just sets profile to "owner"
 * No Group creation, no CoMap creation - testing cojson's minimum requirements
 * Uses real LocalNode and WasmCrypto (NO MOCKS)
 */

import { describe, it, expect } from "bun:test";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { schemaMigration } from "./schema.migration.js";

describe("schemaMigration (MINIMAL)", () => {
	it("should set profile to string 'owner'", async () => {
		// Use real crypto
		const crypto = await WasmCrypto.create();
		
		// Create account with minimal migration
		const result = await LocalNode.withNewlyCreatedAccount({
			creationProps: { name: "TestAccount" },
			crypto,
			migration: schemaMigration,
		});
		
		const account = result.node.expectCurrentAccount("test");
		
		// Verify profile is set to string "owner"
		const profileValue = account.get("profile");
		expect(profileValue).toBeDefined();
		expect(typeof profileValue).toBe("string");
		expect(profileValue).toBe("owner");
	});
	
	it("should satisfy cojson's ONLY requirement (profile must be truthy)", async () => {
		const crypto = await WasmCrypto.create();
		
		// This should NOT throw error (cojson hardcoded check at line 286-288)
		const result = await LocalNode.withNewlyCreatedAccount({
			creationProps: { name: "TestAccount2" },
			crypto,
			migration: schemaMigration,
		});
		
		const account = result.node.expectCurrentAccount("test");
		const profileValue = account.get("profile");
		
		// Profile must be truthy (cojson requirement - tested empirically!)
		// Falsy values (null, undefined, "", 0, false) all fail
		expect(profileValue).toBeDefined();
		expect(profileValue).toBeTruthy();
		
		// Note: This IS the absolute minimum! We tested:
		// - No profile → FAILED
		// - profile = null → FAILED
		// - profile = undefined → FAILED
		// - profile = "" → FAILED
		// - profile = 0 → FAILED
		// Only truthy values work!
	});
	
	it("should not create any Group or CoMap", async () => {
		const crypto = await WasmCrypto.create();
		
		const result = await LocalNode.withNewlyCreatedAccount({
			creationProps: { name: "TestAccount3" },
			crypto,
			migration: schemaMigration,
		});
		
		const account = result.node.expectCurrentAccount("test");
		
		// Get all CoValues - should only be the Account itself
		const allCoValues = Array.from(result.node.coValues.values());
		
		// Account is always a CoValue, but no other CoValues should exist
		expect(allCoValues.length).toBe(1); // Only the account itself
		
		// The one CoValue should be the account
		const accountCore = allCoValues[0];
		const accountContent = accountCore?.getCurrentContent();
		expect(accountContent.id).toBe(account.id);
	});
	
	it("should work with any account name", async () => {
		const crypto = await WasmCrypto.create();
		
		const result = await LocalNode.withNewlyCreatedAccount({
			creationProps: { name: "SomeOtherName" },
			crypto,
			migration: schemaMigration,
		});
		
		const account = result.node.expectCurrentAccount("test");
		const profileValue = account.get("profile");
		
		// Profile should always be "owner" regardless of account name
		expect(profileValue).toBe("owner");
	});
});
