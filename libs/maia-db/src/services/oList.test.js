import { describe, it, expect } from "bun:test";
import { createAccount } from "./oID.js";
import { createCoList } from "./oList.js";
import { createProfile } from "./oProfile.js";
import { hasSchema } from "../utils/meta.js";

describe("oList service", () => {
  it("should create a CoList with schema in headerMeta", async () => {
    const { node, group } = await createAccount({ name: "Test" });

    const list = createCoList(group, [], "ProfileListSchema");

    expect(list).toBeDefined();
    expect(list.id).toBeDefined();
    expect(list.id.startsWith("co_")).toBe(true);
    expect(list.headerMeta).toEqual({ $schema: "ProfileListSchema" });
    expect(hasSchema(list, "ProfileListSchema")).toBe(true);
  });

  it("should create a CoList with Profile CoMap item", async () => {
    const { node, group } = await createAccount({ name: "Test" });

    // Create a Profile CoMap
    const profile = createProfile(group, { name: "Alice" });

    // Create a ProfileList with the profile as an item
    const profileList = createCoList(group, [profile.id], "ProfileListSchema");

    expect(profileList.headerMeta).toEqual({ $schema: "ProfileListSchema" });
    expect(profileList.toJSON()).toEqual([profile.id]);

    // Verify we can load the profile from the list
    const profileIdFromList = profileList.toJSON()[0];
    expect(profileIdFromList).toBe(profile.id);

    const loadedProfile = node.getCoValue(profileIdFromList)?.getCurrentContent();
    expect(loadedProfile).toBeDefined();
    expect(loadedProfile.get("name")).toBe("Alice");
    expect(hasSchema(loadedProfile, "ProfileSchema")).toBe(true);
  });

  it("should create a CoList with no schema (null headerMeta)", async () => {
    const { group } = await createAccount({ name: "Test" });

    const list = createCoList(group, ["item1", "item2"], null);

    expect(list.headerMeta).toBeNull();
    expect(list.toJSON()).toEqual(["item1", "item2"]);
  });

  it("should create a CoList with initial primitive items", async () => {
    const { group } = await createAccount({ name: "Test" });

    const list = createCoList(group, ["hello", "world"], "StringListSchema");

    expect(list.headerMeta).toEqual({ $schema: "StringListSchema" });
    expect(list.toJSON()).toEqual(["hello", "world"]);
  });
});
