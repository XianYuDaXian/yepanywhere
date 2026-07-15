import { useEffect, useState } from "react";
import { useI18n } from "../i18n";

export type DeferredFollowUpStatus = "queued" | "steering" | "sent";

export interface DeferredFollowUpMessage {
  tempId?: string;
  content: string;
  timestamp: string;
  status?: DeferredFollowUpStatus;
  behavior?: "queue" | "steer";
}

interface DeferredFollowUpCardProps {
  message: DeferredFollowUpMessage;
  /** 排队序号，从 0 开始；仅 queued 有意义 */
  queueIndex: number;
  onUpdateContent?: (tempId: string, content: string) => Promise<void>;
  onSteer?: (tempId: string) => Promise<void>;
  onCancel?: (tempId: string) => Promise<void>;
  onReuse?: (content: string) => void;
}

/**
 * 跟进消息卡片：模仿 Codex 用户气泡样式。
 * 右上标签显示引导/排队；操作使用图标按钮。
 */
export function DeferredFollowUpCard({
  message,
  queueIndex,
  onUpdateContent,
  onSteer,
  onCancel,
  onReuse,
}: DeferredFollowUpCardProps) {
  const { t } = useI18n();
  const status: DeferredFollowUpStatus = message.status ?? "queued";
  const tempId = message.tempId;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraft(message.content);
    }
  }, [message.content, editing]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".deferred-message-menu")) return;
      if (target?.closest(".deferred-message-icon-btn.more")) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  // 标签优先显示行为语义（引导 / 排队），与 Codex 截图一致
  const badgeLabel =
    status === "steering" || message.behavior === "steer"
      ? t("followUpBehaviorSteer")
      : status === "sent"
        ? t("deferredStatusSent")
        : queueIndex === 0
          ? t("followUpBehaviorQueue")
          : t("deferredStatusQueuedIndex", { index: queueIndex + 1 });

  const run = async (action: () => Promise<void>) => {
    if (!tempId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setMenuOpen(false);
    }
  };

  const handleSave = () =>
    run(async () => {
      if (!tempId || !onUpdateContent) return;
      const next = draft.trim();
      if (!next) {
        setError(t("deferredEditEmpty"));
        return;
      }
      await onUpdateContent(tempId, next);
      setEditing(false);
    });

  return (
    <div className={`deferred-message deferred-message--${status}`}>
      <div className="deferred-message-card">
        <div className="deferred-message-toolbar">
          <span
            className={`deferred-message-badge deferred-message-badge--${
              status === "steering" || message.behavior === "steer"
                ? "steer"
                : status === "sent"
                  ? "sent"
                  : "queue"
            }`}
          >
            {badgeLabel}
          </span>
          <div className="deferred-message-icon-actions">
            {status === "queued" && tempId && onCancel && (
              <button
                type="button"
                className="deferred-message-icon-btn"
                disabled={busy}
                onClick={() => void run(() => onCancel(tempId))}
                aria-label={t("deferredActionCancel")}
                title={t("deferredActionCancel")}
              >
                <TrashIcon />
              </button>
            )}
            {status === "steering" && tempId && onCancel && (
              <button
                type="button"
                className="deferred-message-icon-btn"
                disabled={busy}
                onClick={() => void run(() => onCancel(tempId))}
                aria-label={t("deferredActionCancel")}
                title={t("deferredActionCancel")}
              >
                <TrashIcon />
              </button>
            )}
            {(status === "queued" || status === "sent") && (
              <div className="deferred-message-more-wrap">
                <button
                  type="button"
                  className="deferred-message-icon-btn more"
                  disabled={busy}
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-label={t("deferredActionEdit")}
                  aria-expanded={menuOpen}
                  title="More"
                >
                  <MoreIcon />
                </button>
                {menuOpen && (
                  <div className="deferred-message-menu" role="menu">
                    {status === "queued" && tempId && onUpdateContent && (
                      <button
                        type="button"
                        role="menuitem"
                        className="deferred-message-menu-item"
                        disabled={busy}
                        onClick={() => {
                          setEditing(true);
                          setMenuOpen(false);
                        }}
                      >
                        {t("deferredActionEdit")}
                      </button>
                    )}
                    {status === "queued" && tempId && onSteer && (
                      <button
                        type="button"
                        role="menuitem"
                        className="deferred-message-menu-item"
                        disabled={busy}
                        onClick={() => void run(() => onSteer(tempId))}
                      >
                        {t("followUpBehaviorSteer")}
                      </button>
                    )}
                    {status === "sent" && onReuse && (
                      <button
                        type="button"
                        role="menuitem"
                        className="deferred-message-menu-item"
                        disabled={busy}
                        onClick={() => {
                          onReuse(message.content);
                          setMenuOpen(false);
                        }}
                      >
                        {t("deferredActionReuse")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {editing ? (
          <div className="deferred-message-edit-body">
            <textarea
              className="deferred-message-editor"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              disabled={busy}
              aria-label={t("deferredEditLabel")}
            />
            <div className="deferred-message-edit-actions">
              <button
                type="button"
                className="deferred-message-action primary"
                disabled={busy}
                onClick={() => void handleSave()}
              >
                {t("deferredActionSave")}
              </button>
              <button
                type="button"
                className="deferred-message-action"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setDraft(message.content);
                  setError(null);
                }}
              >
                {t("projectsCancel")}
              </button>
            </div>
          </div>
        ) : (
          <div className="message-user-prompt deferred-message-bubble">
            {message.content}
          </div>
        )}
      </div>

      {error && <div className="deferred-message-error">{error}</div>}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}
