/**
 * Tests for oID service (Account creation)
 * 
 * Uses real LocalNode + WasmCrypto (NO MOCKS)
 */

import { describe, it, expect } from "bun:test";
import { createAccount } from "./oID.js";

describe("createAccount", () => {
	it("should create Account with custom migration", async () => {
		const { node, account, accountID } = await createAccount({ name: "TestUser" });
		
		// Verify account created
		expect(node).toBeDefined();
		expect(account).toBeDefined();
		expect(accountID).toBeDefined();
		expect(accountID).toMatch(/^co_z/);
		
		// Verify account type
		expect(account.type).toBe("comap");
		
		// Verify account headerMeta (set by cojson)
		expect(account.headerMeta).toBeDefined();
		expect(account.headerMeta.type).toBe("account");
	});
	
	it("should return node, account, accountID, group, and profile", async () => {
		const result = await createAccount({ name: "TestUser2" });
		
		// Verify all return values
		expect(result.node).toBeDefined();
		expect(result.account).toBeDefined();
		expect(result.accountID).toBeDefined();
		expect(result.group).toBeDefined();
		expect(result.profile).toBeDefined();
		
		// Verify IDs are valid
		expect(result.accountID).toMatch(/^co_z/);
		expect(result.group.id).toMatch(/^co_z/);
		expect(result.profile.id).toMatch(/^co_z/);
	});
	
	it("should create Profile with ProfileSchema in headerMeta", async () => {
		const { profile } = await createAccount({ name: "TestUser3" });
		
		// Critical: Profile must have $schema in headerMeta
		expect(profile.headerMeta).toBeDefined();
		expect(profile.headerMeta.$schema).toBe("ProfileSchema");
	});
	
	it("should link profile to account", async () => {
		const { account, profile } = await createAccount({ name: "TestUser4" });
		
		// Profile ID should be in account
		const profileId = account.get("profile");
		expect(profileId).toBe(profile.id);
	});
	
	it("should set profile name from creation props", async () => {
		const { profile } = await createAccount({ name: "Alice" });
		
		// Profile should have the name we set
		expect(profile.get("name")).toBe("Alice");
	});
});
