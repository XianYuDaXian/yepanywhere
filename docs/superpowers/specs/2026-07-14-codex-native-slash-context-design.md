# Codex 原生 Slash 面板与上下文占用显示设计

Date: 2026-07-14

## 背景

当前部署继续使用本地修改版 `04cc45b`，不同步上游。

用户只用 Codex。当前 Web 端有两处体验差距：

1. slash 菜单只是文字命令列表，不像 Codex 原生命令面板。
2. 上下文主显示更像“本轮 input”，不是“当前上下文占用”。

目标：

1. 做完整 Codex 风格 slash 面板。
2. 动作尽量转给 Codex 进程执行。
3. 主显示上下文占用；详情再拆本轮 input / cache / total。

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

## 架构

### 组件边界

1. `CodexSlashPanel`
- 负责面板 UI、过滤、键盘导航、分区渲染。

2. `MessageInput` / `MessageInputToolbar`
- 负责检测 `/` 输入、打开关闭面板、把选中项交给动作层。

3. `SessionPage` / 会话控制层
- 负责把面板动作映射到 API：
  - 切模型
  - 切思考强度
  - 切计划模式
  - 打开会话信息
  - 触发 compact
  - 插入 skill

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

## 测试

### 自动化

1. slash 面板过滤
2. 内建项与技能分区渲染
3. 选择模型 / 推理 / 计划模式时调用正确动作，不插文本
4. 选择 skill 时插入 `$name`
5. 占用百分比使用 occupancy，不使用 turn input
6. 压缩后 `input_tokens = 0` 时占用回退正确
7. 详情字段包含 input / cache / total

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

## 实现顺序

1. 统一上下文占用数据模型
2. 改主显示与会话信息详情
3. 新增 `CodexSlashPanel`
4. 接入内建项动作
5. 接入技能区
6. 替换 Codex 会话默认 slash 入口
7. 补测试与手测

## 风险

1. 当前部署是旧 YA + Codex CLI `0.144.x`
- 部分进程动作可能不稳定
- 需要逐项降级，不能假设所有原生能力都在

2. “目标 / 记忆”可能没有完整协议
- 第一版允许占位或灰显

3. skill 点击默认插入 `$name`
- 与某些原生“立即启用”行为可能不完全一致
- 先保证可选、可见、可插入

## 验收清单

1. Codex 会话 slash 面板有内建项和技能区
2. 面板点选以动作执行为主，不是插 `/xxx` 文本
3. 上下文主显示为占用
4. 详情可看本轮 input / cache / total
5. 不同步上游
6. 只影响 Codex 路径
