import type { ContextUsage } from "@yep-anywhere/shared";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n";

interface ContextUsageModalProps {
  usage?: ContextUsage;
  /** 触发按钮，用于贴边定位 */
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}

interface Position {
  top: number;
  left: number;
  maxWidth: number;
}

const POPOVER_GAP_PX = 8;
const POPOVER_VIEWPORT_PAD = 8;
const POPOVER_MAX_WIDTH = 280;

/**
 * Codex 风格的上下文占用小浮层。
 * 贴着右下角指示器弹出，不使用整页模态框。
 */
export function ContextUsageModal({
  usage,
  anchorRef,
  onClose,
}: ContextUsageModalProps) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 默认在按钮上方、右对齐
    let top = anchorRect.top - panelRect.height - POPOVER_GAP_PX;
    let left = anchorRect.right - panelRect.width;

    // 上方空间不够时，改到按钮下方
    if (top < POPOVER_VIEWPORT_PAD) {
      top = anchorRect.bottom + POPOVER_GAP_PX;
    }

    // 水平方向夹在视口内
    left = Math.min(
      Math.max(left, POPOVER_VIEWPORT_PAD),
      viewportWidth - panelRect.width - POPOVER_VIEWPORT_PAD,
    );

    // 垂直方向再夹一次，避免矮屏溢出
    top = Math.min(
      Math.max(top, POPOVER_VIEWPORT_PAD),
      viewportHeight - panelRect.height - POPOVER_VIEWPORT_PAD,
    );

    const maxWidth = Math.min(
      POPOVER_MAX_WIDTH,
      viewportWidth - POPOVER_VIEWPORT_PAD * 2,
    );

    setPosition({ top, left, maxWidth });
  }, [anchorRef]);

  useLayoutEffect(() => {
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [updatePosition, usage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [anchorRef, onClose]);

  const occupancyTokens = usage
    ? (usage.occupancyTokens ?? usage.inputTokens)
    : 0;
  const occupancyPercentage = usage
    ? (usage.occupancyPercentage ?? usage.percentage)
    : 0;
  const clampedPercentage = Math.min(100, Math.max(0, occupancyPercentage));
  const sizeValue =
    usage?.contextWindow !== undefined
      ? `${formatTokens(occupancyTokens)} / ${formatTokens(usage.contextWindow)}`
      : formatTokens(occupancyTokens);

  const style: CSSProperties = position
    ? {
        top: position.top,
        left: position.left,
        maxWidth: position.maxWidth,
        visibility: "visible",
      }
    : {
        // 先离屏测量尺寸，再贴边
        top: 0,
        left: 0,
        visibility: "hidden",
      };

  return createPortal(
    <div
      ref={panelRef}
      className="context-usage-popover"
      role="dialog"
      aria-label={t("contextUsageModalTitle")}
      style={style}
    >
      <div className="context-usage-popover-header">
        <span className="context-usage-popover-title">
          {t("contextUsageModalTitle")}
        </span>
        <span className="context-usage-popover-meter" aria-hidden="true">
          <span
            className="context-usage-popover-meter-fill"
            style={{ width: `${clampedPercentage}%` }}
          />
        </span>
        <span className="context-usage-popover-percent">
          {clampedPercentage.toFixed(clampedPercentage < 10 ? 1 : 0)}%
        </span>
      </div>

      {!usage ? (
        <p className="context-usage-popover-empty">
          {t("contextUsageModalEmpty")}
        </p>
      ) : (
        <div className="context-usage-popover-rows">
          <PopoverRow
            label={t("processInfoLabelContextOccupancy")}
            value={sizeValue}
          />
          {usage.turnInputTokens !== undefined && (
            <PopoverRow
              label={t("processInfoLabelTurnInput")}
              value={formatTokens(usage.turnInputTokens)}
            />
          )}
          {usage.cacheReadTokens !== undefined && (
            <PopoverRow
              label={t("processInfoLabelCacheRead")}
              value={formatTokens(usage.cacheReadTokens)}
            />
          )}
          {usage.totalTokens !== undefined && (
            <PopoverRow
              label={t("processInfoLabelTotalTokens")}
              value={formatTokens(usage.totalTokens)}
            />
          )}
          {usage.outputTokens !== undefined && (
            <PopoverRow
              label={t("processInfoLabelOutputTokens")}
              value={formatTokens(usage.outputTokens)}
            />
          )}
          {usage.cacheCreationTokens !== undefined && (
            <PopoverRow
              label={t("processInfoLabelCacheCreated")}
              value={formatTokens(usage.cacheCreationTokens)}
            />
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}

function PopoverRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="context-usage-popover-row">
      <span className="context-usage-popover-label">{label}</span>
      <span className="context-usage-popover-value">{value}</span>
    </div>
  );
}

/** 格式化 token 数量，例如 34500 -> 34.5K */
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toLocaleString();
}
