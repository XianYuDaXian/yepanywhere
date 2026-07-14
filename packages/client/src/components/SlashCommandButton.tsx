import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

interface SlashCommandButtonProps {
  /** Available slash commands (without the "/" prefix) */
  commands: string[];
  /** Callback when a command is selected */
  onSelectCommand: (command: string) => void;
  /** Whether the button should be disabled */
  disabled?: boolean;
  forceOpen?: boolean;
  query?: string;
  onOpenChange?: (open: boolean) => void;
  /** 自定义菜单内容；提供时替换默认文字命令列表 */
  renderMenu?: (args: { query: string; onClose: () => void }) => ReactNode;
}

/**
 * Button that shows available slash commands in a dropdown menu.
 * Selecting a command inserts "/{command}" into the message input.
 */
export function SlashCommandButton({
  commands,
  onSelectCommand,
  disabled,
  forceOpen = false,
  query = "",
  onOpenChange,
  renderMenu,
}: SlashCommandButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = forceOpen || isOpen;
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCommands = normalizedQuery
    ? commands.filter((command) => command.toLowerCase().includes(normalizedQuery))
    : commands;

  const setOpenState = useCallback(
    (next: boolean) => {
      if (!forceOpen) {
        setIsOpen(next);
      }
      onOpenChange?.(next);
    },
    [forceOpen, onOpenChange],
  );

  // Close menu when clicking outside
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpenState(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, setOpenState]);

  // Close menu on Escape
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenState(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpenState]);

  const handleCommandClick = useCallback(
    (command: string) => {
      onSelectCommand(`/${command}`);
      setOpenState(false);
    },
    [onSelectCommand, setOpenState],
  );

  // 无自定义菜单且无可展示命令时不渲染按钮
  if (!renderMenu && commands.length === 0) {
    return null;
  }

  return (
    <div className="slash-command-container">
      <button
        ref={buttonRef}
        type="button"
        className={`slash-command-button ${open ? "active" : ""}`}
        onClick={() => setOpenState(!open)}
        disabled={disabled}
        title="Slash commands"
        aria-label="Show slash commands"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="slash-icon">/</span>
      </button>
      {open && (
        <div ref={menuRef} className="slash-command-menu-host">
          {renderMenu ? (
            renderMenu({
              query,
              onClose: () => setOpenState(false),
            })
          ) : (
            <div
              className="slash-command-menu"
              role="menu"
              aria-label="Slash commands"
            >
              {visibleCommands.map((command) => (
                <button
                  key={command}
                  type="button"
                  className="slash-command-item"
                  onClick={() => handleCommandClick(command)}
                  role="menuitem"
                >
                  /{command}
                </button>
              ))}
              {visibleCommands.length === 0 && (
                <div className="slash-command-empty">No commands</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
