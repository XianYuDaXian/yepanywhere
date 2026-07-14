# 跟进消息编辑与状态切换设计

日期：2026-07-14  
分支：`feat/codex-slash-context-followup`  
状态：已确认（方案 A）

## 背景

Codex 运行中发送支持：

- **排队（queue）**：进入服务端 `deferredQueue`，当前回合结束后再发
- **引导（steer）**：立即注入当前 turn
- **插队（barge-in）**：中断后立即发送

现状：

- 排队消息仅展示 `Queued`，只支持取消
- 引导消息一旦发出，变成普通用户消息
- 两者都不支持改文案、改状态

用户确认采用 **方案 A**：统一跟进卡片 + 排队全能力 + 引导短窗口。

## 目标

1. 排队消息可编辑文案
2. 排队消息可改为「立即引导」
3. 排队消息可取消
4. 刚发出的引导在短窗口内尽量可取消
5. 引导确认后只读，提供「再发一条修正」

## 非目标

1. 不从 Codex turn 撤回已注入内容
2. 不改写历史 JSONL 用户消息
3. 不把 barge-in 并进同一张卡
4. 不改桌面原生 slash 协议

## 状态机

```text
queued
  ├── 编辑文案 → queued
  ├── 改状态「立即引导」→ steering → sent
  └── 取消 → 消失

steering
  ├── 注入成功 → sent
  └── 取消成功 → 消失
      取消失败（已注入）→ sent

sent
  └── 「再发一条修正」→ 填回输入框，不改历史
```

## 数据模型

扩展 deferred 摘要：

```ts
type FollowUpStatus = "queued" | "steering" | "sent";

interface FollowUpMessageSummary {
  tempId: string;
  content: string;
  timestamp: string;
  status: FollowUpStatus;
  /** 仅 steering/sent 有 */
  behavior?: "queue" | "steer";
}
```

说明：

- `queued` 继续走现有 `deferredQueue`
- `steering` / `sent` 为短生命周期 UI 状态，进程内存维护
- SSE `deferred-queue` 事件改为下发上述摘要列表

## API

### 已有

- `POST /sessions/:sessionId/messages` + `deferred: true`：入队
- `DELETE /sessions/:sessionId/deferred/:tempId`：取消排队

### 新增

1. `PATCH /sessions/:sessionId/deferred/:tempId`  
   body: `{ content: string }`  
   仅 `queued` 可改。返回更新后的摘要。

2. `POST /sessions/:sessionId/deferred/:tempId/steer`  
   将 `queued` 提升为立即引导：  
   - 从 deferred 队列移除  
   - 调现有 `queueMessage` / `steerFn` 路径  
   - 状态先 `steering`，成功后 `sent`

3. `DELETE /sessions/:sessionId/deferred/:tempId`  
   扩展语义：  
   - `queued`：删除队列项  
   - `steering`：若尚未注入则取消；已注入返回 409  
   - `sent`：返回 409

## 服务端改动

文件焦点：

- `packages/server/src/supervisor/Process.ts`
- `packages/server/src/routes/sessions.ts`
- `packages/server/src/supervisor/types.ts`（如有事件类型）

要点：

1. `deferredQueue` 保留 `UserMessage + timestamp`
2. 增加 `followUpStateByTempId` 记录 `steering/sent`
3. `getDeferredQueueSummary()` 合并 queued + 近期 steering/sent
4. `sent` 条目保留短时间（例如 2 分钟）后清理，避免列表堆积
5. 编辑只改 `message.text`，不改 `tempId`
6. 提升 steer 时复用现有 attachment/text 展开逻辑

## 前端改动

文件焦点：

- `packages/client/src/components/MessageList.tsx`
- `packages/client/src/hooks/useSession.ts`
- `packages/client/src/api/client.ts`
- `packages/client/src/pages/SessionPage.tsx`
- 样式 `packages/client/src/styles/index.css`

### 卡片 UI

**queued**

- 文案可点编辑（textarea）
- 分段：`排队 | 立即引导`
- 按钮：保存 / 取消

**steering**

- 状态文案：引导中
- 按钮：取消（可能失败）

**sent**

- 状态文案：已引导
- 按钮：再发一条修正  
  行为：把内容填回 `MessageInput`，不删除历史

### 移动端

- 卡片全宽
- 编辑态不挤压输入区主按钮
- 操作按钮可点区域 ≥ 44px

## 交互细节

1. 编辑保存失败：保留编辑态并 toast
2. 排队 → 引导失败：回到 `queued`，toast 原因
3. 多条排队：仍按顺序显示 `Queued (next)` / `#n`
4. 刷新/重连：仅恢复仍在服务端的 `queued`；`steering/sent` 以 SSE 内存状态为准，进程还在则可恢复
5. 「再发一条修正」不自动发送，只填输入框

## 验收

1. 运行中排队 → 编辑文案 → 重连后文案仍在  
2. 排队改「立即引导」→ 卡片变为引导中/已发送，内容进入当前 turn  
3. 排队可取消  
4. 已发送只读，可「再发一条修正」  
5. 移动端卡片布局正常  
6. 不影响空闲发送与 barge-in

## 实现顺序

1. 服务端：编辑 / 提升 steer / 状态摘要
2. 前端 API + SSE 类型
3. MessageList 卡片交互
4. SessionPage 接线与「再发一条修正」
5. 移动端样式
6. 手工验收

## 关联问题（并行修复）

上下文占用刷新后变 0%：

- 根因：Codex `last_token_usage.input_tokens` 只是本轮非缓存增量
- 真实占用应使用 `last_token_usage.total_tokens`（约等于 input + cached）
- 该问题在实现本设计前单独修复，避免刷新后 UI 失真
