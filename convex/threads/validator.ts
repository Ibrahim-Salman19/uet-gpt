import { v } from "convex/values";

export const threadValidator = v.object({
  _id: v.string(),
  _creationTime: v.number(),
  userId: v.string(),
  title: v.optional(v.string()),
  isArchived: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export type ThreadValidator = typeof threadValidator.type;
