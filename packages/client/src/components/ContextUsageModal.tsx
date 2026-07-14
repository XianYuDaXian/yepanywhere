import type { ContextUsage } from "@yep-anywhere/shared";
import { useI18n } from "../i18n";
import { Modal } from "./ui/Modal";

interface ContextUsageModalProps {
  usage?: ContextUsage;
  onClose: () => void;
}

/**
 * 轻量上下文占用弹层：只展示 token 占用详情，不打开完整会话信息。
 */
export function ContextUsageModal({ usage, onClose }: ContextUsageModalProps) {
  const { t } = useI18n();

  if (!usage) {
    return (
      <Modal title={t("contextUsageModalTitle")} onClose={onClose}>
        <div className="context-usage-modal">
          <p className="context-usage-modal-empty">{t("contextUsageModalEmpty")}</p>
        </div>
      </Modal>
    );
  }

  const occupancyTokens = usage.occupancyTokens ?? usage.inputTokens;
  const occupancyPercentage = usage.occupancyPercentage ?? usage.percentage;
  const occupancyValue =
    usage.contextWindow !== undefined
      ? `${occupancyTokens.toLocaleString()} / ${usage.contextWindow.toLocaleString()} (${occupancyPercentage.toFixed(1)}%)`
      : `${occupancyTokens.toLocaleString()} (${occupancyPercentage.toFixed(1)}%)`;

  return (
    <Modal title={t("contextUsageModalTitle")} onClose={onClose}>
      <div className="context-usage-modal">
        <div className="process-info-section">
          <h3 className="process-info-section-title">
            {t("processInfoSectionTokenUsage")}
          </h3>
          <div className="process-info-row">
            <span className="process-info-label">
              {t("processInfoLabelContextOccupancy")}
            </span>
            <span className="process-info-value">{occupancyValue}</span>
          </div>
          {usage.turnInputTokens !== undefined && (
            <div className="process-info-row">
              <span className="process-info-label">
                {t("processInfoLabelTurnInput")}
              </span>
              <span className="process-info-value">
                {usage.turnInputTokens.toLocaleString()}
              </span>
            </div>
          )}
          {usage.cacheReadTokens !== undefined && (
            <div className="process-info-row">
              <span className="process-info-label">
                {t("processInfoLabelCacheRead")}
              </span>
              <span className="process-info-value">
                {usage.cacheReadTokens.toLocaleString()}
              </span>
            </div>
          )}
          {usage.totalTokens !== undefined && (
            <div className="process-info-row">
              <span className="process-info-label">
                {t("processInfoLabelTotalTokens")}
              </span>
              <span className="process-info-value">
                {usage.totalTokens.toLocaleString()}
              </span>
            </div>
          )}
          {usage.outputTokens !== undefined && (
            <div className="process-info-row">
              <span className="process-info-label">
                {t("processInfoLabelOutputTokens")}
              </span>
              <span className="process-info-value">
                {usage.outputTokens.toLocaleString()}
              </span>
            </div>
          )}
          {usage.cacheCreationTokens !== undefined && (
            <div className="process-info-row">
              <span className="process-info-label">
                {t("processInfoLabelCacheCreated")}
              </span>
              <span className="process-info-value">
                {usage.cacheCreationTokens.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
