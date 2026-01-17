/**
 * Tests for meta utilities
 * 
 * Tests the metadata utility functions for creating and working with headerMeta
 */

import { describe, it, expect } from "bun:test";
import { createSchemaMeta, hasSchema, getSchema } from "./meta.js";

describe("createSchemaMeta", () => {
	it("should create metadata object with schema reference", () => {
		const meta = createSchemaMeta("ProfileSchema");
		
		expect(meta).toEqual({ $schema: "ProfileSchema" });
	});
	
	it("should create metadata for different schema names", () => {
		const postMeta = createSchemaMeta("PostSchema");
		const taskMeta = createSchemaMeta("TaskSchema");
		
		expect(postMeta).toEqual({ $schema: "PostSchema" });
		expect(taskMeta).toEqual({ $schema: "TaskSchema" });
	});
});

describe("hasSchema", () => {
	it("should return true when CoValue has expected schema", () => {
		const coValue = {
			headerMeta: { $schema: "ProfileSchema" }
		};
		
		expect(hasSchema(coValue, "ProfileSchema")).toBe(true);
	});
	
	it("should return false when CoValue has different schema", () => {
		const coValue = {
			headerMeta: { $schema: "ProfileSchema" }
		};
		
		expect(hasSchema(coValue, "PostSchema")).toBe(false);
	});
	
	it("should return false when CoValue has no headerMeta", () => {
		const coValue = {};
		
		expect(hasSchema(coValue, "ProfileSchema")).toBe(false);
	});
	
	it("should return false when headerMeta has no $schema", () => {
		const coValue = {
			headerMeta: { type: "account" }
		};
		
		expect(hasSchema(coValue, "ProfileSchema")).toBe(false);
	});
});

describe("getSchema", () => {
	it("should extract schema name from CoValue headerMeta", () => {
		const coValue = {
			headerMeta: { $schema: "ProfileSchema" }
		};
		
		expect(getSchema(coValue)).toBe("ProfileSchema");
	});
	
	it("should return null when CoValue has no headerMeta", () => {
		const coValue = {};
		
		expect(getSchema(coValue)).toBeNull();
	});
	
	it("should return null when headerMeta has no $schema", () => {
		const coValue = {
			headerMeta: { type: "account" }
		};
		
		expect(getSchema(coValue)).toBeNull();
	});
});
