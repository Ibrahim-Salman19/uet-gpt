import { v } from "convex/values";

export const userValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  clerkId: v.string(),
  name: v.string(),
  email: v.string(),
  imageUrl: v.optional(v.string()),
  role: v.union(v.literal("user"), v.literal("admin"), v.literal("superadmin")),
  isActive: v.boolean(),
  lastLoginAt: v.optional(v.number()),
  preferences: v.optional(
    v.object({
      theme: v.optional(v.string()),
      language: v.optional(v.string()),
      fontSize: v.optional(v.string()),
      model: v.optional(v.string()),
    }),
  ),
  metadata: v.optional(
    v.object({
      signupSource: v.optional(v.string()),
      lastFeatureUsed: v.optional(v.string()),
    }),
  ),
});

export type UserValidator = typeof userValidator.type;
