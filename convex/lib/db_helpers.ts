/**
 * Count all rows in a table using the public .collect() API.
 * Slower than the native .count() (removed due to @ts-expect-error instability)
 * but fully type-safe. For O(1) counts, consider @convex-dev/aggregate.
 */
import type { GenericDatabaseReader, GenericDataModel } from "convex/server";

export async function fastCount<DataModel extends GenericDataModel>(
  db: GenericDatabaseReader<DataModel>,
  tableName: string,
): Promise<number> {
  const docs = await db.query(tableName).collect();
  return docs.length;
}
