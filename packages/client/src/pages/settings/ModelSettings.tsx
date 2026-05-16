import { useEffect, useMemo, useState } from "react";
import type { ProviderName } from "@yep-anywhere/shared";
import {
  EFFORT_LEVEL_OPTIONS,
  MODEL_OPTIONS,
  useModelSettings,
} from "../../hooks/useModelSettings";
import { useProviders } from "../../hooks/useProviders";
import { useServerSettings } from "../../hooks/useServerSettings";
import { useI18n } from "../../i18n";

const PROVIDER_ORDER: ProviderName[] = [
  "claude",
  "codex",
  "codex-oss",
  "claude-ollama",
  "gemini",
  "gemini-acp",
  "opencode",
];

export function ModelSettings() {
  const { t } = useI18n();
  const { providers, loading: providersLoading } = useProviders();
  const {
    settings,
    isLoading: settingsLoading,
    updateSetting,
  } = useServerSettings();
  const { effortLevel, setEffortLevel } = useModelSettings();
  const [selectedProvider, setSelectedProvider] = useState<ProviderName>("claude");

  const availableProviders = useMemo(() => {
    const installed = providers.filter(
      (provider) => provider.installed && (provider.authenticated || provider.enabled),
    );
    return [...installed].sort((a, b) => {
      const left = PROVIDER_ORDER.indexOf(a.name);
      const right = PROVIDER_ORDER.indexOf(b.name);
      return (left === -1 ? 999 : left) - (right === -1 ? 999 : right);
    });
  }, [providers]);

  useEffect(() => {
    const serverProvider = settings?.newSessionDefaults?.provider;
    if (
      serverProvider &&
      availableProviders.some((provider) => provider.name === serverProvider)
    ) {
      setSelectedProvider(serverProvider);
      return;
    }
    if (
      !availableProviders.some((provider) => provider.name === selectedProvider) &&
      availableProviders[0]
    ) {
      setSelectedProvider(availableProviders[0].name);
    }
  }, [availableProviders, selectedProvider, settings?.newSessionDefaults?.provider]);

  const providerInfo =
    availableProviders.find((provider) => provider.name === selectedProvider) ??
    null;
  const isCodexProvider = selectedProvider === "codex";

  const selectedModel =
    settings?.newSessionDefaults?.provider === selectedProvider
      ? settings?.newSessionDefaults?.model
      : undefined;

  const handleProviderChange = async (provider: ProviderName) => {
    setSelectedProvider(provider);
    const providerDetails = availableProviders.find((item) => item.name === provider);
    const nextModel =
      provider === "claude"
        ? settings?.newSessionDefaults?.provider === "claude"
          ? settings?.newSessionDefaults?.model
          : "default"
        : providerDetails?.models?.[0]?.id;

    await updateSetting("newSessionDefaults", {
      ...settings?.newSessionDefaults,
      provider,
      model: nextModel,
    });
  };

  const handleModelChange = async (model: string) => {
    await updateSetting("newSessionDefaults", {
      ...settings?.newSessionDefaults,
      provider: selectedProvider,
      model,
    });
  };

  const loading = providersLoading || settingsLoading;

  return (
    <section className="settings-section">
      <h2>{t("modelSettingsTitle")}</h2>
      <div className="settings-group">
        <div className="settings-item">
          <div className="settings-item-info">
            <strong>{t("modelSettingsProviderTitle")}</strong>
            <p>{t("modelSettingsProviderDescription")}</p>
          </div>
          <div className="font-size-selector">
            {availableProviders.map((provider) => (
              <button
                key={provider.name}
                type="button"
                className={`font-size-option ${selectedProvider === provider.name ? "active" : ""}`}
                onClick={() => void handleProviderChange(provider.name)}
                disabled={loading}
              >
                {provider.displayName}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <strong>{t("modelSettingsModelTitle")}</strong>
            <p>
              {selectedProvider === "claude"
                ? t("modelSettingsClaudeModelDescription")
                : isCodexProvider
                  ? t("modelSettingsCodexModelDescription")
                  : t("modelSettingsGenericModelDescription")}
            </p>
          </div>
          <div className="font-size-selector">
            {selectedProvider === "claude"
              ? MODEL_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`font-size-option ${selectedModel === option.value ? "active" : ""}`}
                    onClick={() => void handleModelChange(option.value)}
                    disabled={loading}
                  >
                    {option.label}
                  </button>
                ))
              : (providerInfo?.models ?? []).map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    className={`font-size-option ${selectedModel === model.id ? "active" : ""}`}
                    onClick={() => void handleModelChange(model.id)}
                    disabled={loading}
                    title={model.description}
                  >
                    {model.name}
                  </button>
                ))}
          </div>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <strong>
              {isCodexProvider
                ? t("modelSettingsCodexEffortTitle")
                : t("modelSettingsEffortTitle")}
            </strong>
            <p>
              {isCodexProvider
                ? t("modelSettingsCodexEffortDescription")
                : t("modelSettingsEffortDescription")}
            </p>
          </div>
          <div className="font-size-selector">
            {EFFORT_LEVEL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`font-size-option ${effortLevel === opt.value ? "active" : ""}`}
                onClick={() => setEffortLevel(opt.value)}
                title={opt.description}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
