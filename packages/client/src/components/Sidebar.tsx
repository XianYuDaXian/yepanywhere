import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { GlobalSessionItem } from "../api/client";
import { useOptionalRemoteConnection } from "../contexts/RemoteConnectionContext";
import { useDrafts } from "../hooks/useDrafts";
import { useGlobalSessions } from "../hooks/useGlobalSessions";
import { useNeedsAttentionBadge } from "../hooks/useNeedsAttentionBadge";
import { resolvePreferredProjectId } from "../hooks/useRecentProject";
import { useRecentProjects } from "../hooks/useRecentProjects";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useVersion } from "../hooks/useVersion";
import { useI18n } from "../i18n";
import { isCodexPlainChatProjectPath } from "../lib/codexProjectScope";
import { getSessionDisplayTitle, toUrlProjectId } from "../utils";
import { AgentsNavItem } from "./AgentsNavItem";
import { SessionListItem } from "./SessionListItem";
import {
  SidebarIcons,
  SidebarNavItem,
  SidebarNavSection,
} from "./SidebarNavItem";
import { YepAnywhereLogo } from "./YepAnywhereLogo";

const SWIPE_THRESHOLD = 50; // 触发关闭的最小距离
const SWIPE_ENGAGE_THRESHOLD = 15; // 开始识别横向滑动的最小距离
const RECENT_SESSIONS_INITIAL = 10; // 初始展示的会话数量
const RECENT_SESSIONS_INCREMENT = 10; // 每次展开追加的会话数量

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: () => void;

  /** Current session ID (for highlighting in sidebar) */
  currentSessionId?: string;

  /** Desktop mode: sidebar is always visible, no overlay */
  isDesktop?: boolean;
  /** Desktop mode: sidebar is collapsed (icons only) */
  isCollapsed?: boolean;
  /** Desktop mode: callback to toggle expanded/collapsed state */
  onToggleExpanded?: () => void;
  /** Desktop mode: current sidebar width in pixels */
  sidebarWidth?: number;
  /** Desktop mode: called when resize starts */
  onResizeStart?: () => void;
  /** Desktop mode: called during resize with new width */
  onResize?: (width: number) => void;
  /** Desktop mode: called when resize ends */
  onResizeEnd?: () => void;
}

export function Sidebar({
  isOpen,
  onClose,
  onNavigate,
  currentSessionId,
  // Desktop mode props
  isDesktop = false,
  isCollapsed = false,
  onToggleExpanded,
  sidebarWidth,
  onResizeStart,
  onResize,
  onResizeEnd,
}: SidebarProps) {
  const { t } = useI18n();
  // Get base path for relay mode (e.g., "/remote/my-server")
  const basePath = useRemoteBasePath();
  const navigate = useNavigate();
  const remoteConnection = useOptionalRemoteConnection();

  // 侧栏需要同时切分项目会话和普通对话。
  const { sessions: globalSessions, loading: globalLoading } =
    useGlobalSessions({ limit: 500, includeStats: false });

  const sessionsLoading = globalLoading;

  // Server capabilities for feature gating
  const { version: versionInfo } = useVersion();
  const capabilities = versionInfo?.capabilities ?? [];

  // Global inbox count
  const inboxCount = useNeedsAttentionBadge();
  const { recentProjects, projects } = useRecentProjects();
  const projectWorkspaces = useMemo(
    () => projects.filter((p) => !isCodexPlainChatProjectPath(p.path)),
    [projects],
  );
  const recentProjectWorkspaces = useMemo(
    () => recentProjects.filter((p) => !isCodexPlainChatProjectPath(p.path)),
    [recentProjects],
  );
  const newSessionProjectId = resolvePreferredProjectId(
    projectWorkspaces,
    recentProjectWorkspaces[0]?.id,
  );

  const sidebarRef = useRef<HTMLElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const swipeEngaged = useRef<boolean>(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef<number | null>(null);
  const resizeStartWidth = useRef<number | null>(null);
  const [projectSessionsLimit, setProjectSessionsLimit] = useState(
    RECENT_SESSIONS_INITIAL,
  );
  const [plainChatSessionsLimit, setPlainChatSessionsLimit] = useState(
    RECENT_SESSIONS_INITIAL,
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    touchStartY.current = e.touches[0]?.clientY ?? null;
    swipeEngaged.current = false;
    setSwipeOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const currentX = e.touches[0]?.clientX;
    const currentY = e.touches[0]?.clientY;
    if (currentX === undefined || currentY === undefined) return;

    const diffX = currentX - touchStartX.current;
    const diffY = currentY - touchStartY.current;

    // If not yet engaged, check if we should engage the swipe
    if (!swipeEngaged.current) {
      const absDiffX = Math.abs(diffX);
      const absDiffY = Math.abs(diffY);

      // Engage swipe only if:
      // 1. Horizontal movement exceeds threshold
      // 2. Horizontal movement is greater than vertical (user is swiping, not scrolling)
      // 3. Movement is to the left (closing gesture)
      if (
        absDiffX > SWIPE_ENGAGE_THRESHOLD &&
        absDiffX > absDiffY &&
        diffX < 0
      ) {
        swipeEngaged.current = true;
      } else {
        return; // Not engaged yet, don't track offset
      }
    }

    // Only allow swiping left (negative offset)
    if (diffX < 0) {
      setSwipeOffset(diffX);
    }
  };

  const handleTouchEnd = () => {
    if (swipeEngaged.current && swipeOffset < -SWIPE_THRESHOLD) {
      onClose();
    }
    touchStartX.current = null;
    touchStartY.current = null;
    swipeEngaged.current = false;
    setSwipeOffset(0);
  };

  // Desktop sidebar resize handlers
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (!isDesktop || isCollapsed || !sidebarWidth) return;
    e.preventDefault();
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = sidebarWidth;
    setIsResizing(true);
    onResizeStart?.();
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (resizeStartX.current === null || resizeStartWidth.current === null)
        return;
      const diff = e.clientX - resizeStartX.current;
      const newWidth = resizeStartWidth.current + diff;
      onResize?.(newWidth);
    };

    const handleMouseUp = () => {
      resizeStartX.current = null;
      resizeStartWidth.current = null;
      setIsResizing(false);
      onResizeEnd?.();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, onResize, onResizeEnd]);

  // Handle switching hosts - disconnect and go to host picker
  const handleSwitchHost = () => {
    remoteConnection?.disconnect();
    navigate("/login");
    onNavigate();
  };

  const projectSessions = useMemo(() => {
    return globalSessions.filter(
      (s) => !s.isArchived && !isCodexPlainChatProjectPath(s.projectPath),
    );
  }, [globalSessions]);

  const plainChatSessions = useMemo(() => {
    return globalSessions.filter(
      (s) => !s.isArchived && isCodexPlainChatProjectPath(s.projectPath),
    );
  }, [globalSessions]);

  // Track which sessions have unsent drafts in localStorage
  const drafts = useDrafts();

  // In desktop mode, always render. In mobile mode, only render when open.
  if (!isDesktop && !isOpen) return null;

  // Sidebar toggle icon for desktop mode
  const SidebarToggleIcon = () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );

  return (
    <>
      {/* Only show overlay in non-desktop mode */}
      {!isDesktop && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          role="button"
          tabIndex={0}
          aria-label={t("actionCloseSidebar")}
        />
      )}
      <aside
        ref={sidebarRef}
        className="sidebar"
        onTouchStart={!isDesktop ? handleTouchStart : undefined}
        onTouchMove={!isDesktop ? handleTouchMove : undefined}
        onTouchEnd={!isDesktop ? handleTouchEnd : undefined}
        style={
          !isDesktop && swipeOffset < 0
            ? { transform: `translateX(${swipeOffset}px)`, transition: "none" }
            : undefined
        }
      >
        <div className="sidebar-header">
          {isDesktop && isCollapsed ? (
            /* Desktop collapsed mode: show toggle button to expand */
            <button
              type="button"
              className="sidebar-toggle"
              onClick={onToggleExpanded}
              title={t("actionExpandSidebar")}
              aria-label={t("actionExpandSidebar")}
            >
              <SidebarToggleIcon />
            </button>
          ) : isDesktop ? (
            /* Desktop expanded mode: show brand (toggle is in toolbar) */
            <span className="sidebar-brand">
              <YepAnywhereLogo />
            </span>
          ) : (
            /* Mobile mode: brand text + close button */
            <>
              <span className="sidebar-brand">
                <YepAnywhereLogo />
              </span>
              <button
                type="button"
                className="sidebar-close"
                onClick={onClose}
                aria-label={t("actionCloseSidebar")}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </>
          )}
        </div>

        <div className="sidebar-actions">
          {/* New Session: link to most recent project's new session page */}
          <SidebarNavItem
            to={
              newSessionProjectId
                ? `/new-session?projectId=${encodeURIComponent(newSessionProjectId)}`
                : "/new-session"
            }
            icon={SidebarIcons.newSession}
            label={t("sidebarNewSession")}
            onClick={onNavigate}
            basePath={basePath}
          />
        </div>

        <div className="sidebar-sessions">
          {/* Navigation items that scroll with content */}
          <SidebarNavSection>
            <SidebarNavItem
              to="/inbox"
              icon={SidebarIcons.inbox}
              label={t("sidebarInbox")}
              badge={inboxCount}
              onClick={onNavigate}
              basePath={basePath}
            />
            <SidebarNavItem
              to="/sessions"
              icon={SidebarIcons.allSessions}
              label={t("sidebarAllSessions")}
              onClick={onNavigate}
              basePath={basePath}
            />
            <SidebarNavItem
              to="/projects"
              icon={SidebarIcons.projects}
              label={t("sidebarProjects")}
              onClick={onNavigate}
              basePath={basePath}
            />
            {capabilities.includes("git-status") && (
              <SidebarNavItem
                to="/git-status"
                icon={SidebarIcons.sourceControl}
                label={t("sidebarSourceControl")}
                onClick={onNavigate}
                basePath={basePath}
              />
            )}
            {(capabilities.includes("deviceBridge") ||
              capabilities.includes("deviceBridge-download")) && (
              <SidebarNavItem
                to="/devices"
                icon={SidebarIcons.emulator}
                label={t("sidebarDevices")}
                onClick={onNavigate}
                basePath={basePath}
              />
            )}
            <AgentsNavItem onClick={onNavigate} basePath={basePath} />
            <SidebarNavItem
              to="/settings"
              icon={SidebarIcons.settings}
              label={t("sidebarSettings")}
              onClick={onNavigate}
              basePath={basePath}
            />
            {/* Switch Host - show whenever we have a remote connection */}
            {remoteConnection && (
              <button
                type="button"
                className="sidebar-nav-item sidebar-switch-host"
                onClick={handleSwitchHost}
              >
                <span className="sidebar-nav-icon">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="17 1 21 5 17 9" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <polyline points="7 23 3 19 7 15" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                </span>
                <span className="sidebar-nav-label">
                  {t("sidebarSwitchHost")}
                </span>
              </button>
            )}
          </SidebarNavSection>

          <div className="sidebar-section">
            <h3 className="sidebar-section-title">
              {t("sidebarSectionProjectSessions")}
            </h3>
            {projectSessions.length > 0 ? (
              <>
                <ul className="sidebar-session-list">
                  {projectSessions
                    .slice(0, projectSessionsLimit)
                    .map((session) => (
                      <SessionListItem
                        key={session.id}
                        sessionId={session.id}
                        projectId={session.projectId}
                        title={getSessionDisplayTitle(session)}
                        fullTitle={getSessionDisplayTitle(session)}
                        provider={session.provider}
                        status={session.ownership}
                        pendingInputType={session.pendingInputType}
                        hasUnread={session.hasUnread}
                        isStarred={session.isStarred}
                        isArchived={session.isArchived}
                        mode="compact"
                        isCurrent={session.id === currentSessionId}
                        activity={session.activity}
                        onNavigate={onNavigate}
                        showProjectName
                        projectName={session.projectName}
                        basePath={basePath}
                        messageCount={session.messageCount}
                        hasDraft={drafts.has(session.id)}
                      />
                    ))}
                </ul>
                {projectSessions.length > projectSessionsLimit && (
                  <button
                    type="button"
                    className="sidebar-show-more"
                    onClick={() =>
                      setProjectSessionsLimit(
                        (prev) => prev + RECENT_SESSIONS_INCREMENT,
                      )
                    }
                  >
                    {t("actionShowMore", {
                      count: Math.min(
                        RECENT_SESSIONS_INCREMENT,
                        projectSessions.length - projectSessionsLimit,
                      ),
                    })}
                  </button>
                )}
              </>
            ) : (
              <p className="sidebar-empty sidebar-empty-section">
                {sessionsLoading
                  ? t("sidebarLoadingSessions")
                  : t("sidebarNoProjectSessions")}
              </p>
            )}
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-section-title">
              {t("sidebarSectionPlainChats")}
            </h3>
            {plainChatSessions.length > 0 ? (
              <>
                <ul className="sidebar-session-list">
                  {plainChatSessions
                    .slice(0, plainChatSessionsLimit)
                    .map((session) => (
                      <SessionListItem
                        key={session.id}
                        sessionId={session.id}
                        projectId={session.projectId}
                        title={getSessionDisplayTitle(session)}
                        fullTitle={getSessionDisplayTitle(session)}
                        provider={session.provider}
                        status={session.ownership}
                        pendingInputType={session.pendingInputType}
                        hasUnread={session.hasUnread}
                        isStarred={session.isStarred}
                        isArchived={session.isArchived}
                        mode="compact"
                        isCurrent={session.id === currentSessionId}
                        activity={session.activity}
                        onNavigate={onNavigate}
                        basePath={basePath}
                        messageCount={session.messageCount}
                        hasDraft={drafts.has(session.id)}
                      />
                    ))}
                </ul>
                {plainChatSessions.length > plainChatSessionsLimit && (
                  <button
                    type="button"
                    className="sidebar-show-more"
                    onClick={() =>
                      setPlainChatSessionsLimit(
                        (prev) => prev + RECENT_SESSIONS_INCREMENT,
                      )
                    }
                  >
                    {t("actionShowMore", {
                      count: Math.min(
                        RECENT_SESSIONS_INCREMENT,
                        plainChatSessions.length - plainChatSessionsLimit,
                      ),
                    })}
                  </button>
                )}
              </>
            ) : (
              <p className="sidebar-empty sidebar-empty-section">
                {sessionsLoading
                  ? t("sidebarLoadingSessions")
                  : t("sidebarNoPlainChats")}
              </p>
            )}
          </div>
        </div>

        {/* Resize handle - desktop only, when expanded */}
        {isDesktop && !isCollapsed && (
          <div
            className={`sidebar-resize-handle ${isResizing ? "active" : ""}`}
            onMouseDown={handleResizeMouseDown}
            role="separator"
            aria-orientation="vertical"
            aria-label={t("actionResizeSidebar")}
            tabIndex={0}
          />
        )}
      </aside>
    </>
  );
}
