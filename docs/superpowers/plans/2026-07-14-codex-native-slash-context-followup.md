# Codex 原生 Slash、上下文占用与跟进行为 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在不同步上游的前提下，为 Codex 会话补齐完整 slash 面板、上下文占用主显示，以及可切换的跟进行为（排队 / 引导）与插队。

**架构：** 面板与跟进行为 UI 由 Web 端绘制；动作优先转 Codex 进程（`model/list`、`turn/steer`、`interrupt`、`thread/compact/start`、skills API）。上下文占用在 server 统一成 occupancy 口径，详情再拆本轮 input / cache / total。跟进行为是会话级可切换模式，默认排队，支持 `Ctrl+Shift` 单条反转。

**技术栈：** TypeScript、Hono server、React client、Vitest、现有 Codex app-server 协议子集

**规格：** `docs/superpowers/specs/2026-07-14-codex-native-slash-context-design.md`

---

## 文件结构

### 新建

- `packages/shared/src/context-usage.ts`  
  统一 `ContextUsageViewModel` 与占用计算辅助函数
- `packages/client/src/components/CodexSlashPanel.tsx`  
  Codex 风格完整 slash 面板
- `packages/client/src/components/FollowUpBehaviorControl.tsx`  
  跟进行为：`排队 | 引导` 开关
- `packages/client/src/lib/followUpBehavior.ts`  
  模式读写、单条反转语义
- `packages/client/src/components/__tests__/CodexSlashPanel.test.tsx`
- `packages/client/src/lib/__tests__/followUpBehavior.test.ts`
- `packages/server/test/sessions/codex-context-usage.test.ts`

### 修改

- `packages/shared/src/app-types.ts`  
  扩展 `ContextUsage` 字段，导出新类型
- `packages/shared/src/index.ts`  
  导出新模块
- `packages/server/src/routes/sessions.ts`  
  统一 live context usage 计算
- `packages/server/src/sessions/codex-reader.ts`  
  统一 persisted context usage 计算
- `packages/client/src/components/ContextUsageIndicator.tsx`  
  主显示 occupancy
- `packages/client/src/components/ProcessInfoModal.tsx`  
  详情展示 occupancy + turn input/cache/total
- `packages/client/src/components/MessageInput.tsx`  
  接入完整 slash 面板与跟进行为发送
- `packages/client/src/components/MessageInputToolbar.tsx`  
  运行中按钮与跟进行为控件
- `packages/client/src/components/SlashCommandButton.tsx`  
  Codex 路径改为打开完整面板，或降级兼容
- `packages/client/src/pages/SessionPage.tsx`  
  slash 动作分发、跟进行为发送、插队
- `packages/client/src/lib/storageKeys.ts`  
  增加 follow-up 模式存储键
- `packages/client/src/i18n/zh-CN.json`  
  以及 `en.json` 等必要文案
- `packages/client/src/styles/index.css`  
  面板与跟进行为样式

---

### 任务 1：统一上下文占用数据模型

**文件：**
- 创建：`packages/shared/src/context-usage.ts`
- 修改：`packages/shared/src/app-types.ts`
- 修改：`packages/shared/src/index.ts`
- 测试：`packages/server/test/sessions/codex-context-usage.test.ts`

- [ ] **步骤 1：先写失败测试，固定占用口径**

在 `packages/server/test/sessions/codex-context-usage.test.ts` 写入：

```ts
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
});
```

- [ ] **步骤 2：运行测试，确认失败**

运行：

```bash
pnpm --filter @yep-anywhere/server exec vitest run test/sessions/codex-context-usage.test.ts
```

预期：FAIL，提示 `buildCodexContextUsage` 不存在或导出缺失。

- [ ] **步骤 3：实现共享类型与计算**

`packages/shared/src/context-usage.ts`：

```ts
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

buildCodexContextUsage.fromTokenSnapshot = (
  snapshot: CodexTokenUsageSnapshot,
  source: "live" | "persisted",
  fallbackWindow = 258_000,
): ContextUsageViewModel => {
  const turnInputTokens = snapshot.inputTokens ?? 0;
  const totalTokens = snapshot.totalTokens ?? 0;
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
};
```

在 `app-types.ts` 的 `ContextUsage` 上增加可选字段：

```ts
turnInputTokens?: number;
totalTokens?: number;
occupancyTokens?: number;
occupancyPercentage?: number;
source?: "live" | "persisted";
```

并在 `packages/shared/src/index.ts` 导出 `context-usage`。

- [ ] **步骤 4：再跑测试，确认通过**

运行：

```bash
pnpm --filter @yep-anywhere/shared build
pnpm --filter @yep-anywhere/server exec vitest run test/sessions/codex-context-usage.test.ts
```

预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add packages/shared/src/context-usage.ts packages/shared/src/app-types.ts packages/shared/src/index.ts packages/server/test/sessions/codex-context-usage.test.ts
git commit -m "feat: 统一 Codex 上下文占用数据模型"
```

---

### 任务 2：把 live / persisted 路径接到统一口径

**文件：**
- 修改：`packages/server/src/routes/sessions.ts`
- 修改：`packages/server/src/sessions/codex-reader.ts`
- 测试：`packages/server/test/sessions/codex-context-usage.test.ts`

- [ ] **步骤 1：补一条“压缩后 live/persisted 一致”的测试**

```ts
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
```

- [ ] **步骤 2：改 `codex-reader.extractContextUsage`**

把现有：

```ts
const inputTokens =
  usage.input_tokens > 0 ? usage.input_tokens : usage.total_tokens;
```

改为调用 `buildCodexContextUsage.fromTokenSnapshot`，并返回完整字段。

- [ ] **步骤 3：改 `extractContextUsageFromSDKMessages` 的 Codex 分支**

Codex 路径不要再只返回 `usage.input_tokens`。

最少逻辑：

```ts
if (isCodexProvider) {
  const turnInputTokens = usage.input_tokens ?? 0;
  const cacheReadTokens =
    usage.cached_input_tokens ?? usage.cache_read_input_tokens ?? 0;
  const totalTokens =
    typeof usage.total_tokens === "number"
      ? usage.total_tokens
      : turnInputTokens + cacheReadTokens;
  const occupancyTokens = turnInputTokens > 0 ? turnInputTokens : totalTokens;
  if (occupancyTokens === 0) continue;
  return buildCodexContextUsage({
    contextWindow: contextWindowSize,
    occupancyTokens,
    turnInputTokens,
    cacheReadTokens,
    totalTokens,
    source: "live",
  });
}
```

注意：若当前 `usage` 类型没有 `total_tokens`，先安全读取：

```ts
const totalTokens =
  typeof (usage as { total_tokens?: number }).total_tokens === "number"
    ? (usage as { total_tokens?: number }).total_tokens
    : undefined;
```

- [ ] **步骤 4：跑相关测试**

```bash
pnpm --filter @yep-anywhere/server exec vitest run test/sessions/codex-context-usage.test.ts test/sessions/codex-reader-oss.test.ts
```

预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add packages/server/src/routes/sessions.ts packages/server/src/sessions/codex-reader.ts packages/server/test/sessions/codex-context-usage.test.ts
git commit -m "feat: Codex live/persisted 上下文占用口径对齐"
```

---

### 任务 3：前端主显示与会话信息详情

**文件：**
- 修改：`packages/client/src/components/ContextUsageIndicator.tsx`
- 修改：`packages/client/src/components/ProcessInfoModal.tsx`
- 修改：`packages/client/src/i18n/zh-CN.json`
- 修改：`packages/client/src/i18n/en.json`

- [ ] **步骤 1：主显示改成 occupancy 语义**

`ContextUsageIndicator` tooltip 使用：

```ts
const used = usage.occupancyTokens ?? usage.inputTokens;
const percent = usage.occupancyPercentage ?? usage.percentage;
```

tooltip 文案：

```text
上下文：{percent}%（{used} / {total}）
```

- [ ] **步骤 2：详情拆字段**

在 `ProcessInfoModal` 的 token 区增加：

1. 上下文占用
2. 本轮 input
3. cache read
4. total

旧的“只用 inputTokens 当占用”文案改掉。

- [ ] **步骤 3：补中英文案**

`zh-CN.json`：

```json
{
  "processInfoLabelContextOccupancy": "上下文占用",
  "processInfoLabelTurnInput": "本轮输入",
  "processInfoLabelCacheRead": "缓存读取",
  "processInfoLabelTotalTokens": "总计",
  "contextTooltipWithWindow": "上下文：{percentage}%（{used} / {total}）"
}
```

`en.json` 同步英文。

- [ ] **步骤 4：类型检查**

```bash
pnpm --filter @yep-anywhere/client exec tsc --noEmit
```

预期：无新增类型错误。

- [ ] **步骤 5：Commit**

```bash
git add packages/client/src/components/ContextUsageIndicator.tsx packages/client/src/components/ProcessInfoModal.tsx packages/client/src/i18n/zh-CN.json packages/client/src/i18n/en.json
git commit -m "feat: 上下文主显示占用并拆详情字段"
```

---

### 任务 4：跟进行为模式存储与单条反转

**文件：**
- 创建：`packages/client/src/lib/followUpBehavior.ts`
- 修改：`packages/client/src/lib/storageKeys.ts`
- 测试：`packages/client/src/lib/__tests__/followUpBehavior.test.ts`

- [ ] **步骤 1：写失败测试**

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_FOLLOW_UP_BEHAVIOR,
  invertFollowUpBehavior,
  resolveSendBehavior,
} from "../followUpBehavior";

describe("followUpBehavior", () => {
  it("defaults to queue", () => {
    expect(DEFAULT_FOLLOW_UP_BEHAVIOR).toBe("queue");
  });

  it("inverts single-message behavior without changing mode", () => {
    expect(invertFollowUpBehavior("queue")).toBe("steer");
    expect(invertFollowUpBehavior("steer")).toBe("queue");
  });

  it("uses mode for normal send and inverted mode for ctrl-shift", () => {
    expect(resolveSendBehavior("queue", { invertOnce: false })).toBe("queue");
    expect(resolveSendBehavior("queue", { invertOnce: true })).toBe("steer");
    expect(resolveSendBehavior("steer", { invertOnce: true })).toBe("queue");
  });
});
```

- [ ] **步骤 2：运行失败**

```bash
pnpm --filter @yep-anywhere/client exec vitest run src/lib/__tests__/followUpBehavior.test.ts
```

预期：FAIL

- [ ] **步骤 3：实现模式库**

`packages/client/src/lib/followUpBehavior.ts`：

```ts
export type FollowUpBehavior = "queue" | "steer";

export const DEFAULT_FOLLOW_UP_BEHAVIOR: FollowUpBehavior = "queue";

export function invertFollowUpBehavior(
  mode: FollowUpBehavior,
): FollowUpBehavior {
  return mode === "queue" ? "steer" : "queue";
}

export function resolveSendBehavior(
  mode: FollowUpBehavior,
  options?: { invertOnce?: boolean },
): FollowUpBehavior {
  return options?.invertOnce ? invertFollowUpBehavior(mode) : mode;
}
```

`storageKeys.ts` 增加：

```ts
followUpBehavior: "follow-up-behavior",
```

再补 `loadFollowUpBehavior()` / `saveFollowUpBehavior()`，用现有 scoped storage helper。

- [ ] **步骤 4：测试通过并 Commit**

```bash
pnpm --filter @yep-anywhere/client exec vitest run src/lib/__tests__/followUpBehavior.test.ts
git add packages/client/src/lib/followUpBehavior.ts packages/client/src/lib/storageKeys.ts packages/client/src/lib/__tests__/followUpBehavior.test.ts
git commit -m "feat: 跟进行为模式与单条反转语义"
```

---

### 任务 5：跟进行为 UI 与运行中发送分流

**文件：**
- 创建：`packages/client/src/components/FollowUpBehaviorControl.tsx`
- 修改：`packages/client/src/components/MessageInput.tsx`
- 修改：`packages/client/src/components/MessageInputToolbar.tsx`
- 修改：`packages/client/src/pages/SessionPage.tsx`
- 修改：`packages/client/src/styles/index.css`
- 修改：`packages/client/src/i18n/zh-CN.json`
- 修改：`packages/client/src/i18n/en.json`

- [ ] **步骤 1：实现 `FollowUpBehaviorControl`**

控件要求：

1. 标题：跟进行为
2. 双选项：`排队 | 引导`
3. 说明：`在运行时将后续指令加入队列，或引导当前运行。按 Ctrl+Shift 可对单条消息执行相反操作。`
4. 模式可切换，切换后立刻保存

- [ ] **步骤 2：MessageInput 键盘语义**

运行中：

1. `Enter`：按当前跟进模式发送
2. `Ctrl+Shift+Enter`：本条反转
3. 现有排队按钮继续可用
4. 增加次级“插队”动作入口

伪代码：

```ts
if (isRunning && e.key === "Enter" && !e.nativeEvent.isComposing) {
  if (e.ctrlKey && e.shiftKey) {
    onSendWithBehavior(resolveSendBehavior(mode, { invertOnce: true }));
    return;
  }
  if (!e.shiftKey) {
    onSendWithBehavior(mode);
    return;
  }
}
```

- [ ] **步骤 3：SessionPage 发送分流**

```ts
async function sendWhileRunning(text: string, behavior: FollowUpBehavior | "barge-in") {
  if (behavior === "queue") {
    await handleQueue(text);
    return;
  }
  if (behavior === "steer") {
    // 现有 queueMessage 在 in-turn 时会优先 steer
    await handleSend(text, { preferSteer: true });
    return;
  }
  // barge-in
  await api.interruptProcess(processId);
  await waitUntilAcceptingInput();
  await handleSend(text, { forceImmediate: true });
}
```

`waitUntilAcceptingInput()` 用现有 process state / SSE，超时后 toast，不丢输入。

- [ ] **步骤 4：消息状态展示**

1. 引导成功：已引导
2. 排队：已排队，可取消
3. 插队：已插队

- [ ] **步骤 5：类型检查 + Commit**

```bash
pnpm --filter @yep-anywhere/client exec tsc --noEmit
git add packages/client/src/components/FollowUpBehaviorControl.tsx packages/client/src/components/MessageInput.tsx packages/client/src/components/MessageInputToolbar.tsx packages/client/src/pages/SessionPage.tsx packages/client/src/styles/index.css packages/client/src/i18n/zh-CN.json packages/client/src/i18n/en.json
git commit -m "feat: Codex 跟进行为排队引导与插队入口"
```

---

### 任务 6：完整 CodexSlashPanel

**文件：**
- 创建：`packages/client/src/components/CodexSlashPanel.tsx`
- 修改：`packages/client/src/components/MessageInput.tsx`
- 修改：`packages/client/src/components/SlashCommandButton.tsx`
- 修改：`packages/client/src/pages/SessionPage.tsx`
- 修改：`packages/client/src/styles/index.css`
- 测试：`packages/client/src/components/__tests__/CodexSlashPanel.test.tsx`

- [ ] **步骤 1：写面板过滤测试**

```ts
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CodexSlashPanel } from "../CodexSlashPanel";

it("filters builtin items and skills together", async () => {
  render(
    <CodexSlashPanel
      query="mo"
      builtins={[
        { id: "model", title: "模型", subtitle: "gpt-5.3-codex" },
        { id: "reasoning", title: "推理", subtitle: "高" },
      ]}
      skills={[
        { name: "model-router", description: "路由模型", scope: "user" },
        { name: "browser", description: "浏览", scope: "user" },
      ]}
      onSelectBuiltin={() => {}}
      onSelectSkill={() => {}}
      onClose={() => {}}
    />,
  );
  expect(screen.getByText("模型")).toBeInTheDocument();
  expect(screen.getByText("model-router")).toBeInTheDocument();
  expect(screen.queryByText("browser")).not.toBeInTheDocument();
});
```

- [ ] **步骤 2：实现面板结构**

上半内建项：

1. 推理
2. 模型
3. 状态
4. 目标
5. 计划模式
6. 记忆（可灰显）
7. 压缩

下半技能：

1. 名称
2. 说明
3. 范围

交互：

1. 键盘上下
2. Enter 确认
3. Esc 关闭
4. 自动避让

- [ ] **步骤 3：动作映射**

在 `SessionPage`：

```ts
switch (itemId) {
  case "model":
    openModelPicker();
    break;
  case "reasoning":
    openReasoningPicker();
    break;
  case "status":
    setShowProcessInfoModal(true);
    break;
  case "plan":
    setCodexPlanMode(v => !v);
    break;
  case "compact":
    await api.compactSession(projectId, sessionId);
    break;
  case "skill":
    appendToDraft(`$${skillName}`);
    break;
}
```

主路径不要再插入 `/model` 文本。

- [ ] **步骤 4：替换 Codex 默认 slash 入口**

1. 输入 `/` 打开 `CodexSlashPanel`
2. 工具栏 `/` 也打开同一面板
3. 旧纯文字命令列表仅作非 Codex 路径保留

- [ ] **步骤 5：测试 + Commit**

```bash
pnpm --filter @yep-anywhere/client exec vitest run src/components/__tests__/CodexSlashPanel.test.tsx
pnpm --filter @yep-anywhere/client exec tsc --noEmit
git add packages/client/src/components/CodexSlashPanel.tsx packages/client/src/components/__tests__/CodexSlashPanel.test.tsx packages/client/src/components/MessageInput.tsx packages/client/src/components/SlashCommandButton.tsx packages/client/src/pages/SessionPage.tsx packages/client/src/styles/index.css
git commit -m "feat: Codex 完整 slash 面板"
```

---

### 任务 7：端到端手测与回归

**文件：**
- 不强制改代码，必要时修 bug

- [ ] **步骤 1：本地或 192.168.1.41 启动当前修改版**

```bash
# 远程若继续用现有 systemd：
systemctl --user restart yepanywhere.service
```

- [ ] **步骤 2：按清单手测**

1. `/` 面板有内建项 + 技能区
2. 点模型 / 推理 / 计划 / 状态 / 压缩有效
3. 点 skill 直接插入 `$name`
4. 主显示是占用，不是本轮 1.9K 误导值
5. 详情能看到本轮 input / cache / total
6. 跟进行为可切换排队 / 引导
7. `Ctrl+Shift+Enter` 单条反转
8. 插队会中断后立即发送
9. Claude 会话 slash 不变差

- [ ] **步骤 3：最终类型检查与测试**

```bash
pnpm --filter @yep-anywhere/shared build
pnpm --filter @yep-anywhere/client exec tsc --noEmit
pnpm --filter @yep-anywhere/server exec tsc --noEmit
pnpm --filter @yep-anywhere/client exec vitest run src/lib/__tests__/followUpBehavior.test.ts src/components/__tests__/CodexSlashPanel.test.tsx
pnpm --filter @yep-anywhere/server exec vitest run test/sessions/codex-context-usage.test.ts
```

- [ ] **步骤 4：如有修复，单独 commit**

```bash
git add <fixed-files>
git commit -m "fix: Codex slash/跟进/上下文回归问题"
```

---

## 自检

### 规格覆盖

1. 完整 slash 面板：任务 6  
2. 进程优先动作：任务 6  
3. 上下文占用主显示：任务 1-3  
4. 详情 input/cache/total：任务 3  
5. 跟进行为可切换：任务 4-5  
6. `Ctrl+Shift` 单条反转：任务 4-5  
7. 插队次级动作：任务 5  
8. 不同步上游：全任务默认在 `04cc45b` 基线  

### 风险控制

1. steer 失败必须降级排队  
2. interrupt 失败不得静默变排队  
3. 记忆项可灰显  
4. 目标项可占位  

---

## 执行方式

计划完成后有两种执行方式：

1. **子代理驱动（推荐）**  
   每任务一个新子代理，任务间审查

2. **内联执行**  
   当前会话按任务推进，设检查点
