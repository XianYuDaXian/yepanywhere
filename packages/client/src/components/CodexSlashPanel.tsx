import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";

export type CodexSlashBuiltinId =
  | "reasoning"
  | "model"
  | "status"
  | "goal"
  | "plan"
  | "memory"
  | "compact";

export interface CodexSlashBuiltinItem {
  id: CodexSlashBuiltinId;
  title: string;
  subtitle?: string;
  disabled?: boolean;
}

export interface CodexSlashSkillItem {
  name: string;
  description?: string;
  scope: "project" | "user";
}

export interface CodexSlashPanelProps {
  query: string;
  builtins: CodexSlashBuiltinItem[];
  skills: CodexSlashSkillItem[];
  loadingSkills?: boolean;
  onSelectBuiltin: (id: CodexSlashBuiltinId) => void;
  onSelectSkill: (name: string) => void;
  onClose: () => void;
}

type FlatItem =
  | { kind: "builtin"; item: CodexSlashBuiltinItem }
  | { kind: "skill"; item: CodexSlashSkillItem };

/**
 * Codex 风格完整 slash 面板：内建项 + 技能区。
 */
export function CodexSlashPanel({
  query,
  builtins,
  skills,
  loadingSkills = false,
  onSelectBuiltin,
  onSelectSkill,
  onClose,
}: CodexSlashPanelProps) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedQuery = query.trim().toLowerCase();

  const filteredBuiltins = useMemo(() => {
    if (!normalizedQuery) return builtins;
    return builtins.filter((item) => {
      const haystack = `${item.title} ${item.subtitle ?? ""} ${item.id}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [builtins, normalizedQuery]);

  const filteredSkills = useMemo(() => {
    if (!normalizedQuery) return skills;
    return skills.filter((item) => {
      const haystack =
        `${item.name} ${item.description ?? ""} ${item.scope}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [skills, normalizedQuery]);

  const flatItems = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = [];
    for (const item of filteredBuiltins) {
      items.push({ kind: "builtin", item });
    }
    for (const item of filteredSkills) {
      items.push({ kind: "skill", item });
    }
    return items;
  }, [filteredBuiltins, filteredSkills]);

  const selectableIndexes = useMemo(
    () =>
      flatItems
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) =>
          entry.kind === "builtin" ? !entry.item.disabled : true,
        )
        .map(({ index }) => index),
    [flatItems],
  );

  useEffect(() => {
    setActiveIndex(selectableIndexes[0] ?? 0);
  }, [normalizedQuery, selectableIndexes.join(",")]);

  // 方向键切换时，当前高亮项滚入可视区（对齐 Codex CLI）
  useEffect(() => {
    const node = itemRefs.current.get(activeIndex);
    const panel = panelRef.current;
    if (!node || !panel) return;

    // 优先在面板内滚动；测试环境可能没有 scrollIntoView
    const nodeTop = node.offsetTop;
    const nodeBottom = nodeTop + node.offsetHeight;
    const viewTop = panel.scrollTop;
    const viewBottom = viewTop + panel.clientHeight;
    if (nodeTop < viewTop) {
      panel.scrollTop = nodeTop;
    } else if (nodeBottom > viewBottom) {
      panel.scrollTop = nodeBottom - panel.clientHeight;
    }
  }, [activeIndex, flatItems.length]);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (selectableIndexes.length === 0) return;
      const currentPos = Math.max(0, selectableIndexes.indexOf(activeIndex));
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        const nextPos = (currentPos + 1) % selectableIndexes.length;
        setActiveIndex(selectableIndexes[nextPos] ?? 0);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        const nextPos =
          (currentPos - 1 + selectableIndexes.length) % selectableIndexes.length;
        setActiveIndex(selectableIndexes[nextPos] ?? 0);
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        // 捕获阶段拦截 Enter：只选择命令，禁止输入框发送
        event.preventDefault();
        event.stopPropagation();
        const current = flatItems[activeIndex];
        if (!current) return;
        if (current.kind === "builtin") {
          if (current.item.disabled) return;
          onSelectBuiltin(current.item.id);
        } else {
          onSelectSkill(current.item.name);
        }
        onClose();
      }
    };
    // 使用捕获阶段，确保优先于 textarea 的发送逻辑
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [
    activeIndex,
    flatItems,
    onClose,
    onSelectBuiltin,
    onSelectSkill,
    selectableIndexes,
  ]);

  const setItemRef = (index: number, node: HTMLButtonElement | null) => {
    if (node) {
      itemRefs.current.set(index, node);
    } else {
      itemRefs.current.delete(index);
    }
  };

  const activate = (index: number) => {
    const current = flatItems[index];
    if (!current) return;
    if (current.kind === "builtin") {
      if (current.item.disabled) return;
      onSelectBuiltin(current.item.id);
    } else {
      onSelectSkill(current.item.name);
    }
    onClose();
  };

  return (
    <div className="codex-slash-panel" ref={panelRef} role="listbox">
      <div className="codex-slash-section">
        <div className="codex-slash-section-title">
          {t("codexSlashSectionBuiltins")}
        </div>
        {filteredBuiltins.length === 0 ? (
          <div className="codex-slash-empty">{t("codexSlashEmptyBuiltins")}</div>
        ) : (
          filteredBuiltins.map((item) => {
            const index = flatItems.findIndex(
              (entry) => entry.kind === "builtin" && entry.item.id === item.id,
            );
            return (
              <button
                key={item.id}
                ref={(node) => setItemRef(index, node)}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`codex-slash-item ${index === activeIndex ? "active" : ""} ${item.disabled ? "disabled" : ""}`}
                disabled={item.disabled}
                onMouseEnter={() => {
                  if (!item.disabled) setActiveIndex(index);
                }}
                onClick={() => activate(index)}
              >
                <span className="codex-slash-item-title">{item.title}</span>
                {item.subtitle ? (
                  <span className="codex-slash-item-subtitle">
                    {item.subtitle}
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>

      <div className="codex-slash-section">
        <div className="codex-slash-section-title">
          {t("codexSlashSectionSkills")}
        </div>
        {loadingSkills ? (
          <div className="codex-slash-empty">{t("codexSlashSkillsLoading")}</div>
        ) : filteredSkills.length === 0 ? (
          <div className="codex-slash-empty">{t("codexSlashEmptySkills")}</div>
        ) : (
          filteredSkills.map((item) => {
            const index = flatItems.findIndex(
              (entry) =>
                entry.kind === "skill" && entry.item.name === item.name,
            );
            return (
              <button
                key={`${item.scope}:${item.name}`}
                ref={(node) => setItemRef(index, node)}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`codex-slash-item ${index === activeIndex ? "active" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => activate(index)}
              >
                <span className="codex-slash-item-title">${item.name}</span>
                <span className="codex-slash-item-subtitle">
                  {item.description ||
                    (item.scope === "project"
                      ? t("codexSkillProjectScope")
                      : t("codexSkillUserScope"))}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
