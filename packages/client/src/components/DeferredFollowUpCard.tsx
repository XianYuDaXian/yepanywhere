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
 * 跟进消息卡片：排队可编辑/改引导/取消；引导中可取消；已发送可再发修正。
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

  useEffect(() => {
    if (!editing) {
      setDraft(message.content);
    }
  }, [message.content, editing]);

  const statusLabel =
    status === "queued"
      ? queueIndex === 0
        ? t("deferredStatusQueuedNext")
        : t("deferredStatusQueuedIndex", { index: queueIndex + 1 })
      : status === "steering"
        ? t("deferredStatusSteering")
        : t("deferredStatusSent");

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
      {editing ? (
        <textarea
          className="deferred-message-editor"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          disabled={busy}
          aria-label={t("deferredEditLabel")}
        />
      ) : (
        <div className="message-user-prompt deferred-message-bubble">
          {message.content}
        </div>
      )}

      <div className="deferred-message-footer">
        <span className="deferred-message-status">{statusLabel}</span>

        {status === "queued" && tempId && (
          <div className="deferred-message-actions">
            {editing ? (
              <>
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
              </>
            ) : (
              <>
                {onUpdateContent && (
                  <button
                    type="button"
                    className="deferred-message-action"
                    disabled={busy}
                    onClick={() => setEditing(true)}
                  >
                    {t("deferredActionEdit")}
                  </button>
                )}
                {onSteer && (
                  <button
                    type="button"
                    className="deferred-message-action primary"
                    disabled={busy}
                    onClick={() => void run(() => onSteer(tempId))}
                  >
                    {t("followUpBehaviorSteer")}
                  </button>
                )}
                {onCancel && (
                  <button
                    type="button"
                    className="deferred-message-cancel"
                    disabled={busy}
                    onClick={() => void run(() => onCancel(tempId))}
                    aria-label={t("deferredActionCancel")}
                    title={t("deferredActionCancel")}
                  >
                    ×
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {status === "steering" && tempId && onCancel && (
          <div className="deferred-message-actions">
            <button
              type="button"
              className="deferred-message-action"
              disabled={busy}
              onClick={() => void run(() => onCancel(tempId))}
            >
              {t("deferredActionCancel")}
            </button>
          </div>
        )}

        {status === "sent" && onReuse && (
          <div className="deferred-message-actions">
            <button
              type="button"
              className="deferred-message-action"
              disabled={busy}
              onClick={() => onReuse(message.content)}
            >
              {t("deferredActionReuse")}
            </button>
          </div>
        )}
      </div>

      {error && <div className="deferred-message-error">{error}</div>}
    </div>
  );
}
