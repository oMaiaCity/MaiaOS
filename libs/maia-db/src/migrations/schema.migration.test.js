/**
 * Tests for schema migration
 * 
 * Tests the custom migration that creates Group + Profile + ProfileList with headerMeta
 * Uses real LocalNode and WasmCrypto (NO MOCKS)
 */

import { describe, it, expect } from "bun:test";
import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { schemaMigration } from "./schema.migration.js";

describe("schemaMigration", () => {
	it("should create Group and Profile with correct headerMeta", async () => {
		// Use real crypto
		const crypto = await WasmCrypto.create();
		
		// Create account with custom migration
		const result = await LocalNode.withNewlyCreatedAccount({
			creationProps: { name: "TestAccount" },
			crypto,
			migration: schemaMigration,
		});
		
		const account = result.node.expectCurrentAccount("test");
		
		// Verify profile was created
		const profileId = account.get("profile");
		expect(profileId).toBeDefined();
		expect(typeof profileId).toBe("string");
		expect(profileId).toMatch(/^co_z/);
		
		// Load profile and verify headerMeta
		// Get the CoValue using getCoValue, then getCurrentContent
		const profileCoValue = result.node.getCoValue(profileId);
		expect(profileCoValue).toBeDefined();
		const profile = profileCoValue?.getCurrentContent();
		expect(profile).toBeDefined();
		expect(profile.headerMeta).toEqual({ $schema: "ProfileSchema" });
		
		// Verify profile has correct name
		expect(profile.get("name")).toBe("TestAccount");
		
		// Verify group exists
		const group = profile.group;
		expect(group).toBeDefined();
		expect(group.id).toMatch(/^co_z/);
	});
	
	it("should link profile to account", async () => {
		const crypto = await WasmCrypto.create();
		
		const result = await LocalNode.withNewlyCreatedAccount({
			creationProps: { name: "TestAccount2" },
			crypto,
			migration: schemaMigration,
		});
		
		const account = result.node.expectCurrentAccount("test");
		const profileId = account.get("profile");
		
		// Profile ID should be accessible from account
		expect(profileId).toBeDefined();
		
		// Should be able to load the profile
		const profileCoValue = result.node.getCoValue(profileId);
		expect(profileCoValue).toBeDefined();
		const profile = profileCoValue?.getCurrentContent();
		expect(profile).toBeDefined();
	});
	
	it("should create profile with ProfileSchema in headerMeta", async () => {
		const crypto = await WasmCrypto.create();
		
		const result = await LocalNode.withNewlyCreatedAccount({
			creationProps: { name: "TestAccount3" },
			crypto,
			migration: schemaMigration,
		});
		
		const account = result.node.expectCurrentAccount("test");
		const profileId = account.get("profile");
		const profileCoValue = result.node.getCoValue(profileId);
		expect(profileCoValue).toBeDefined();
		const profile = profileCoValue?.getCurrentContent();
		
		// Critical: Profile must have $schema in headerMeta
		expect(profile).toBeDefined();
		expect(profile.headerMeta).toBeDefined();
		expect(profile.headerMeta.$schema).toBe("ProfileSchema");
	});
	
	it("should create ProfileList with ProfileListSchema and contain Profile", async () => {
		const crypto = await WasmCrypto.create();
		
		const result = await LocalNode.withNewlyCreatedAccount({
			creationProps: { name: "TestAccount4" },
			crypto,
			migration: schemaMigration,
		});
		
		const account = result.node.expectCurrentAccount("test");
		const profileId = account.get("profile");
		const profileCoValue = result.node.getCoValue(profileId);
		const profile = profileCoValue?.getCurrentContent();
		const group = profile.group;
		
		// Find ProfileList in the group's coValues
		// The ProfileList should be accessible via LocalNode
		const allCoValues = Array.from(result.node.coValues.values());
		const profileListCore = allCoValues.find(cv => {
			const content = cv.getCurrentContent();
			return content.type === "colist" && content.headerMeta?.$schema === "ProfileListSchema";
		});
		
		expect(profileListCore).toBeDefined();
		const profileList = profileListCore?.getCurrentContent();
		
		// Verify ProfileList headerMeta
		expect(profileList.headerMeta).toEqual({ $schema: "ProfileListSchema" });
		
		// Verify ProfileList contains the profile
		const items = profileList.toJSON();
		expect(items).toContain(profileId);
		expect(items.length).toBeGreaterThanOrEqual(1);
	});
	
	it("should create all CoValue examples with correct schemas", async () => {
		const crypto = await WasmCrypto.create();
		
		const result = await LocalNode.withNewlyCreatedAccount({
			creationProps: { name: "TestAccount5" },
			crypto,
			migration: schemaMigration,
		});
		
		// Get all CoValues created by migration
		const allCoValues = Array.from(result.node.coValues.values());
		
		// Find each CoValue by schema
		const profileListCore = allCoValues.find(cv => 
			cv.getCurrentContent().headerMeta?.$schema === "ProfileListSchema"
		);
		const activityStreamCore = allCoValues.find(cv => 
			cv.getCurrentContent().headerMeta?.$schema === "ActivityStreamSchema"
		);
		const avatarStreamCore = allCoValues.find(cv => 
			cv.getCurrentContent().headerMeta?.$schema === "AvatarStreamSchema"
		);
		const bioTextCore = allCoValues.find(cv => 
			cv.getCurrentContent().headerMeta?.$schema === "BioTextSchema"
		);
		
		// Verify ProfileList
		expect(profileListCore).toBeDefined();
		const profileList = profileListCore?.getCurrentContent();
		expect(profileList.type).toBe("colist");
		expect(profileList.headerMeta).toEqual({ $schema: "ProfileListSchema" });
		
		// Verify ActivityStream
		expect(activityStreamCore).toBeDefined();
		const activityStream = activityStreamCore?.getCurrentContent();
		expect(activityStream.type).toBe("costream");
		expect(activityStream.headerMeta).toEqual({ $schema: "ActivityStreamSchema" });
		
		// Verify AvatarStream
		expect(avatarStreamCore).toBeDefined();
		const avatarStream = avatarStreamCore?.getCurrentContent();
		expect(avatarStream.type).toBe("costream");
		expect(avatarStream.headerMeta).toEqual({ $schema: "AvatarStreamSchema" });
		
		// Verify BioText
		expect(bioTextCore).toBeDefined();
		const bioText = bioTextCore?.getCurrentContent();
		expect(bioText.type).toBe("coplaintext");
		expect(bioText.headerMeta).toEqual({ $schema: "BioTextSchema" });
		expect(bioText.toString()).toBe("Hi, I'm TestAccount5!");
	});
});
