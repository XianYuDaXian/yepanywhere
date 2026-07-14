import type {
  EffortLevel,
  ModelInfo,
  ProviderName,
  ThinkingMode,
  UploadedFile,
} from "@yep-anywhere/shared";
import type { RefObject } from "react";
import type { ThinkingOption } from "../hooks/useModelSettings";
import { useModelSettings } from "../hooks/useModelSettings";
import { useI18n } from "../i18n";
import type { ContextUsage, PermissionMode } from "../types";
import { ContextUsageIndicator } from "./ContextUsageIndicator";
import { FilterDropdown, type FilterOption } from "./FilterDropdown";
import { ModeSelector } from "./ModeSelector";
import { SlashCommandButton } from "./SlashCommandButton";
import { VoiceInputButton, type VoiceInputButtonRef } from "./VoiceInputButton";

export interface MessageInputToolbarProps {
  // Mode selector
  mode?: PermissionMode;
  onModeChange?: (mode: PermissionMode) => void;
  isHeld?: boolean;
  onHoldChange?: (held: boolean) => void;
  provider?: ProviderName;

  // Provider capability flags (default to true for backwards compatibility)
  supportsPermissionMode?: boolean;
  supportsThinkingToggle?: boolean;
  onThinkingClick?: () => void;
  thinkingModeOverride?: ThinkingMode;
  effortLevelOverride?: EffortLevel;
  currentModel?: string;
  onModelClick?: () => void;
  modelOptions?: ModelInfo[];
  onModelChange?: (model: string) => void;
  planMode?: boolean;
  onPlanModeToggle?: () => void;
  onThinkingChange?: (value: ThinkingOption) => void;

  // Attachments
  canAttach?: boolean;
  attachmentCount?: number;
  onAttachClick?: () => void;

  // Voice input
  voiceButtonRef?: RefObject<VoiceInputButtonRef | null>;
  onVoiceTranscript?: (transcript: string) => void;
  onInterimTranscript?: (transcript: string) => void;
  onListeningStart?: () => void;
  voiceDisabled?: boolean;

  // Slash commands
  slashCommands?: string[];
  filteredSlashCommands?: string[];
  onSelectSlashCommand?: (command: string) => void;
  slashMenuOpen?: boolean;
  slashMenuQuery?: string;
  onSlashMenuOpenChange?: (open: boolean) => void;

  // Context usage
  contextUsage?: ContextUsage;
  onContextUsageClick?: () => void;

  // Actions
  isRunning?: boolean;
  isThinking?: boolean;
  onStop?: () => void;
  onSend?: (() => void) | ((event?: unknown) => void);
  /** Queue a deferred message. Only provided when agent is running. */
  onQueue?: () => void;
  /** Interrupt current run then send immediately. Only for Codex while running. */
  onBargeIn?: () => void;
  /** Running-time primary action label: send / queue / steer. */
  primaryActionLabel?: string;
  canSend?: boolean;
  disabled?: boolean;

  // Pending approval indicator
  pendingApproval?: {
    type: "tool-approval" | "user-question";
    onExpand: () => void;
  };
}

export function MessageInputToolbar({
  mode = "default",
  onModeChange,
  isHeld,
  onHoldChange,
  provider,
  supportsPermissionMode = true,
  supportsThinkingToggle = true,
  onThinkingClick,
  thinkingModeOverride,
  effortLevelOverride,
  currentModel,
  onModelClick,
  modelOptions,
  onModelChange,
  planMode,
  onPlanModeToggle,
  onThinkingChange,
  canAttach,
  attachmentCount = 0,
  onAttachClick,
  voiceButtonRef,
  onVoiceTranscript,
  onInterimTranscript,
  onListeningStart,
  voiceDisabled,
  slashCommands = [],
  filteredSlashCommands = slashCommands,
  onSelectSlashCommand,
  slashMenuOpen = false,
  slashMenuQuery = "",
  onSlashMenuOpenChange,
  contextUsage,
  onContextUsageClick,
  isRunning,
  isThinking,
  onStop,
  onSend,
  onQueue,
  onBargeIn,
  primaryActionLabel,
  canSend,
  disabled,
  pendingApproval,
}: MessageInputToolbarProps) {
  const { t } = useI18n();
  const {
    thinkingMode: storedThinkingMode,
    cycleThinkingMode,
    thinkingLevel: storedThinkingLevel,
  } = useModelSettings();
  const thinkingMode = thinkingModeOverride ?? storedThinkingMode;
  const thinkingLevel = effortLevelOverride ?? storedThinkingLevel;
  const isCodex = provider === "codex";
  const handleThinkingClick = onThinkingClick ?? cycleThinkingMode;
  const thinkingLabel =
    thinkingMode === "off"
      ? t("newSessionThinkingOff")
      : thinkingMode === "auto"
        ? t("newSessionThinkingAuto")
        : t("newSessionThinkingOn", { level: thinkingLevel });
  const modelLabel =
    currentModel?.replace(/^gpt-/i, "").replace(/-mini$/i, " mini") ??
    t("newSessionModelTitle");
  const normalizeModelId = (value: string | undefined) =>
    (value ?? "").trim().toLowerCase();
  const selectedModelId = modelOptions?.find((model) =>
    [model.id, model.name].some(
      (value) => normalizeModelId(value) === normalizeModelId(currentModel),
    ),
  )?.id;
  const modelDropdownOptions: FilterOption<string>[] =
    modelOptions?.map((model) => ({
      value: model.id,
      label: model.name,
      description: model.description,
    })) ?? [];
  const reasoningValue: ThinkingOption =
    thinkingMode === "auto"
      ? "auto"
      : thinkingMode === "off"
        ? "auto"
        : `on:${thinkingLevel}`;
  const reasoningOptions: FilterOption<ThinkingOption>[] = [
    { value: "auto", label: t("codexReasoningAuto") },
    { value: "on:low", label: t("codexReasoningLow") },
    { value: "on:medium", label: t("codexReasoningMedium") },
    { value: "on:high", label: t("codexReasoningHigh") },
    { value: "on:max", label: t("codexReasoningMax") },
  ];

  return (
    <div className="message-input-toolbar">
      <div className="message-input-controls-row">
        <div className="message-input-utility-start">
          <button
            type="button"
            className="attach-button"
            onClick={onAttachClick}
            disabled={!canAttach}
            title={
              canAttach ? t("toolbarAttachFiles") : t("toolbarAttachDisabled")
            }
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            {attachmentCount > 0 && (
              <span className="attach-count">{attachmentCount}</span>
            )}
          </button>
        </div>
        <div className="message-input-utility-end">
          {onSelectSlashCommand && (
            <SlashCommandButton
              commands={filteredSlashCommands}
              onSelectCommand={onSelectSlashCommand}
              disabled={voiceDisabled}
              forceOpen={slashMenuOpen}
              query={slashMenuQuery}
              onOpenChange={onSlashMenuOpenChange}
            />
          )}
        </div>
        <div className="message-input-actions">
          {/* Pending approval indicator */}
          {pendingApproval && (
            <button
              type="button"
              className={`pending-approval-indicator ${pendingApproval.type}`}
              onClick={pendingApproval.onExpand}
              title={
                pendingApproval.type === "tool-approval"
                  ? t("toolbarPendingApprovalExpand")
                  : t("toolbarPendingQuestionExpand")
              }
            >
              <span className="pending-approval-dot" />
              <span className="pending-approval-text">
                {pendingApproval.type === "tool-approval"
                  ? t("toolbarApproval")
                  : t("toolbarQuestion")}
              </span>
            </button>
          )}
          {/* Queue button - shown when agent is running and there's content to queue */}
          {onQueue && canSend && (
            <button
              type="button"
              onClick={onQueue}
              className="queue-button"
              title={t("toolbarQueueTitle")}
              aria-label={t("toolbarQueueLabel")}
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
                aria-hidden="true"
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          )}
          {/* Barge-in button - secondary action while Codex is running */}
          {onBargeIn && canSend && (
            <button
              type="button"
              onClick={onBargeIn}
              className="barge-in-button"
              title={t("toolbarBargeInTitle")}
              aria-label={t("toolbarBargeInLabel")}
            >
              <span className="barge-in-label">{t("toolbarBargeIn")}</span>
            </button>
          )}
          {/* Show stop button when thinking and nothing to send, otherwise show send */}
          {isRunning && onStop && isThinking && !canSend ? (
            <button
              type="button"
              onClick={onStop}
              className="stop-button"
              aria-label={t("toolbarStop")}
            >
              <span className="stop-icon" />
            </button>
          ) : onSend ? (
            <button
              type="button"
              onClick={onSend}
              disabled={disabled || !canSend}
              className="send-button"
              aria-label={primaryActionLabel ?? t("toolbarSend")}
            >
              {primaryActionLabel ? (
                <span className="send-label">{primaryActionLabel}</span>
              ) : (
                <span className="send-icon">↑</span>
              )}
            </button>
          ) : null}
        </div>
      </div>
      <div className="message-input-settings">
        {onModeChange && supportsPermissionMode && (
          <ModeSelector
            mode={mode}
            onModeChange={onModeChange}
            provider={provider}
            isHeld={isHeld}
            onHoldChange={onHoldChange}
          />
        )}
        {supportsThinkingToggle && isCodex && onThinkingChange ? (
          <FilterDropdown
            label={t("reasoningModalTitle")}
            options={reasoningOptions}
            selected={[reasoningValue]}
            onChange={(selected) => {
              const nextValue = selected[0];
              if (nextValue) onThinkingChange(nextValue);
            }}
            multiSelect={false}
            placeholder={t("codexReasoningAuto")}
          />
        ) : supportsThinkingToggle ? (
          <button
            type="button"
            className={`thinking-toggle-button ${isCodex ? "codex" : ""} ${thinkingMode !== "off" ? `active ${thinkingMode}` : ""}`}
            onClick={handleThinkingClick}
            title={thinkingLabel}
            aria-label={t("newSessionThinkingMode", { mode: thinkingMode })}
          >
            {isCodex ? (
              <>
                <span className="thinking-toggle-dot" />
                <span className="thinking-toggle-label">
                  {thinkingMode === "off"
                    ? "Off"
                    : thinkingMode === "auto"
                      ? "Auto"
                      : thinkingLevel}
                </span>
              </>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
                {thinkingMode === "auto" && (
                  <g>
                    <circle
                      cx="19"
                      cy="5"
                      r="5.5"
                      fill="currentColor"
                      stroke="none"
                    />
                    <text
                      x="19"
                      y="5"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="var(--bg-primary, #1a1a2e)"
                      fontSize="8"
                      fontWeight="700"
                      fontFamily="system-ui, sans-serif"
                      stroke="none"
                    >
                      A
                    </text>
                  </g>
                )}
              </svg>
            )}
          </button>
        ) : null}
        {isCodex && onPlanModeToggle && (
          <button
            type="button"
            className={`codex-plan-button ${planMode ? "active" : ""}`}
            onClick={onPlanModeToggle}
            title={t("modeCodexPlanDescription")}
          >
            <span className="codex-plan-dot" />
            <span>{t("modeCodexPlanLabel")}</span>
          </button>
        )}
        {isCodex && onModelChange && modelDropdownOptions.length > 0 ? (
          <FilterDropdown
            label={t("modelSwitchTitle")}
            options={modelDropdownOptions}
            selected={selectedModelId ? [selectedModelId] : []}
            onChange={(selected) => {
              const nextModel = selected[0];
              if (nextModel) onModelChange(nextModel);
            }}
            multiSelect={false}
            placeholder={modelLabel}
            buttonLabel={modelLabel}
          />
        ) : (
          isCodex &&
          onModelClick && (
            <button
              type="button"
              className="codex-model-button"
              onClick={onModelClick}
              title={t("modelSwitchTitle")}
            >
              <span className="codex-model-dot" />
              <span>{modelLabel}</span>
            </button>
          )
        )}
        {voiceButtonRef && onVoiceTranscript && onInterimTranscript && (
          <VoiceInputButton
            ref={voiceButtonRef}
            onTranscript={onVoiceTranscript}
            onInterimTranscript={onInterimTranscript}
            onListeningStart={onListeningStart}
            disabled={voiceDisabled}
          />
        )}
        <ContextUsageIndicator
          usage={contextUsage}
          size={16}
          onClick={onContextUsageClick}
        />
      </div>
    </div>
  );
}
