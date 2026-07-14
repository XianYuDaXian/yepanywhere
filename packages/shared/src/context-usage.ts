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

/**
 * Codex last_token_usage 中：
 * - input_tokens：本轮非缓存新增输入（通常很小）
 * - cached_input_tokens：缓存命中
 * - total_tokens：本轮上下文实际占用（主显示应使用它）
 * 压缩后常见 input_tokens=0，此时 total_tokens 仍代表占用。
 */
export function resolveCodexOccupancyTokens(
  snapshot: CodexTokenUsageSnapshot,
): number {
  const turnInputTokens = Math.max(0, snapshot.inputTokens ?? 0);
  const cacheReadTokens = Math.max(0, snapshot.cachedInputTokens ?? 0);
  const totalTokens = Math.max(0, snapshot.totalTokens ?? 0);

  if (totalTokens > 0) {
    return totalTokens;
  }

  // 兼容缺少 total 的旧快照
  const combined = turnInputTokens + cacheReadTokens;
  if (combined > 0) {
    return combined;
  }

  return turnInputTokens;
}

export namespace buildCodexContextUsage {
  export function fromTokenSnapshot(
    snapshot: CodexTokenUsageSnapshot,
    source: "live" | "persisted",
    fallbackWindow = 258_000,
  ): ContextUsageViewModel {
    const turnInputTokens = snapshot.inputTokens ?? 0;
    const totalTokens = snapshot.totalTokens ?? 0;
    const occupancyTokens = resolveCodexOccupancyTokens(snapshot);
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
