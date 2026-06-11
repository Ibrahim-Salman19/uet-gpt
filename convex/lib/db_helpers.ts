/**
 * Count all rows in a table using the iterator API (O(1) memory).
 * Uses .paginate() internally for efficient counting without loading all rows.
 */
import type { GenericDatabaseReader, GenericDataModel } from "convex/server";

export async function fastCount<DataModel extends GenericDataModel>(
  db: GenericDatabaseReader<DataModel>,
  tableName: string,
): Promise<number> {
  let count = 0;
  let cursor: string | null = null;
  let done = false;
  while (!done) {
    const page = await db.query(tableName).paginate({ numItems: 1000, cursor });
    count += page.page.length;
    done = page.isDone;
    cursor = page.continueCursor;
  }
  return count;
}

/**
 * Count rows matching a filtered query using pagination (O(1) memory).
 * @param queryFn - Function that returns a query with filters applied
 */
export async function fastFilteredCount(
  queryFn: () => {
    paginate: (opts: {
      numItems: number;
      cursor: string | null;
    }) => Promise<{ page: unknown[]; isDone: boolean; continueCursor: string }>;
  },
): Promise<number> {
  let count = 0;
  let cursor: string | null = null;
  let done = false;
  while (!done) {
    const page = await queryFn().paginate({ numItems: 1000, cursor });
    count += page.page.length;
    done = page.isDone;
    cursor = page.continueCursor;
  }
  return count;
}
