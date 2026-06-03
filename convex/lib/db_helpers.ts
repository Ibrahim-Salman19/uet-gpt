/**
 * Fast table count using Convex's native .count() API.
 * Only works on full tables (no .filter()/.withIndex()).
 * Uses @ts-expect-error because .count() is not in public types
 * but is used internally by Convex dashboard (tableSize.ts syscall).
 * GitHub: convex/issues/10 — confirmed stable.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fastCount(db: any, tableName: string): Promise<number> {
  return await db.query(tableName).count();
}
