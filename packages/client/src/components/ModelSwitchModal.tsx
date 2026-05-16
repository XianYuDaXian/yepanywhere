import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useI18n } from "../i18n";
import { Modal } from "./ui/Modal";

interface ModelSwitchModalProps {
  processId?: string;
  currentModel?: string;
  fallbackModels?: ModelOption[];
  onModelChanged: (model: string) => void;
  onClose: () => void;
}

interface ModelOption {
  id: string;
  name: string;
  description?: string;
}

function normalizeModelId(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function ModelSwitchModal({
  processId,
  currentModel,
  fallbackModels,
  onModelChanged,
  onClose,
}: ModelSwitchModalProps) {
  const { t } = useI18n();
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (fallbackModels && fallbackModels.length > 0) {
      setModels(fallbackModels);
      setLoading(false);
      setError(null);
      return;
    }
    if (!processId) {
      setModels([]);
      setLoading(false);
      return;
    }
    api
      .getProcessModels(processId)
      .then((res) => setModels(res.models))
      .catch((err) => setError(err.message || t("modelSwitchLoadFailed")))
      .finally(() => setLoading(false));
  }, [fallbackModels, processId, t]);

  const handleSelect = async (modelId: string) => {
    if (switching) return;
    setSwitching(true);
    setError(null);
    try {
      if (processId) {
        await api.setProcessModel(processId, modelId);
      }
      onModelChanged(modelId);
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t("modelSwitchChangeFailed"),
      );
      setSwitching(false);
    }
  };

  return (
    <Modal title={t("modelSwitchTitle")} onClose={onClose}>
      <div className="model-switch-content">
        {loading && (
          <div className="model-switch-loading">{t("modelSwitchLoading")}</div>
        )}
        {error && <div className="model-switch-error">{error}</div>}
        {!loading && !error && models.length === 0 && (
          <div className="model-switch-loading">{t("modelSwitchEmpty")}</div>
        )}
        {!loading && models.length > 0 && (
          <div className="model-switch-list">
            {models.map((model) => {
              const normalizedCurrent = normalizeModelId(currentModel);
              const isCurrent =
                normalizedCurrent.length > 0 &&
                [model.id, model.name].some(
                  (value) => normalizeModelId(value) === normalizedCurrent,
                );
              return (
                <button
                  key={model.id}
                  type="button"
                  className={`model-switch-item ${isCurrent ? "current" : ""}`}
                  onClick={() => handleSelect(model.id)}
                  disabled={switching}
                >
                  <span className="model-switch-name">{model.name}</span>
                  {model.description && (
                    <span className="model-switch-description">
                      {model.description}
                    </span>
                  )}
                  {isCurrent && (
                    <span className="model-switch-badge">
                      {t("modelSwitchCurrent")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
