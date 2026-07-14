import { useI18n } from "../i18n";
import type { FollowUpBehavior } from "../lib/followUpBehavior";

interface FollowUpBehaviorControlProps {
  value: FollowUpBehavior;
  onChange: (value: FollowUpBehavior) => void;
  disabled?: boolean;
}

/**
 * Codex 运行中的跟进行为切换：排队 / 引导。
 */
export function FollowUpBehaviorControl({
  value,
  onChange,
  disabled = false,
}: FollowUpBehaviorControlProps) {
  const { t } = useI18n();

  return (
    <div className="follow-up-behavior-control">
      <div className="follow-up-behavior-header">
        <span className="follow-up-behavior-title">
          {t("followUpBehaviorTitle")}
        </span>
        <div
          className="follow-up-behavior-options"
          role="radiogroup"
          aria-label={t("followUpBehaviorTitle")}
        >
          <button
            type="button"
            role="radio"
            aria-checked={value === "queue"}
            className={`follow-up-behavior-option ${value === "queue" ? "active" : ""}`}
            disabled={disabled}
            onClick={() => onChange("queue")}
          >
            {t("followUpBehaviorQueue")}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={value === "steer"}
            className={`follow-up-behavior-option ${value === "steer" ? "active" : ""}`}
            disabled={disabled}
            onClick={() => onChange("steer")}
          >
            {t("followUpBehaviorSteer")}
          </button>
        </div>
      </div>
      <p className="follow-up-behavior-description">
        {t("followUpBehaviorDescription")}
      </p>
    </div>
  );
}
