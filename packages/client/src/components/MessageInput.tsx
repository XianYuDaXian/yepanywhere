import type {
  EffortLevel,
  ModelInfo,
  ProviderName,
  ThinkingMode,
  ThinkingOption,
  UploadedFile,
} from "@yep-anywhere/shared";
import {
  type ClipboardEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ENTER_SENDS_MESSAGE } from "../constants";
import {
  type DraftControls,
  useDraftPersistence,
} from "../hooks/useDraftPersistence";
import { useI18n } from "../i18n";
import { hasCoarsePointer } from "../lib/deviceDetection";
import type { ContextUsage, PermissionMode } from "../types";
import {
  CodexSlashPanel,
  type CodexSlashBuiltinId,
  type CodexSlashBuiltinItem,
  type CodexSlashSkillItem,
} from "./CodexSlashPanel";
import { MessageInputToolbar } from "./MessageInputToolbar";
import type { VoiceInputButtonRef } from "./VoiceInputButton";
import { FollowUpBehaviorControl } from "./FollowUpBehaviorControl";
import {
  type FollowUpBehavior,
  loadFollowUpBehavior,
  resolveSendBehavior,
  saveFollowUpBehavior,
} from "../lib/followUpBehavior";

/** Progress info for an in-flight upload */
export interface UploadProgress {
  fileId: string;
  fileName: string;
  bytesUploaded: number;
  totalBytes: number;
  percent: number;
}

/** Format file size in human-readable form */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function isImageAttachment(file: UploadedFile): boolean {
  return file.mimeType.startsWith("image/");
}

function getAttachmentPreviewUrl(
  projectId: string | undefined,
  sessionId: string | undefined,
  file: UploadedFile,
): string | null {
  if (!projectId || !sessionId || !isImageAttachment(file)) return null;
  return `/api/projects/${projectId}/sessions/${sessionId}/upload/${encodeURIComponent(file.name)}`;
}

interface SlashQueryState {
  query: string;
  start: number;
  end: number;
}

function getSlashQueryState(
  value: string,
  selectionStart: number | null,
): SlashQueryState | null {
  if (selectionStart === null) return null;
  const beforeCursor = value.slice(0, selectionStart);
  const match = /(?:^|\s)\/([A-Za-z0-9-]*)$/.exec(beforeCursor);
  if (!match || match.index === undefined) {
    return null;
  }
  const fullMatch = match[0] ?? "";
  const slashOffset = fullMatch.lastIndexOf("/");
  const start = match.index + slashOffset;
  return {
    query: match[1] ?? "",
    start,
    end: selectionStart,
  };
}

interface Props {
  onSend: (
    text: string,
    options?: { behavior?: FollowUpBehavior | "barge-in" },
  ) => void;
  /** Queue a deferred message (sent when agent's turn ends). Only provided when agent is running. */
  onQueue?: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  mode?: PermissionMode;
  onModeChange?: (mode: PermissionMode) => void;
  provider?: ProviderName;
  isHeld?: boolean;
  onHoldChange?: (held: boolean) => void;
  isRunning?: boolean;
  isThinking?: boolean;
  onStop?: () => void;
  draftKey: string; // localStorage key for draft persistence
  /** Collapse to single-line but keep visible and focusable (for when approval panel is showing) */
  collapsed?: boolean;
  /** Callback to receive draft controls for success/failure handling */
  onDraftControlsReady?: (controls: DraftControls) => void;
  /** Context usage for displaying usage indicator */
  contextUsage?: ContextUsage;
  /** 点击上下文指示器后打开会话详情 */
  onContextUsageClick?: () => void;
  /** Project ID for uploads (required to enable attach button) */
  projectId?: string;
  /** Session ID for uploads (required to enable attach button) */
  sessionId?: string;
  /** Completed file attachments */
  attachments?: UploadedFile[];
  /** Callback when user selects files to attach */
  onAttach?: (files: File[]) => void;
  /** Callback when user removes an attachment */
  onRemoveAttachment?: (id: string) => void;
  /** Progress info for in-flight uploads */
  uploadProgress?: UploadProgress[];
  /** Whether the provider supports permission modes (default: true) */
  supportsPermissionMode?: boolean;
  /** Whether the provider supports thinking toggle (default: true) */
  supportsThinkingToggle?: boolean;
  onThinkingClick?: () => void;
  thinkingMode?: ThinkingMode;
  effortLevel?: EffortLevel;
  currentModel?: string;
  onModelClick?: () => void;
  modelOptions?: ModelInfo[];
  onModelChange?: (model: string) => void;
  planMode?: boolean;
  onPlanModeToggle?: () => void;
  onThinkingChange?: (value: ThinkingOption) => void;
  /** Available slash commands (without "/" prefix) */
  slashCommands?: string[];
  /** Callback for custom client-side commands (e.g., "model"). Return true if handled. */
  onCustomCommand?: (command: string) => boolean;
  /** Codex 完整 slash 面板数据与动作；提供时替换纯文字命令列表 */
  codexSlashPanel?: {
    builtins: CodexSlashBuiltinItem[];
    skills: CodexSlashSkillItem[];
    loadingSkills?: boolean;
    onSelectBuiltin: (id: CodexSlashBuiltinId) => void;
    onSelectSkill: (name: string) => void;
  };
}

export function MessageInput({
  onSend,
  onQueue,
  disabled,
  placeholder,
  mode = "default",
  onModeChange,
  provider,
  isHeld,
  onHoldChange,
  isRunning,
  isThinking,
  onStop,
  draftKey,
  collapsed: externalCollapsed,
  onDraftControlsReady,
  contextUsage,
  onContextUsageClick,
  projectId,
  sessionId,
  attachments = [],
  onAttach,
  onRemoveAttachment,
  uploadProgress = [],
  supportsPermissionMode = true,
  supportsThinkingToggle = true,
  onThinkingClick,
  thinkingMode,
  effortLevel,
  currentModel,
  onModelClick,
  modelOptions,
  onModelChange,
  planMode,
  onPlanModeToggle,
  onThinkingChange,
  slashCommands = [],
  onCustomCommand,
  codexSlashPanel,
}: Props) {
  const { t } = useI18n();
  const [text, setText, controls] = useDraftPersistence(draftKey);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voiceButtonRef = useRef<VoiceInputButtonRef>(null);
  // User-controlled collapse state (independent of external collapse from approval panel)
  const [userCollapsed, setUserCollapsed] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [slashQueryState, setSlashQueryState] = useState<SlashQueryState | null>(
    null,
  );
  // Codex 运行中跟进行为（排队 / 引导），跨会话持久化
  const [followUpBehavior, setFollowUpBehavior] = useState<FollowUpBehavior>(
    () => loadFollowUpBehavior(),
  );
  const isCodex = provider === "codex";
  const showFollowUpControls = isCodex && !!isRunning;
  const useCodexSlashPanel = isCodex && !!codexSlashPanel;

  // Combined display text: committed text + interim transcript
  const displayText = interimTranscript
    ? text + (text.trimEnd() ? " " : "") + interimTranscript
    : text;

  // Auto-scroll textarea when voice input updates (interim transcript changes)
  // Browser handles scrolling for normal typing, but programmatic updates need explicit scroll
  useEffect(() => {
    if (interimTranscript) {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.scrollTop = textarea.scrollHeight;
      }
    }
  }, [interimTranscript]);

  // Panel is collapsed if user collapsed it OR if externally collapsed (approval panel showing)
  const collapsed = userCollapsed || externalCollapsed;

  const canAttach = !!(projectId && sessionId && onAttach);
  const filteredSlashCommands =
    slashQueryState && slashCommands.length > 0
      ? slashCommands.filter((command) =>
          command.toLowerCase().includes(slashQueryState.query.toLowerCase()),
        )
      : slashCommands;

  const updateSlashQueryState = useCallback(
    (value: string, selectionStart: number | null) => {
      setSlashQueryState(getSlashQueryState(value, selectionStart));
    },
    [],
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.length && onAttach) {
      onAttach(Array.from(files));
      e.target.value = ""; // Reset for re-selection
    }
  };

  // Provide controls to parent via callback
  useEffect(() => {
    onDraftControlsReady?.(controls);
  }, [controls, onDraftControlsReady]);

  const handleFollowUpBehaviorChange = useCallback((value: FollowUpBehavior) => {
    setFollowUpBehavior(value);
    saveFollowUpBehavior(value);
  }, []);

  /** 收集当前输入内容并清空输入框，返回待发送文本。 */
  const collectAndClearInput = useCallback(() => {
    // 停止语音并合并未提交的 interim 文本
    const pendingVoice = voiceButtonRef.current?.stopAndFinalize() ?? "";

    let finalText = text.trimEnd();
    if (pendingVoice) {
      finalText = finalText ? `${finalText} ${pendingVoice}` : pendingVoice;
    }

    const hasContent = finalText.trim() || attachments.length > 0;
    if (!hasContent || disabled) return null;

    const message = finalText.trim();
    // 清空输入状态，localStorage 草稿保留以便失败恢复
    controls.clearInput();
    setInterimTranscript("");
    textareaRef.current?.focus();
    return message;
  }, [text, disabled, controls, attachments.length]);

  const handleSubmit = useCallback(
    (options?: { invertOnce?: boolean; behavior?: FollowUpBehavior | "barge-in" }) => {
      const message = collectAndClearInput();
      if (message === null) return;

      // Codex 运行中按跟进行为分流；空闲或其它 provider 走普通发送
      if (showFollowUpControls) {
        const behavior =
          options?.behavior ??
          resolveSendBehavior(followUpBehavior, {
            invertOnce: options?.invertOnce,
          });
        onSend(message, { behavior });
        return;
      }

      onSend(message);
    },
    [
      collectAndClearInput,
      showFollowUpControls,
      followUpBehavior,
      onSend,
    ],
  );

  const handleQueue = useCallback(() => {
    if (!onQueue) return;
    const message = collectAndClearInput();
    if (message === null) return;
    onQueue(message);
  }, [collectAndClearInput, onQueue]);

  const handleBargeIn = useCallback(() => {
    handleSubmit({ behavior: "barge-in" });
  }, [handleSubmit]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (slashQueryState && e.key === "Escape") {
      e.preventDefault();
      setSlashQueryState(null);
      return;
    }

    if (
      slashQueryState &&
      !useCodexSlashPanel &&
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.ctrlKey &&
      !e.nativeEvent.isComposing &&
      filteredSlashCommands.length > 0
    ) {
      e.preventDefault();
      handleSlashCommand(`/${filteredSlashCommands[0]}`);
      return;
    }

    // Ctrl+Space toggles voice input
    if (e.key === " " && e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      if (voiceButtonRef.current?.isAvailable) {
        voiceButtonRef.current.toggle();
      }
      return;
    }

    if (e.key === "Enter") {
      // Skip Enter during IME composition (e.g. Chinese/Japanese/Korean input)
      if (e.nativeEvent.isComposing) return;

      // Codex 运行中：Ctrl+Shift+Enter 对本条消息反转跟进行为
      if (showFollowUpControls && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        handleSubmit({ invertOnce: true });
        return;
      }

      // 非 Codex 或兼容路径：Ctrl+Enter 仍走 deferred 排队
      if (onQueue && e.ctrlKey && !e.shiftKey && !showFollowUpControls) {
        e.preventDefault();
        handleQueue();
        return;
      }

      // On mobile (touch devices), Enter adds newline - must use send button
      // On desktop, Enter sends message, Shift/Ctrl+Enter adds newline
      const isMobile = hasCoarsePointer();

      // If voice recording is active, Enter submits (on any device)
      if (voiceButtonRef.current?.isListening) {
        e.preventDefault();
        handleSubmit();
        return;
      }

      if (isMobile) {
        // Mobile: Enter always adds newline, send button required
        // Allow default behavior (newline)
        return;
      }

      if (ENTER_SENDS_MESSAGE) {
        // Desktop: Enter sends, Ctrl+Enter adds newline
        if (e.ctrlKey || e.shiftKey) {
          // Allow default behavior (newline)
          return;
        }
        e.preventDefault();
        handleSubmit();
      } else {
        // Ctrl+Enter sends, Enter adds newline
        if (e.ctrlKey || e.shiftKey) {
          e.preventDefault();
          handleSubmit();
        }
      }
    }
  };

  const handlePaste = (e: ClipboardEvent) => {
    if (!canAttach || !onAttach) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      // Prevent default only if we have files to handle
      // This allows text paste to still work normally
      e.preventDefault();
      onAttach(files);
    }
  };

  // Voice input handlers
  const handleVoiceTranscript = useCallback(
    (transcript: string) => {
      // Append transcript to existing text with space separator
      // Trim the transcript since mobile speech API includes leading/trailing spaces
      const trimmedTranscript = transcript.trim();
      if (!trimmedTranscript) return;

      const trimmedText = text.trimEnd();
      if (trimmedText) {
        setText(`${trimmedText} ${trimmedTranscript}`);
      } else {
        setText(trimmedTranscript);
      }
      setInterimTranscript("");
      // Scroll to bottom after committing voice transcript
      // Use setTimeout to ensure state update has rendered
      setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.scrollTop = textarea.scrollHeight;
        }
      }, 0);
    },
    [text, setText],
  );

  const handleInterimTranscript = useCallback((transcript: string) => {
    setInterimTranscript(transcript);
  }, []);

  /** 清除输入框中的 /query token，并关闭 slash 面板状态。 */
  const clearSlashToken = useCallback(() => {
    if (slashQueryState) {
      const nextText =
        text.slice(0, slashQueryState.start) + text.slice(slashQueryState.end);
      setText(nextText);
    }
    setSlashQueryState(null);
  }, [setText, slashQueryState, text]);

  const handleCodexBuiltinSelect = useCallback(
    (id: CodexSlashBuiltinId) => {
      clearSlashToken();
      codexSlashPanel?.onSelectBuiltin(id);
    },
    [clearSlashToken, codexSlashPanel],
  );

  const handleCodexSkillSelect = useCallback(
    (name: string) => {
      clearSlashToken();
      codexSlashPanel?.onSelectSkill(name);
    },
    [clearSlashToken, codexSlashPanel],
  );

  // Handle slash command selection - insert command into text
  const handleSlashCommand = useCallback(
    (command: string) => {
      // Check if this is a custom client-side command (strip leading "/")
      const bare = command.startsWith("/") ? command.slice(1) : command;
      if (onCustomCommand?.(bare)) {
        if (slashQueryState) {
          const nextText =
            text.slice(0, slashQueryState.start) + text.slice(slashQueryState.end);
          setText(nextText);
        }
        setSlashQueryState(null);
        return; // Custom command handled, don't insert text
      }
      if (slashQueryState) {
        const nextText =
          text.slice(0, slashQueryState.start) +
          `${command} ` +
          text.slice(slashQueryState.end);
        setText(nextText);
        setSlashQueryState(null);
        requestAnimationFrame(() => {
          const textarea = textareaRef.current;
          if (!textarea) return;
          const caret = slashQueryState.start + command.length + 1;
          textarea.focus();
          textarea.setSelectionRange(caret, caret);
        });
        return;
      }

      const trimmed = text.trimEnd();
      if (trimmed) {
        setText(`${trimmed} ${command} `);
      } else {
        setText(`${command} `);
      }
      setSlashQueryState(null);
      textareaRef.current?.focus();
    },
    [text, setText, onCustomCommand, slashQueryState],
  );

  return (
    <div className="message-input-wrapper">
      {/* Floating toggle button - only show when user can control collapse (not externally collapsed) */}
      {!externalCollapsed && (
        <button
          type="button"
          className="message-input-toggle"
          onClick={() => setUserCollapsed(!userCollapsed)}
          aria-label={
            userCollapsed ? t("messageInputExpand") : t("messageInputCollapse")
          }
          aria-expanded={!userCollapsed}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={userCollapsed ? "chevron-up" : "chevron-down"}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}
      <div
        className={`message-input ${collapsed ? "message-input-collapsed" : ""} ${interimTranscript ? "voice-recording" : ""}`}
      >
        <textarea
          ref={textareaRef}
          value={displayText}
          onChange={(e) => {
            // If user edits while recording, only update committed text
            // This clears interim since they're now typing
            setInterimTranscript("");
            setText(e.target.value);
            updateSlashQueryState(e.target.value, e.target.selectionStart);
          }}
          onSelect={(e) => {
            updateSlashQueryState(
              e.currentTarget.value,
              e.currentTarget.selectionStart,
            );
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            externalCollapsed ? t("messageInputContinueAbove") : placeholder
          }
          disabled={disabled}
          rows={collapsed ? 1 : 3}
        />

        {/* Attachment chips - show below textarea when not collapsed */}
        {!collapsed &&
          (attachments.length > 0 || uploadProgress.length > 0) && (
            <div className="attachment-list">
              {attachments.map((file) => (
                <div key={file.id} className="attachment-chip">
                  {getAttachmentPreviewUrl(projectId, sessionId, file) && (
                    <img
                      className="attachment-preview"
                      src={
                        getAttachmentPreviewUrl(projectId, sessionId, file) ??
                        undefined
                      }
                      alt={file.originalName}
                    />
                  )}
                  <span className="attachment-name" title={file.path}>
                    {file.originalName}
                  </span>
                  <span className="attachment-size">
                    {formatSize(file.size)}
                  </span>
                  <button
                    type="button"
                    className="attachment-remove"
                    onClick={() => onRemoveAttachment?.(file.id)}
                    aria-label={t("messageInputRemoveAttachment", {
                      name: file.originalName,
                    })}
                  >
                    x
                  </button>
                </div>
              ))}
              {uploadProgress.map((progress) => (
                <div
                  key={progress.fileId}
                  className="attachment-chip uploading"
                >
                  <span className="attachment-name">{progress.fileName}</span>
                  <span className="attachment-progress">
                    {progress.percent}%
                  </span>
                </div>
              ))}
            </div>
          )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />

        {!collapsed && (
          <MessageInputToolbar
            mode={mode}
            onModeChange={onModeChange}
            provider={provider}
            isHeld={isHeld}
            onHoldChange={onHoldChange}
            supportsPermissionMode={supportsPermissionMode}
            supportsThinkingToggle={supportsThinkingToggle}
            onThinkingClick={onThinkingClick}
            thinkingModeOverride={thinkingMode}
            effortLevelOverride={effortLevel}
            currentModel={currentModel}
            onModelClick={onModelClick}
            modelOptions={modelOptions}
            onModelChange={onModelChange}
            planMode={planMode}
            onPlanModeToggle={onPlanModeToggle}
            onThinkingChange={onThinkingChange}
            canAttach={canAttach}
            attachmentCount={attachments.length}
            onAttachClick={() => fileInputRef.current?.click()}
            voiceButtonRef={voiceButtonRef}
            onVoiceTranscript={handleVoiceTranscript}
            onInterimTranscript={handleInterimTranscript}
            onListeningStart={() => textareaRef.current?.focus()}
            voiceDisabled={disabled}
            slashCommands={slashCommands}
            onSelectSlashCommand={handleSlashCommand}
            slashMenuOpen={slashQueryState !== null}
            slashMenuQuery={slashQueryState?.query ?? ""}
            filteredSlashCommands={filteredSlashCommands}
            onSlashMenuOpenChange={(open) => {
              if (!open) {
                setSlashQueryState(null);
              }
            }}
            renderSlashMenu={
              useCodexSlashPanel && codexSlashPanel
                ? ({ query, onClose }) => (
                    <CodexSlashPanel
                      query={query}
                      builtins={codexSlashPanel.builtins}
                      skills={codexSlashPanel.skills}
                      loadingSkills={codexSlashPanel.loadingSkills}
                      onSelectBuiltin={handleCodexBuiltinSelect}
                      onSelectSkill={handleCodexSkillSelect}
                      onClose={onClose}
                    />
                  )
                : undefined
            }
            contextUsage={contextUsage}
            onContextUsageClick={onContextUsageClick}
            isRunning={isRunning}
            isThinking={isThinking}
            onStop={onStop}
            onSend={() => handleSubmit()}
            onQueue={onQueue ? handleQueue : undefined}
            onBargeIn={showFollowUpControls ? handleBargeIn : undefined}
            primaryActionLabel={
              showFollowUpControls
                ? followUpBehavior === "steer"
                  ? t("followUpBehaviorSteer")
                  : t("followUpBehaviorQueue")
                : undefined
            }
            canSend={!!(text.trim() || attachments.length > 0)}
            disabled={disabled}
          />
        )}
        {!collapsed && showFollowUpControls && (
          <FollowUpBehaviorControl
            value={followUpBehavior}
            onChange={handleFollowUpBehaviorChange}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}
