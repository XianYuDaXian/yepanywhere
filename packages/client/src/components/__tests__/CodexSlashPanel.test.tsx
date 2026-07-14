import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodexSlashPanel } from "../CodexSlashPanel";

vi.mock("../../i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe("CodexSlashPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("filters builtin items and skills together", () => {
    render(
      <CodexSlashPanel
        query="mo"
        builtins={[
          { id: "model", title: "模型", subtitle: "gpt-5.3-codex" },
          { id: "reasoning", title: "推理", subtitle: "高" },
        ]}
        skills={[
          {
            name: "model-router",
            description: "路由模型",
            scope: "user",
          },
          {
            name: "browser",
            description: "浏览",
            scope: "user",
          },
        ]}
        onSelectBuiltin={() => {}}
        onSelectSkill={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("模型")).toBeTruthy();
    expect(screen.getByText("$model-router")).toBeTruthy();
    expect(screen.queryByText("推理")).toBeNull();
    expect(screen.queryByText("$browser")).toBeNull();
  });
});
