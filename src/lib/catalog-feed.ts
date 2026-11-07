export const CATALOG_BATCH_SIZE = 24;
export function uniqueAuctions<T extends { id: string }>(pages: T[][]): T[] {
  const seen = new Set<string>();
  return pages.flat().filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
export function nextCatalogOffset(last: { items: unknown[]; offset: number }) {
  return last.items.length === CATALOG_BATCH_SIZE ? last.offset + CATALOG_BATCH_SIZE : undefined;
}