import { useI18n } from "../i18n";
import type { ContextUsage } from "../types";

interface ContextUsageIndicatorProps {
  /** Context usage data */
  usage?: ContextUsage;
  /** Size of the indicator in pixels (default: 16) */
  size?: number;
  /** Whether to show the percentage label (default: true) */
  showLabel?: boolean;
  /** 点击后显示详细信息 */
  onClick?: () => void;
}

/**
 * Small pie chart indicator showing context window usage percentage.
 * Displays a gray pie chart that fills based on usage, with percentage label.
 */
export function ContextUsageIndicator({
  usage,
  size = 16,
  showLabel = true,
  onClick,
}: ContextUsageIndicatorProps) {
  const { t } = useI18n();
  if (!usage) return null;

  // 主显示优先 occupancy，兼容旧 input/percentage 字段
  const used = usage.occupancyTokens ?? usage.inputTokens;
  const percent = usage.occupancyPercentage ?? usage.percentage;
  // 将百分比限制在 0-100
  const clampedPercentage = Math.min(100, Math.max(0, percent));

  // Calculate the stroke-dasharray for the pie chart
  // Circumference of circle with r=8 (for size=16) = 2 * PI * r
  const radius = size / 2 - 1; // Leave 1px for stroke
  const circumference = 2 * Math.PI * radius;
  const filled = (clampedPercentage / 100) * circumference;

  // Fill color - lighter color that shows usage amount
  const getFillColor = () => {
    if (clampedPercentage >= 90) return "var(--color-error, #dc3545)";
    if (clampedPercentage >= 75) return "var(--color-warning, #ffc107)";
    return "var(--text-muted, #9d9d9d)";
  };

  const tooltip = usage.contextWindow
    ? t("contextTooltipWithWindow", {
        percentage: clampedPercentage,
        used: formatTokens(used),
        total: formatTokens(usage.contextWindow),
      })
    : t("contextTooltipNoWindow", {
        percentage: clampedPercentage,
        used: formatTokens(used),
      });

  const content = (
    <>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="context-usage-pie"
        aria-hidden="true"
      >
        {/* Background circle - darker */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-color, #3c3c3c)"
          strokeWidth="2"
        />
        {/* Filled arc - lighter color showing usage, rotated -90deg so it starts from top */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getFillColor()}
          strokeWidth="2"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {showLabel && (
        <span className="context-usage-label">{clampedPercentage}%</span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className="context-usage-indicator context-usage-button"
        title={tooltip}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <span className="context-usage-indicator" title={tooltip}>
      {content}
    </span>
  );
}

/**
 * Format token count for display (e.g., 34500 -> "34.5K")
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}
