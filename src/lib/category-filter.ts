export function categoryMatchesPreference(
  selectedCategoryIds: readonly string[],
  auctionCategoryId: string | null,
) {
  return selectedCategoryIds.length === 0 ||
    (auctionCategoryId !== null && selectedCategoryIds.includes(auctionCategoryId));
}

export function toggleCategorySelection(
  selectedCategoryIds: readonly string[],
  categoryId: string,
  checked: boolean,
  allCategoryIds: readonly string[],
) {
  const selected = selectedCategoryIds.length
    ? [...selectedCategoryIds]
    : [...allCategoryIds];
  const next = checked
    ? [...new Set([...selected, categoryId])]
    : selected.filter((id) => id !== categoryId);
  return next.length === allCategoryIds.length &&
    allCategoryIds.every((id) => next.includes(id))
    ? []
    : next;
}

export function toggleCategoryGroup(
  selectedCategoryIds: readonly string[],
  groupIds: readonly string[],
  checked: boolean,
  allCategoryIds: readonly string[],
) {
  const selected = selectedCategoryIds.length
    ? [...selectedCategoryIds]
    : [...allCategoryIds];
  const group = new Set(groupIds);
  const next = checked
    ? [...new Set([...selected, ...groupIds])]
    : selected.filter((id) => !group.has(id));
  return next.length === allCategoryIds.length &&
    allCategoryIds.every((id) => next.includes(id))
    ? []
    : next;
}
