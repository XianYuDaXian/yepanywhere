# Codex 原生 Slash 面板、上下文占用与引导插队设计

Date: 2026-07-14

## 背景

当前部署继续使用本地修改版 `04cc45b`，不同步上游。

用户只用 Codex。当前 Web 端有三处体验差距：

1. slash 菜单只是文字命令列表，不像 Codex 原生命令面板。
2. 上下文主显示更像“本轮 input”，不是“当前上下文占用”。
3. 运行中消息发送语义不够清楚，缺少 Codex 原生“跟进行为”（排队 / 引导）与插队入口。

目标：

1. 做完整 Codex 风格 slash 面板。
2. 动作尽量转给 Codex 进程执行。
3. 主显示上下文占用；详情再拆本轮 input / cache / total。
4. 明确实现跟进行为（排队 / 引导）、单条反转，以及次级插队。

## 决策

### 路线

采用 **进程优先的完整 slash 面板**。

原因：

1. Codex app-server 不会直接返回原生 UI 面板。
2. 当前 Codex provider 仍是 `supportsSlashCommands = false`。
3. 进程侧已有部分可控动作：
   - 模型列表与切换
   - 计划模式 / collaboration
   - compact
   - rate limits / token usage
   - `turn/steer` 引导
   - interrupt 中断
   - deferred queue 排队
4. 面板必须由 YA 绘制。
5. 动作应尽量走进程/协议，而不是插入 `/xxx` 文本。

### 不做的事

1. 不同步上游。
2. 不嵌入 Codex 原生 UI 组件。
3. 不把“发 `/model` 文本给模型”当主路径。
4. 第一版不做 `@` 文件树补全。
5. 第一版不做完整记忆系统。

## 成功标准

1. 在 Codex 会话输入 `/` 或点击 `/` 按钮后，出现接近 Codex 的完整面板。
2. 面板包含内建项和技能区。
3. 点“模型 / 推理 / 计划模式 / compact / 状态”时，优先走进程或现有会话控制，不插命令文本。
4. 点技能时，可直接从面板选择，不需要先进入二级 `/skill` 再选。
5. 输入区主显示为上下文占用百分比。
6. 会话信息详情中能看到：
   - 上下文占用
   - 本轮 input
   - cache
   - total
7. Claude 会话行为不受影响。
8. 运行中发送语义明确：
   - 跟进行为可切换：排队 / 引导
   - `Ctrl+Shift` 对单条消息执行相反操作
   - 插队：先 `interrupt`，再立刻发新消息

## 架构

### 组件边界

1. `CodexSlashPanel`
- 负责面板 UI、过滤、键盘导航、分区渲染。

2. `MessageInput` / `MessageInputToolbar`
- 负责检测 `/` 输入、打开关闭面板、把选中项交给动作层。
- 负责运行中跟进行为开关、单条反转、插队入口。

3. `SessionPage` / 会话控制层
- 负责把面板动作映射到 API：
  - 切模型
  - 切思考强度
  - 切计划模式
  - 打开会话信息
  - 触发 compact
  - 插入 skill
  - 跟进行为（排队 / 引导）
  - 单条反转
  - 插队

4. `CodexProvider` / sessions 路由
- 负责进程侧动作与上下文占用数据口径。

5. `ProcessInfoModal`
- 负责展示占用详情和本轮 token 明细。

### 数据流

```text
用户输入 /
  -> MessageInput 打开 CodexSlashPanel
  -> 面板拉取内建项状态 + skills 列表
  -> 用户选择一项
  -> SessionPage 动作分发
      -> 能转进程：调用 process/session API
      -> 不能转进程：本地状态或明确占位
  -> UI 立即反映新状态
```

```text
Codex token/usage 事件或 session summary
  -> 统一成 ContextUsageViewModel
      occupancyTokens
      occupancyPercentage
      contextWindow
      turnInputTokens
      cacheReadTokens
      totalTokens
  -> 主显示用 occupancy*
  -> 详情弹层用全部字段
```

```text
运行中用户输入
  -> 跟进行为=引导：Process.queueMessage / steerFn -> turn/steer
  -> 跟进行为=排队：deferred queue -> 回合结束后发送
  -> Ctrl+Shift：本条走相反语义
  -> 插队：Process.interrupt -> 等待可发送 -> 立即发送
```

## Slash 完整面板

### 打开方式

1. 输入框输入 `/`
2. 点击工具栏 `/` 按钮

### 布局

上半：内建项  
下半：技能

过滤规则：

1. 输入 `/mo` 时同时过滤内建项和技能
2. 键盘上下选择
3. Enter 确认
4. Esc 关闭
5. 面板优先显示在输入框上方，空间不够时避让

### 内建项

| 项 | 展示 | 点击行为 | 执行优先级 |
|---|---|---|---|
| 推理 | 当前强度，如“高” | 切换思考强度 | 会话/进程状态 |
| 模型 | 当前模型名 | 切换模型 | 进程切模型；列表优先 app-server `model/list` |
| 状态 | 任务 ID、上下文、限额说明 | 打开会话信息 | 本地弹层 + 进程/协议数据 |
| 目标 | 当前目标摘要或占位 | 打开/设置目标 | 有协议则转进程；否则本地占位 |
| 计划模式 | 开/关 | 切换 planMode | 转进程 collaboration/plan |
| 记忆 | 当前状态或“暂不可用” | 灰显或说明 | 第一版不实现完整能力 |
| 压缩 | 可选内建项 | 触发 compact | 转 `thread/compact/start` |

### 技能区

数据来源：

1. 已有 `GET /projects/:projectId/codex/skills`
2. 扫描：
   - 项目 `.codex/skills`
   - 项目 `.agents/skills`
   - 用户 `~/.codex/skills`
   - 用户 plugins cache

每项展示：

1. 图标
2. 名称
3. 说明
4. 范围：个人 / 项目

点击行为：

1. 默认插入 `$skillName`
2. 若后续确认有更直接的进程启用接口，再改为直接启用
3. 不再要求先点 `/skill` 再进二级弹层

### 命令文本策略

主路径：

1. 面板点选直接执行动作

兼容路径：

1. 用户手动输入 `/compact` 这类命令时，仍可识别并执行
2. 但 UI 不再鼓励“先插文本再发送”的工作流

### 与现有实现的关系

替换：

1. Codex 会话中纯文字 `/model /compact ...` 菜单，不再作为默认入口

保留：

1. 现有模型切换
2. 思考强度切换
3. planMode 开关
4. compact API
5. skills API
6. 会话信息弹层
7. steer / interrupt / deferred queue 进程能力

## 上下文显示

### 主显示

位置：输入区上下文指示器

显示：

1. 圆环
2. 占用百分比

tooltip：

1. `上下文：12%（34.2K / 285.0K）`

含义：

1. 当前上下文占用
2. 不是本轮 fresh input

### 详情显示

位置：会话信息弹层

字段：

1. 上下文占用：已用 / 窗口
2. 本轮 input
3. cache read
4. total
5. 可选：压缩后占用

### 计算口径

统一输出 `ContextUsageViewModel`：

```ts
interface ContextUsageViewModel {
  occupancyTokens: number;
  occupancyPercentage: number;
  contextWindow: number;
  turnInputTokens?: number;
  cacheReadTokens?: number;
  totalTokens?: number;
  source: "live" | "persisted";
}
```

规则：

1. `contextWindow`
- 优先 `model_context_window`
- 否则回退模型默认窗口

2. `occupancyTokens`
- 优先使用能代表当前上下文填满量的字段
- 压缩后若 `input_tokens = 0`，回退到 total / 压缩后占用
- 不得只用本轮 fresh input 充当占用

3. `turnInputTokens`
- 最近一轮 fresh input
- 只进详情，不进主百分比

4. `cacheReadTokens`
- 最近一轮 cache read
- 只进详情

5. `totalTokens`
- 若协议提供 total，则展示
- 用于压缩后回退和详情核对

### 实时与落盘统一

当前问题：

1. 实时路径更偏本轮 input
2. 落盘路径在压缩后会回退 total

要求：

1. `extractContextUsageFromSDKMessages`
2. `codex-reader.extractContextUsage`

两处输出同一套字段语义，避免刷新前后百分比跳变。

## 跟进行为：排队 / 引导 / 插队

对齐 Codex 原生设置项“跟进行为”：

> 在运行时将后续指令加入队列，或引导当前运行。  
> 按 `Ctrl+Shift` 可对单条消息执行相反操作。

### 语义定义

| 名称 | 含义 | 进程动作 |
|---|---|---|
| 排队 | 运行中把后续指令加入队列，等当前回合结束后再发 | deferred queue |
| 引导 | 运行中把指令塞进当前回合，不中断当前工作 | `turn/steer` |
| 插队 | 停止当前回合，立刻开始处理新消息 | 先 `interrupt`，再立即发送 |

说明：

1. **排队 / 引导** 是“跟进行为”的两种默认模式，对应原生左右切换。
2. **插队** 不是跟进行为默认模式，而是额外的强打断动作。
3. 第一版以原生跟进行为为主：默认模式 + 单条反转。
4. 插队作为次级动作保留，不替代跟进行为开关。

### 现状基础

当前代码已有半成品：

1. Codex provider 已有 `steerFn`，内部走 `turn/steer`
2. `Process.queueMessage` 在 `in-turn` 时会先尝试 steer
3. 前端已有 deferred queue：
   - Ctrl+Enter
   - 排队按钮
4. 前端停止按钮会先 `interrupt`，失败再 abort

缺口：

1. 没有持久的“跟进行为”模式开关（排队 / 引导）
2. 运行中主发送没有按模式分流
3. 没有 `Ctrl+Shift` 单条反转
4. 插队不是一等入口

### 跟进行为模式

新增会话级偏好：

```ts
type FollowUpBehavior = "queue" | "steer";
```

规则：

1. 仅在 `in-turn` 时生效
2. 用户可在输入区切换：
   - 排队
   - 引导
3. 选择会记住，至少在当前会话内持久
4. 主发送按钮按当前模式执行

默认建议：

1. 默认模式：`queue`（排队）
2. 与截图中“排队 | 引导”控件一致

### 运行中发送规则

仅在会话状态为 `in-turn` 时启用：

1. **按模式发送（主路径）**
- 当前模式 = 排队：消息进入 deferred queue
- 当前模式 = 引导：走 `turn/steer`
- 引导成功：消息显示“已引导”
- 排队成功：消息显示“已排队”，可取消
- 引导失败：降级为排队，并 toast 说明

2. **单条反转：`Ctrl+Shift+Enter`**
- 对齐原生：对单条消息执行与当前模式相反的操作
- 当前是排队：这次改为引导
- 当前是引导：这次改为排队
- 只影响这一条，不永久改模式

3. **插队（次级动作）**
- 不作为跟进行为默认模式
- 入口：二级按钮 / 菜单
- 流程：
  1. `interrupt` 当前回合
  2. 等待进程回到可接收状态
  3. 立即发送新消息
- interrupt 失败时 toast 报错，不静默改成排队

### 空闲状态

会话不在 `in-turn` 时：

1. 跟进行为开关可保留展示，但主发送恢复为普通发送
2. 插队入口隐藏或禁用
3. 排队列表若仍有未发送项，继续展示并可取消

### 推荐 UI

对齐截图中的原生控件：

1. 输入区附近显示“跟进行为”
2. 右侧双选项：
   - 排队
   - 引导
3. 说明文案：
   - `在运行时将后续指令加入队列，或引导当前运行。按 Ctrl+Shift 可对单条消息执行相反操作。`
4. 主发送：
   - 运行中按当前跟进模式执行
5. 插队：
   - 放在次级入口，不抢跟进行为主控件

### 进程映射

```text
跟进行为 = 排队
  -> deferred queue
  -> 当前回合结束后自动发送

跟进行为 = 引导
  -> Process.queueMessage / steerFn
  -> Codex turn/steer

Ctrl+Shift 单条反转
  -> 仅本次消息走相反语义

插队
  -> Process.interrupt
  -> 等待可发送
  -> 立即 queueMessage / start turn
```

### 消息展示

1. 引导成功：用户消息旁显示“已引导”
2. 排队中：显示“已排队”，可取消
3. 单条反转成功：按实际结果标记“已引导”或“已排队”
4. 插队成功：用户消息旁显示“已插队”
5. steer 失败降级排队：toast + 消息状态改为“已排队”

## 错误处理

1. skills 拉取失败
- 技能区显示错误文案
- 内建项仍可用

2. 模型列表失败
- 回退本地已知模型列表
- 面板不整体关闭

3. compact 失败
- toast 报错
- 不清空输入框

4. 进程不在线
- 可本地改“待生效”状态的项允许先改
- 必须依赖活进程的项显示“会话未运行”

5. 记忆无接口
- 灰显
- 不假装可切换

6. 引导失败
- 降级为排队
- toast 说明“当前无法引导，已改为排队”

7. 插队失败
- 不自动改排队
- toast 说明中断失败原因
- 输入内容保留

8. 单条反转失败
- 保持原输入
- toast 说明失败原因
- 不偷偷改掉当前跟进行为模式

## 测试

### 自动化

1. slash 面板过滤
2. 内建项与技能分区渲染
3. 选择模型 / 推理 / 计划模式时调用正确动作，不插文本
4. 选择 skill 时插入 `$name`
5. 占用百分比使用 occupancy，不使用 turn input
6. 压缩后 `input_tokens = 0` 时占用回退正确
7. 详情字段包含 input / cache / total
8. 运行中发送：
   - 跟进行为=引导 时走 steer
   - 跟进行为=排队 时进入 deferred queue
   - Ctrl+Shift 单条反转
   - 插队先 interrupt 再发送
9. steer 失败时降级为排队

### 手测

1. Codex 会话输入 `/`，面板样式接近截图
2. `/mo` 能过滤模型与相关技能
3. 点模型可切换
4. 点推理可切换
5. 点计划模式可开关
6. 点状态打开会话信息
7. 点 skill 可直接选择
8. 主显示占用变化符合压缩前后预期
9. 详情中本轮 input 与占用不是同一个数时，两者同时可见
10. Claude 会话 slash 不变差
11. 跟进行为切换为“引导”后，运行中发送不中断当前回合
12. 跟进行为切换为“排队”后，运行中发送进入队列并可取消
13. `Ctrl+Shift` 可对单条消息执行相反操作
14. 运行中执行“插队”，当前回合停止后立即处理新消息
15. 空闲时主发送恢复普通发送

## 实现顺序

1. 统一上下文占用数据模型
2. 改主显示与会话信息详情
3. 新增 `CodexSlashPanel`
4. 接入内建项动作
5. 接入技能区
6. 替换 Codex 会话默认 slash 入口
7. 实现跟进行为开关、单条反转、插队入口与状态展示
8. 补测试与手测

## 风险

1. 当前部署是旧 YA + Codex CLI `0.144.x`
- 部分进程动作可能不稳定
- 需要逐项降级，不能假设所有原生能力都在

2. “目标 / 记忆”可能没有完整协议
- 第一版允许占位或灰显

3. skill 点击默认插入 `$name`
- 与某些原生“立即启用”行为可能不完全一致
- 先保证可选、可见、可插入

4. 插队依赖 interrupt 后的可发送时机
- 需要明确等待条件，避免 interrupt 后消息丢失

5. steer 在部分 CLI 版本上可能不稳定
- 必须保留失败降级到排队

6. 跟进行为模式需要会话内持久
- 避免每次运行中重新默认回某个模式

## 验收清单

1. Codex 会话 slash 面板有内建项和技能区
2. 面板点选以动作执行为主，不是插 `/xxx` 文本
3. 上下文主显示为占用
4. 详情可看本轮 input / cache / total
5. 不同步上游
6. 只影响 Codex 路径
7. 运行中可通过跟进行为切换排队 / 引导
8. `Ctrl+Shift` 可对单条消息反转
9. 引导失败会降级排队并提示
10. 插队失败不会静默改成排队
