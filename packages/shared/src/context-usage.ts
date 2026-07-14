export interface ContextUsageViewModel {
  /** 主显示：当前上下文占用 token */
  occupancyTokens: number;
  /** 主显示：占用百分比 */
  occupancyPercentage: number;
  /** 兼容旧字段：与 occupancyTokens 相同 */
  inputTokens: number;
  /** 兼容旧字段：与 occupancyPercentage 相同 */
  percentage: number;
  contextWindow: number;
  turnInputTokens?: number;
  cacheReadTokens?: number;
  totalTokens?: number;
  source: "live" | "persisted";
}

export interface CodexTokenUsageSnapshot {
  inputTokens?: number;
  cachedInputTokens?: number;
  totalTokens?: number;
  modelContextWindow?: number;
}

export function buildCodexContextUsage(input: {
  contextWindow: number;
  occupancyTokens: number;
  turnInputTokens?: number;
  cacheReadTokens?: number;
  totalTokens?: number;
  source: "live" | "persisted";
}): ContextUsageViewModel {
  const contextWindow = Math.max(1, input.contextWindow);
  const occupancyTokens = Math.max(0, input.occupancyTokens);
  const percentage = Math.min(
    100,
    Math.round((occupancyTokens / contextWindow) * 100),
  );
  return {
    occupancyTokens,
    occupancyPercentage: percentage,
    inputTokens: occupancyTokens,
    percentage,
    contextWindow,
    turnInputTokens: input.turnInputTokens,
    cacheReadTokens: input.cacheReadTokens,
    totalTokens: input.totalTokens,
    source: input.source,
  };
}

export namespace buildCodexContextUsage {
  export function fromTokenSnapshot(
    snapshot: CodexTokenUsageSnapshot,
    source: "live" | "persisted",
    fallbackWindow = 258_000,
  ): ContextUsageViewModel {
    const turnInputTokens = snapshot.inputTokens ?? 0;
    const totalTokens = snapshot.totalTokens ?? 0;
    // 压缩后 turn input 可能为 0，此时回退到 total 作为占用口径
    const occupancyTokens =
      turnInputTokens > 0 ? turnInputTokens : totalTokens;
    return buildCodexContextUsage({
      contextWindow: snapshot.modelContextWindow || fallbackWindow,
      occupancyTokens,
      turnInputTokens,
      cacheReadTokens: snapshot.cachedInputTokens,
      totalTokens,
      source,
    });
  }
}
