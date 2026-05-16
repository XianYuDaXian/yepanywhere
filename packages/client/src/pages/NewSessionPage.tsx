import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { NewSessionForm } from "../components/NewSessionForm";
import { PageHeader } from "../components/PageHeader";
import { ProjectSelector } from "../components/ProjectSelector";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useProject, useProjects } from "../hooks/useProjects";
import { resolvePreferredProjectId } from "../hooks/useRecentProject";
import { useI18n } from "../i18n";
import { useNavigationLayout } from "../layouts";

export function NewSessionPage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get("projectId");
  const workspaceParam = searchParams.get("workspace");
  const workspaceMode =
    workspaceParam === "chat" ? "chat" : ("project" as const);
  const { openSidebar, isWideScreen, toggleSidebar, isSidebarCollapsed } =
    useNavigationLayout();
  const [chatProjectId, setChatProjectId] = useState<string | null>(null);
  const [chatProjectLoading, setChatProjectLoading] = useState(true);
  const [chatProjectError, setChatProjectError] = useState<Error | null>(null);

  // Get all projects to find default if no projectId specified
  const { projects, loading: projectsLoading } = useProjects();

  // Use the provided projectId, or the preferred recent project when available
  const effectiveProjectId = projectId || resolvePreferredProjectId(projects);

  const {
    project,
    loading: projectLoading,
    error,
  } = useProject(effectiveProjectId ?? undefined);

  useEffect(() => {
    let cancelled = false;
    setChatProjectLoading(true);
    setChatProjectError(null);
    api
      .getDefaultChatProject()
      .then((data) => {
        if (!cancelled) {
          setChatProjectId(data.project.id);
          setChatProjectLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setChatProjectError(
            err instanceof Error ? err : new Error(String(err)),
          );
          setChatProjectLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Update browser tab title (must be called unconditionally before any early returns)
  useDocumentTitle(project?.name, t("newSessionTitle"));

  // Callback to update projectId in URL without navigation
  const handleProjectChange = (newProjectId: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("projectId", newProjectId);
    setSearchParams(nextParams, { replace: true });
  };

  const handleWorkspaceModeChange = (newMode: "chat" | "project") => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("workspace", newMode);
    if (effectiveProjectId) {
      nextParams.set("projectId", effectiveProjectId);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const loading =
    projectsLoading ||
    chatProjectLoading ||
    (workspaceMode === "project" ? projectLoading : false);

  // Guard against missing projectId (no projects available)
  if (
    workspaceMode === "project" &&
    !effectiveProjectId &&
    !projectsLoading &&
    projects.length === 0
  ) {
    return <div className="error">{t("newSessionNoProjects")}</div>;
  }

  // Render loading/error states
  if (loading || error || chatProjectError) {
    return (
      <div
        className={
          isWideScreen ? "main-content-wrapper" : "main-content-mobile"
        }
      >
        <div
          className={
            isWideScreen
              ? "main-content-constrained"
              : "main-content-mobile-inner"
          }
        >
          <PageHeader
            title={t("newSessionTitle")}
            onOpenSidebar={openSidebar}
            onToggleSidebar={toggleSidebar}
            isWideScreen={isWideScreen}
            isSidebarCollapsed={isSidebarCollapsed}
          />
          <main className="page-scroll-container">
            <div className="page-content-inner">
              {loading ? (
                <div className="loading">{t("newSessionLoading")}</div>
              ) : (
                <div className="error">
                  {t("newSessionErrorPrefix")}{" "}
                  {(error ?? chatProjectError)?.message}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div
      className={isWideScreen ? "main-content-wrapper" : "main-content-mobile"}
    >
      <div
        className={
          isWideScreen
            ? "main-content-constrained"
            : "main-content-mobile-inner"
        }
      >
        <PageHeader
          title={project?.name ?? t("newSessionTitle")}
          titleElement={
            workspaceMode === "project" && effectiveProjectId ? (
              <ProjectSelector
                currentProjectId={effectiveProjectId}
                currentProjectName={project?.name}
                onProjectChange={(p) => handleProjectChange(p.id)}
              />
            ) : undefined
          }
          onOpenSidebar={openSidebar}
          onToggleSidebar={toggleSidebar}
          isWideScreen={isWideScreen}
          isSidebarCollapsed={isSidebarCollapsed}
        />

        <main className="page-scroll-container">
          <div className="page-content-inner">
            <NewSessionForm
              projectId={effectiveProjectId ?? null}
              chatProjectId={chatProjectId}
              workspaceMode={workspaceMode}
              onWorkspaceModeChange={handleWorkspaceModeChange}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
