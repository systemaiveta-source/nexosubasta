import { describe, expect, it } from "vitest";
import { groupPublications } from "./publication-groups";

const item = (id: string, status: string, extra: Partial<{ bid_count: number; winner_id: string | null; selection_pending: boolean }> = {}) => ({
  id, status, bid_count: 0, winner_id: null, selection_pending: false, ...extra,
});

describe("organización de publicaciones", () => {
  it("separa activas, programadas y borradores", () => {
    const groups = groupPublications([item("a", "active"), item("b", "scheduled"), item("c", "draft")]);
    expect(groups.current.map((x) => x.id)).toEqual(["a", "b"]);
    expect(groups.drafts.map((x) => x.id)).toEqual(["c"]);
    expect(groups.renewal).toEqual([]);
    expect(groups.history).toEqual([]);
  });

  it("mantiene las finalizadas sin ganador en pendientes de renovar", () => {
    const groups = groupPublications([item("a", "ended_unsold"), item("b", "ended_unsold", { bid_count: 2 })]);
    expect(groups.renewal.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("no confunde adjudicadas o en selección con pendientes de renovar", () => {
    const groups = groupPublications([
      item("a", "ended_sold", { winner_id: "buyer" }),
      item("b", "ended_unsold", { selection_pending: true }),
      item("c", "cancelled"),
    ]);
    expect(groups.history.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});
