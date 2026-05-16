export function isCodexPlainChatProjectPath(path: string | undefined): boolean {
  if (!path) return false;
  const normalized = path.replace(/\\/g, "/");
  return /\/Documents\/Codex\/\d{4}-\d{2}-\d{2}(?:\/|$)/.test(normalized);
}
