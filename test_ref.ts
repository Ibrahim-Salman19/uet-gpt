import { api } from "./convex/_generated/api.js";
import { getFunctionName } from "convex/server";

console.log("api:", api);
console.log("api.users.getByClerkId:", api.users.getByClerkId);
try {
  console.log("String(api.users.getByClerkId):", String(api.users.getByClerkId));
} catch (e) {
  console.error("String coercion failed:", e.message);
}

try {
  console.log("getFunctionName:", getFunctionName(api.users.getByClerkId));
} catch(e) {
  console.error("getFunctionName failed:", e.message);
}
