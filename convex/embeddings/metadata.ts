export function enrichHeadingPath(headingPath: string[] | undefined): string {
  if (!headingPath || headingPath.length === 0) return "";
  return `Section: ${headingPath.join(" > ")}`;
}

export function buildHeadingContextLabel(headingPath: string[] | undefined): string | undefined {
  if (!headingPath || headingPath.length === 0) return undefined;
  return headingPath.join(" > ");
}

export function enrichResultsWithHeadings<T extends { headingPath?: string[] }>(
  results: T[],
): (T & { headingLabel: string })[] {
  return results.map((r) => ({
    ...r,
    headingLabel: enrichHeadingPath(r.headingPath),
  }));
}
