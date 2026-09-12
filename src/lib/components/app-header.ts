/**
 * Returns whether a navigation item owns the current route.
 *
 * Matching a complete path segment keeps `/learners` from activating the
 * `/learn` item while still keeping nested lesson routes active.
 */
export function isNavItemActive(currentPath: string, href: string): boolean {
  const current = normalizePath(currentPath);
  const target = normalizePath(href);

  return current === target || current.startsWith(`${target}/`);
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "/";

  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
  return withoutTrailingSlash || "/";
}
