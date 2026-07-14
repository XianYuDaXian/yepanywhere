import { describe, expect, it } from "vitest";
import {
  buildCodexContextUsage,
  type CodexTokenUsageSnapshot,
} from "@yep-anywhere/shared";

describe("buildCodexContextUsage", () => {
  it("uses occupancy tokens for percentage, not only turn input", () => {
    const usage = buildCodexContextUsage({
      contextWindow: 285_000,
      turnInputTokens: 1_900,
      cacheReadTokens: 12_000,
      totalTokens: 34_200,
      occupancyTokens: 34_200,
      source: "live",
    });

    expect(usage.occupancyTokens).toBe(34_200);
    expect(usage.percentage).toBe(12);
    expect(usage.inputTokens).toBe(34_200);
    expect(usage.turnInputTokens).toBe(1_900);
    expect(usage.cacheReadTokens).toBe(12_000);
    expect(usage.totalTokens).toBe(34_200);
    expect(usage.contextWindow).toBe(285_000);
  });

  it("falls back to total when turn input is 0 after compact", () => {
    const snapshot: CodexTokenUsageSnapshot = {
      inputTokens: 0,
      cachedInputTokens: 0,
      totalTokens: 8_500,
      modelContextWindow: 272_000,
    };
const usage = buildCodexContextUsage.fromTokenSnapshot(snapshot, "persisted");
    expect(usage.occupancyTokens).toBe(8_500);
    expect(usage.percentage).toBe(3);
    expect(usage.turnInputTokens).toBe(0);
  });

  it("keeps live and persisted occupancy semantics aligned after compact", () => {
    const live = buildCodexContextUsage.fromTokenSnapshot(
      { inputTokens: 0, totalTokens: 9200, modelContextWindow: 272000 },
      "live",
    );
    const persisted = buildCodexContextUsage.fromTokenSnapshot(
      { inputTokens: 0, totalTokens: 9200, modelContextWindow: 272000 },
      "persisted",
    );
    expect(live.percentage).toBe(persisted.percentage);
    expect(live.occupancyTokens).toBe(9200);
    expect(persisted.occupancyTokens).toBe(9200);
  });
});
