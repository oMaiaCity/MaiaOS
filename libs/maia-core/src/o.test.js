/**
 * Tests for MaiaOS kernel (o.js)
 * 
 * Tests the inspector functionality with real CoValues (NO MOCKS)
 */

import { describe, it, expect } from "bun:test";
import { createMaiaOS } from "./o.js";

describe("getAllCoValues", () => {
	it("should return schema field extracted from headerMeta", async () => {
		const maia = await createMaiaOS();
		
		const allCoValues = maia.getAllCoValues();
		
		// Verify we get CoValues back
		expect(allCoValues).toBeInstanceOf(Array);
		expect(allCoValues.length).toBeGreaterThan(0);
		
		// Each CoValue should have schema field
		for (const cv of allCoValues) {
			expect(cv).toHaveProperty("id");
			expect(cv).toHaveProperty("type");
			expect(cv).toHaveProperty("schema"); // NEW: schema field
			expect(cv).toHaveProperty("headerMeta");
			expect(cv).toHaveProperty("keys");
			expect(cv).toHaveProperty("createdAt");
		}
	});
	
	it("should extract schema from headerMeta.$schema", async () => {
		const maia = await createMaiaOS();
		
		const allCoValues = maia.getAllCoValues();
		
		// Find the Profile CoValue (should have ProfileSchema)
		const profileCv = allCoValues.find(cv => 
			cv.headerMeta?.$schema === "ProfileSchema"
		);
		
		expect(profileCv).toBeDefined();
		expect(profileCv.schema).toBe("ProfileSchema");
	});
	
	it("should return null schema when headerMeta.$schema doesn't exist", async () => {
		const maia = await createMaiaOS();
		
		const allCoValues = maia.getAllCoValues();
		
		// Find Account (has headerMeta.type but not headerMeta.$schema)
		const accountCv = allCoValues.find(cv => 
			cv.headerMeta?.type === "account"
		);
		
		expect(accountCv).toBeDefined();
		expect(accountCv.schema).toBeNull();
	});
	
	it("should return null schema when headerMeta is null", async () => {
		const maia = await createMaiaOS();
		
		const allCoValues = maia.getAllCoValues();
		
		// Find Group (has no headerMeta)
		const groupCv = allCoValues.find(cv => 
			cv.headerMeta === null && cv.keys > 1
		);
		
		expect(groupCv).toBeDefined();
		expect(groupCv.schema).toBeNull();
	});
	
	it("should return special content for CoStream", async () => {
		const maia = await createMaiaOS();
		
		const allCoValues = maia.getAllCoValues();
		
		// Find ActivityStream
		const streamCv = allCoValues.find(cv => 
			cv.schema === "ActivityStreamSchema"
		);
		
		expect(streamCv).toBeDefined();
		expect(streamCv.content).toBeDefined();
		expect(streamCv.content.type).toBe("stream");
		expect(streamCv.content.itemCount).toBeGreaterThanOrEqual(0);
	});
	
	it("should return special content for CoPlainText", async () => {
		const maia = await createMaiaOS();
		
		const allCoValues = maia.getAllCoValues();
		
		// Find BioText
		const plaintextCv = allCoValues.find(cv => 
			cv.schema === "BioTextSchema"
		);
		
		expect(plaintextCv).toBeDefined();
		expect(plaintextCv.content).toBeDefined();
		expect(plaintextCv.content.type).toBe("plaintext");
		expect(plaintextCv.content.length).toBeGreaterThan(0);
		expect(plaintextCv.content.preview).toContain("Hi, I'm");
	});
	
	it("should return special content for CoList", async () => {
		const maia = await createMaiaOS();
		
		const allCoValues = maia.getAllCoValues();
		
		// Find ProfileList
		const listCv = allCoValues.find(cv => 
			cv.schema === "ProfileListSchema"
		);
		
		expect(listCv).toBeDefined();
		expect(listCv.content).toBeDefined();
		expect(listCv.content.type).toBe("list");
		expect(listCv.content.itemCount).toBeGreaterThanOrEqual(1);
	});
});
