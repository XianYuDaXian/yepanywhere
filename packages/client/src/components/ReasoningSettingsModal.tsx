import type { EffortLevel, ThinkingMode } from "@yep-anywhere/shared";
import { useMemo } from "react";
import type { ThinkingOption } from "../hooks/useModelSettings";
import { useI18n } from "../i18n";
import { Modal } from "./ui/Modal";

interface ReasoningSettingsModalProps {
  thinkingMode: ThinkingMode;
  effortLevel: EffortLevel;
  onSelect: (value: ThinkingOption) => void;
  onClose: () => void;
}

export function ReasoningSettingsModal({
  thinkingMode,
  effortLevel,
  onSelect,
  onClose,
}: ReasoningSettingsModalProps) {
  const { t } = useI18n();

  const currentValue = useMemo<ThinkingOption>(() => {
    if (thinkingMode === "auto") return "auto";
    if (thinkingMode === "off") return "auto";
    return `on:${effortLevel}`;
  }, [effortLevel, thinkingMode]);

  const options: Array<{
    value: ThinkingOption;
    label: string;
  }> = [
    { value: "auto", label: t("codexReasoningAuto") },
    { value: "on:low", label: t("codexReasoningLow") },
    { value: "on:medium", label: t("codexReasoningMedium") },
    { value: "on:high", label: t("codexReasoningHigh") },
    { value: "on:max", label: t("codexReasoningMax") },
  ];

  return (
    <Modal title={t("reasoningModalTitle")} onClose={onClose}>
      <div className="model-switch-content">
        <div className="model-switch-list codex-reasoning-list">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`model-switch-item codex-reasoning-item ${currentValue === option.value ? "current" : ""}`}
              onClick={() => {
                onSelect(option.value);
                onClose();
              }}
            >
              <span className="model-switch-name">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
