import { beforeAll, describe, expect, expectTypeOf, it } from "vitest";
import type { DocumentValidator } from "../../convex/doc/validator";

describe("documentValidator", () => {
  it("is a valid Convex object validator", async () => {
    const { documentValidator } = await import("../../convex/doc/validator");
    expect(documentValidator).toBeDefined();
    expect(documentValidator.isConvexValidator).toBe(true);
    expect(documentValidator.kind).toBe("object");
  });

  describe("required fields", () => {
    let documentValidator: any;

    beforeAll(async () => {
      const mod = await import("../../convex/doc/validator");
      documentValidator = mod.documentValidator;
    });

    it("has _id as a VId with tableName 'documents'", () => {
      const field = documentValidator.fields._id;
      expect(field.kind).toBe("id");
      expect(field.tableName).toBe("documents");
      expect(field.isOptional).toBe("required");
    });

    it("has _creationTime as a float64", () => {
      const field = documentValidator.fields._creationTime;
      expect(field.kind).toBe("float64");
      expect(field.isOptional).toBe("required");
    });

    it("has url as a string", () => {
      const field = documentValidator.fields.url;
      expect(field.kind).toBe("string");
      expect(field.isOptional).toBe("required");
    });

    it("has title as a string", () => {
      const field = documentValidator.fields.title;
      expect(field.kind).toBe("string");
      expect(field.isOptional).toBe("required");
    });

    it("has source as a string", () => {
      const field = documentValidator.fields.source;
      expect(field.kind).toBe("string");
      expect(field.isOptional).toBe("required");
    });

    it("has category as a string", () => {
      const field = documentValidator.fields.category;
      expect(field.kind).toBe("string");
      expect(field.isOptional).toBe("required");
    });

    it("has crawledAt as a float64", () => {
      const field = documentValidator.fields.crawledAt;
      expect(field.kind).toBe("float64");
      expect(field.isOptional).toBe("required");
    });

    it("has updatedAt as a float64", () => {
      const field = documentValidator.fields.updatedAt;
      expect(field.kind).toBe("float64");
      expect(field.isOptional).toBe("required");
    });
  });

  describe("optional fields", () => {
    let documentValidator: any;

    beforeAll(async () => {
      const mod = await import("../../convex/doc/validator");
      documentValidator = mod.documentValidator;
    });

    it("has entryId as an optional string", () => {
      const field = documentValidator.fields.entryId;
      expect(field.kind).toBe("string");
      expect(field.isOptional).toBe("optional");
    });

    it("has contentHash as an optional string", () => {
      const field = documentValidator.fields.contentHash;
      expect(field.kind).toBe("string");
      expect(field.isOptional).toBe("optional");
    });

    it("has subcategory as an optional string", () => {
      const field = documentValidator.fields.subcategory;
      expect(field.kind).toBe("string");
      expect(field.isOptional).toBe("optional");
    });

    it("has chunkCount as an optional float64", () => {
      const field = documentValidator.fields.chunkCount;
      expect(field.kind).toBe("float64");
      expect(field.isOptional).toBe("optional");
    });

    it("has error as an optional string", () => {
      const field = documentValidator.fields.error;
      expect(field.kind).toBe("string");
      expect(field.isOptional).toBe("optional");
    });
  });

  describe("status union", () => {
    let documentValidator: any;

    beforeAll(async () => {
      const mod = await import("../../convex/doc/validator");
      documentValidator = mod.documentValidator;
    });

    it("is a union of 7 status literals", () => {
      const field = documentValidator.fields.status;
      expect(field.kind).toBe("union");
      expect(field.isOptional).toBe("required");
      expect(field.members).toHaveLength(7);
    });

    it("includes all expected status values", () => {
      const field = documentValidator.fields.status;
      const values = field.members.map((m: { kind: string; value: string }) => m.value);
      expect(values).toContain("pending");
      expect(values).toContain("processing");
      expect(values).toContain("indexed");
      expect(values).toContain("failed");
      expect(values).toContain("stale");
      expect(values).toContain("active");
      expect(values).toContain("pending_embed");
    });

    it("each status member is a literal validator", () => {
      const field = documentValidator.fields.status;
      for (const member of field.members) {
        expect(member.kind).toBe("literal");
      }
    });
  });

  describe("metadata nested object", () => {
    let documentValidator: any;

    beforeAll(async () => {
      const mod = await import("../../convex/doc/validator");
      documentValidator = mod.documentValidator;
    });

    it("is an optional object", () => {
      const field = documentValidator.fields.metadata;
      expect(field.kind).toBe("object");
      expect(field.isOptional).toBe("optional");
    });

    it("has lastModified as optional string", () => {
      const field = documentValidator.fields.metadata.fields.lastModified;
      expect(field.kind).toBe("string");
      expect(field.isOptional).toBe("optional");
    });

    it("has author as optional string", () => {
      const field = documentValidator.fields.metadata.fields.author;
      expect(field.kind).toBe("string");
      expect(field.isOptional).toBe("optional");
    });

    it("has wordCount as optional float64", () => {
      const field = documentValidator.fields.metadata.fields.wordCount;
      expect(field.kind).toBe("float64");
      expect(field.isOptional).toBe("optional");
    });

    it("has language as optional string", () => {
      const field = documentValidator.fields.metadata.fields.language;
      expect(field.kind).toBe("string");
      expect(field.isOptional).toBe("optional");
    });
  });

  describe("field count", () => {
    let documentValidator: any;

    beforeAll(async () => {
      const mod = await import("../../convex/doc/validator");
      documentValidator = mod.documentValidator;
    });

    it("has exactly 19 fields", () => {
      const keys = Object.keys(documentValidator.fields);
      expect(keys).toHaveLength(19);
    });

    it("contains all expected field names in order", () => {
      const keys = Object.keys(documentValidator.fields);
      expect(keys).toEqual([
        "_id",
        "_creationTime",
        "url",
        "title",
        "entryId",
        "contentHash",
        "source",
        "category",
        "subcategory",
        "metadata",
        "status",
        "chunkCount",
        "chunksEmbedded",
        "crawlSessionId",
        "freshnessTier",
        "isStale",
        "crawledAt",
        "updatedAt",
        "error",
      ]);
    });
  });

  describe("JSON schema introspection", () => {
    let j: any;

    beforeAll(async () => {
      const { documentValidator } = await import("../../convex/doc/validator");
      j = (documentValidator as any).json;
    });

    it("serializes as an object type", () => {
      expect(j.type).toBe("object");
    });

    it("has correct value map with field types and optionality", () => {
      expect(j.value._id).toEqual({
        fieldType: { type: "id", tableName: "documents" },
        optional: false,
      });
      expect(j.value._creationTime).toEqual({
        fieldType: { type: "number" },
        optional: false,
      });
      expect(j.value.url).toEqual({
        fieldType: { type: "string" },
        optional: false,
      });
      expect(j.value.title).toEqual({
        fieldType: { type: "string" },
        optional: false,
      });
      expect(j.value.source).toEqual({
        fieldType: { type: "string" },
        optional: false,
      });
      expect(j.value.category).toEqual({
        fieldType: { type: "string" },
        optional: false,
      });
      expect(j.value.crawledAt).toEqual({
        fieldType: { type: "number" },
        optional: false,
      });
      expect(j.value.updatedAt).toEqual({
        fieldType: { type: "number" },
        optional: false,
      });
    });

    it("serializes optional fields with optional: true", () => {
      expect(j.value.entryId).toEqual({
        fieldType: { type: "string" },
        optional: true,
      });
      expect(j.value.contentHash).toEqual({
        fieldType: { type: "string" },
        optional: true,
      });
      expect(j.value.subcategory).toEqual({
        fieldType: { type: "string" },
        optional: true,
      });
      expect(j.value.chunkCount).toEqual({
        fieldType: { type: "number" },
        optional: true,
      });
      expect(j.value.error).toEqual({
        fieldType: { type: "string" },
        optional: true,
      });
    });

    it("serializes status union with members array", () => {
      const status = j.value.status;
      expect(status.fieldType.type).toBe("union");
      expect(status.fieldType.value).toHaveLength(7);
      expect(status.optional).toBe(false);
    });

    it("serializes metadata as an optional nested object", () => {
      const meta = j.value.metadata;
      expect(meta.fieldType.type).toBe("object");
      expect(meta.optional).toBe(true);
    });

    it("serializes nested metadata fields correctly", () => {
      const metaFields = j.value.metadata.fieldType.value;
      expect(metaFields.lastModified).toEqual({
        fieldType: { type: "string" },
        optional: true,
      });
      expect(metaFields.author).toEqual({
        fieldType: { type: "string" },
        optional: true,
      });
      expect(metaFields.wordCount).toEqual({
        fieldType: { type: "number" },
        optional: true,
      });
      expect(metaFields.language).toEqual({
        fieldType: { type: "string" },
        optional: true,
      });
    });

    it("has all 19 fields in the serialized value", () => {
      expect(Object.keys(j.value)).toHaveLength(19);
    });
  });

  describe("validator methods", () => {
    let documentValidator: any;

    beforeAll(async () => {
      const mod = await import("../../convex/doc/validator");
      documentValidator = mod.documentValidator;
    });

    it("pick() returns a VObject with only specified fields", () => {
      const picked = documentValidator.pick("_id", "url", "title");
      expect(picked.kind).toBe("object");
      expect(picked.isConvexValidator).toBe(true);
      expect(Object.keys(picked.fields)).toEqual(["_id", "url", "title"]);
      // Preserves field types
      expect(picked.fields._id.kind).toBe("id");
      expect(picked.fields._id.tableName).toBe("documents");
      expect(picked.fields.url.kind).toBe("string");
      expect(picked.fields.title.kind).toBe("string");
    });

    it("pick() preserves optionality", () => {
      const picked = documentValidator.pick("entryId", "chunkCount");
      expect(picked.fields.entryId.isOptional).toBe("optional");
      expect(picked.fields.chunkCount.isOptional).toBe("optional");
    });

    it("pick() with no fields returns empty object", () => {
      const picked = documentValidator.pick();
      expect(picked.kind).toBe("object");
      expect(Object.keys(picked.fields)).toHaveLength(0);
    });

    it("omit() returns a VObject without specified fields", () => {
      const omitted = documentValidator.omit("_creationTime", "crawledAt", "updatedAt");
      expect(omitted.kind).toBe("object");
      expect(omitted.isConvexValidator).toBe(true);
      expect(Object.keys(omitted.fields)).not.toContain("_creationTime");
      expect(Object.keys(omitted.fields)).not.toContain("crawledAt");
      expect(Object.keys(omitted.fields)).not.toContain("updatedAt");
      // Remaining fields preserved
      expect(omitted.fields._id.kind).toBe("id");
      expect(omitted.fields.url.kind).toBe("string");
      expect(omitted.fields.title.kind).toBe("string");
      expect(omitted.fields.status.kind).toBe("union");
      expect(omitted.fields.metadata.kind).toBe("object");
    });

    it("omit() with no fields returns identical validator", () => {
      const omitted = documentValidator.omit();
      expect(Object.keys(omitted.fields)).toHaveLength(19);
    });

    it("omit() removes all fields when all named", () => {
      const allFields = Object.keys(documentValidator.fields);
      const omitted = documentValidator.omit(...allFields);
      expect(Object.keys(omitted.fields)).toHaveLength(0);
    });

    it("partial() marks all fields as optional", () => {
      const partial = documentValidator.partial();
      expect(partial.kind).toBe("object");
      expect(Object.keys(partial.fields)).toHaveLength(19);
      for (const key of Object.keys(partial.fields)) {
        expect(partial.fields[key].isOptional).toBe("optional");
      }
    });

    it("partial() preserves field types while making them optional", () => {
      const partial = documentValidator.partial();
      expect(partial.fields._id.kind).toBe("id");
      expect(partial.fields._id.tableName).toBe("documents");
      expect(partial.fields.url.kind).toBe("string");
      expect(partial.fields.status.kind).toBe("union");
      expect(partial.fields.metadata.kind).toBe("object");
      expect(partial.fields.crawledAt.kind).toBe("float64");
    });

    it("extend() adds new fields to the validator", async () => {
      const { v } = await import("convex/values");
      const extended = documentValidator.extend({
        popularity: v.number(),
        tags: v.optional(v.array(v.string())),
      });
      expect(extended.kind).toBe("object");
      expect(Object.keys(extended.fields)).toHaveLength(21);
      expect(extended.fields.popularity.kind).toBe("float64");
      expect(extended.fields.popularity.isOptional).toBe("required");
      expect(extended.fields.tags.kind).toBe("array");
      expect(extended.fields.tags.isOptional).toBe("optional");
      // Original fields preserved
      expect(extended.fields._id.kind).toBe("id");
      expect(extended.fields.url.kind).toBe("string");
      expect(extended.fields.title.kind).toBe("string");
    });

    it("extend() does not mutate the original validator", () => {
      expect(Object.keys(documentValidator.fields)).toHaveLength(19);
    });
  });

  describe("union edge cases", () => {
    let statusField: any;

    beforeAll(async () => {
      const { documentValidator } = await import("../../convex/doc/validator");
      statusField = documentValidator.fields.status;
    });

    it("has exactly 7 members", () => {
      expect(statusField.members).toHaveLength(7);
    });

    it("has no duplicate literal values in the union", () => {
      const values = statusField.members.map((m: any) => m.value);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });

    it("contains the expected values in the exact order", () => {
      const values = statusField.members.map((m: any) => m.value);
      expect(values).toEqual(["pending", "processing", "indexed", "failed", "stale", "active", "pending_embed"]);
    });

    it("does not contain invalid status values", () => {
      const values = statusField.members.map((m: any) => m.value);
      expect(values).not.toContain("deleted");
      expect(values).not.toContain("archived");
      expect(values).not.toContain("draft");
      expect(values).not.toContain("published");
      expect(values).not.toContain("");
    });

    it("all members are literal validators (not unions, objects, or null)", () => {
      for (const member of statusField.members) {
        expect(member.kind).toBe("literal");
        expect(member.isConvexValidator).toBe(true);
        // Literals should have string values (not numbers, booleans, or bigints)
        expect(typeof member.value).toBe("string");
      }
    });

    it("union itself is not optional (status is required)", () => {
      expect(statusField.isOptional).toBe("required");
    });
  });

  describe("string validator serialization", () => {
    let j: any;

    beforeAll(async () => {
      const { documentValidator } = await import("../../convex/doc/validator");
      j = (documentValidator as any).json;
    });

    it("url string has no constraints in serialized form", () => {
      expect(j.value.url.fieldType).toEqual({ type: "string" });
      // v.string() serializes as { type: "string" } with no additional constraints
      expect(j.value.url.fieldType.minLength).toBeUndefined();
      expect(j.value.url.fieldType.maxLength).toBeUndefined();
      expect(j.value.url.fieldType.pattern).toBeUndefined();
      // A malformed URL would pass string validation - valid but worth documenting
    });

    it("title string has no constraints", () => {
      expect(j.value.title.fieldType).toEqual({ type: "string" });
      expect(j.value.title.fieldType.maxLength).toBeUndefined();
    });

    it("all required string fields serialize as { type: 'string' } with no extra props", () => {
      for (const fieldName of ["url", "title", "source", "category"]) {
        expect(j.value[fieldName].fieldType).toEqual({ type: "string" });
      }
    });

    it("optional string fields also serialize as { type: 'string' } with no extra props", () => {
      for (const fieldName of ["entryId", "contentHash", "subcategory", "error"]) {
        expect(j.value[fieldName].fieldType).toEqual({ type: "string" });
      }
    });
  });

  describe("TypeScript type compatibility", () => {
    it("inferred type has required fields present", async () => {
      const { documentValidator } = await import("../../convex/doc/validator");
      type Doc = typeof documentValidator.type;

      // Required fields are present
      expectTypeOf<
        Pick<
          Doc,
          | "_id"
          | "_creationTime"
          | "url"
          | "title"
          | "source"
          | "category"
          | "crawledAt"
          | "updatedAt"
        >
      >().toMatchTypeOf<{
        _id: string;
        _creationTime: number;
        url: string;
        title: string;
        source: string;
        category: string;
        crawledAt: number;
        updatedAt: number;
      }>();
    });

    it("optional fields resolve to T | undefined", async () => {
      const { documentValidator } = await import("../../convex/doc/validator");
      type Doc = typeof documentValidator.type;

      expectTypeOf<Doc["entryId"]>().toEqualTypeOf<string | undefined>();
      expectTypeOf<Doc["contentHash"]>().toEqualTypeOf<string | undefined>();
      expectTypeOf<Doc["subcategory"]>().toEqualTypeOf<string | undefined>();
      expectTypeOf<Doc["chunkCount"]>().toEqualTypeOf<number | undefined>();
      expectTypeOf<Doc["error"]>().toEqualTypeOf<string | undefined>();
    });

    it("nested metadata is optional with all-optional fields", async () => {
      const { documentValidator } = await import("../../convex/doc/validator");
      type Doc = typeof documentValidator.type;

      type ExpectedMetadata =
        | {
            lastModified?: string;
            author?: string;
            wordCount?: number;
            language?: string;
            etag?: string;
            sourceType?: string;
          }
        | undefined;

      expectTypeOf<Doc["metadata"]>().toEqualTypeOf<ExpectedMetadata>();
    });

    it("status is a strict discriminated union of string literals", async () => {
      const { documentValidator } = await import("../../convex/doc/validator");
      type Doc = typeof documentValidator.type;

      // Status is exactly the union of literals
      expectTypeOf<Doc["status"]>().toEqualTypeOf<
        "pending" | "processing" | "indexed" | "failed" | "stale" | "active" | "pending_embed"
      >();

      // A plain string is NOT assignable to status (narrower type check)
      expectTypeOf<string>().not.toMatchTypeOf<Doc["status"]>();
    });
  });

  describe("DocumentValidator type export", () => {
    it("matches typeof documentValidator.type", async () => {
      const { documentValidator } = await import("../../convex/doc/validator");
      type Doc = typeof documentValidator.type;
      expectTypeOf<Doc>().toEqualTypeOf<DocumentValidator>();
    });
  });
});
