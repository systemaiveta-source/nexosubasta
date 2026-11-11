export type PublicationGroupItem = {
  status: string;
  bid_count: number;
  winner_id: string | null;
  selection_pending: boolean;
};

export function groupPublications<T extends PublicationGroupItem>(items: readonly T[]) {
  const current: T[] = [];
  const drafts: T[] = [];
  const renewal: T[] = [];
  const history: T[] = [];

  for (const item of items) {
    if (item.status === "active" || item.status === "scheduled") current.push(item);
    else if (item.status === "draft") drafts.push(item);
    else if (item.status === "ended_unsold" && !item.winner_id && !item.selection_pending)
      renewal.push(item);
    else history.push(item);
  }

  return { current, drafts, renewal, history };
}
