import { useEffect, useState } from "react";
import { api, type CodexSkillInfo } from "../api/client";
import { useI18n } from "../i18n";
import { Modal } from "./ui/Modal";

interface CodexSkillModalProps {
  projectId: string;
  onSelect: (skillName: string) => void;
  onClose: () => void;
}

export function CodexSkillModal({
  projectId,
  onSelect,
  onClose,
}: CodexSkillModalProps) {
  const { t } = useI18n();
  const [skills, setSkills] = useState<CodexSkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getCodexSkills(projectId)
      .then((result) => setSkills(result.skills))
      .catch((err) => setError(err.message || t("codexSkillLoadFailed")))
      .finally(() => setLoading(false));
  }, [projectId, t]);

  return (
    <Modal title={t("codexSkillModalTitle")} onClose={onClose}>
      <div className="model-switch-content">
        {loading && (
          <div className="model-switch-loading">{t("modelSwitchLoading")}</div>
        )}
        {error && <div className="model-switch-error">{error}</div>}
        {!loading && !error && skills.length === 0 && (
          <div className="model-switch-loading">{t("codexSkillEmpty")}</div>
        )}
        {!loading && skills.length > 0 && (
          <div className="model-switch-list">
            {skills.map((skill) => (
              <button
                key={`${skill.scope}:${skill.name}`}
                type="button"
                className="model-switch-item"
                onClick={() => {
                  onSelect(skill.name);
                  onClose();
                }}
              >
                <span className="model-switch-name">${skill.name}</span>
                <span className="model-switch-description">
                  {skill.scope === "project"
                    ? t("codexSkillProjectScope")
                    : t("codexSkillUserScope")}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
