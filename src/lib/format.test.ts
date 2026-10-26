import { describe, it, expect } from "vitest";
import { minNextBid, timeLeft } from "./format";

describe("minNextBid", () => {
  it("first bid must be at least the starting price", () => {
    expect(minNextBid(100, null, 5)).toBe(100);
  });
  it("next bid is current price plus minimum increment", () => {
    expect(minNextBid(100, 230, 5)).toBe(235);
  });
});

describe("timeLeft", () => {
  it("shows finished when time is up", () => {
    expect(timeLeft(new Date(1000).toISOString(), 2000)).toBe("Finalizada");
  });
  it("shows seconds in the last minute", () => {
    expect(timeLeft(new Date(61_000).toISOString(), 30_000)).toBe("0m 31s");
  });
});
