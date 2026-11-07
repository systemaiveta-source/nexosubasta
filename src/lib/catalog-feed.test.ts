import { expect, it } from 'vitest';
import { uniqueAuctions, nextCatalogOffset } from './catalog-feed';
it('deduplicates overlapping batches by publication ID without changing order', () => {
  expect(uniqueAuctions([[{id:'a'},{id:'b'}],[{id:'b'},{id:'c'}]])).toEqual([{id:'a'},{id:'b'},{id:'c'}]);
});
it('loads only 24 rows at a time and stops at a short batch', () => {
  expect(nextCatalogOffset({items:Array(24),offset:24})).toBe(48);
  expect(nextCatalogOffset({items:Array(23),offset:48})).toBeUndefined();
});