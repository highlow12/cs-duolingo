export type Theme = "light" | "dark";
export type ThemeChoice = "system" | Theme;

export const THEME_STORAGE_KEY = "cs-duolingo:theme";
export const THEME_CHANGE_EVENT = "cs-duolingo:theme-change";

export type ThemeRuntimeChange = {
  choice: ThemeChoice;
  theme: Theme;
};

const THEME_META_COLOR: Record<Theme, string> = {
  light: "#f5f7f4",
  dark: "#111714",
};

export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Return a user preference, treating malformed or unavailable storage as system. */
export function readThemeChoice(storage: ThemeStorage | null | undefined): ThemeChoice {
  try {
    const stored = storage?.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

/** Persist an explicit choice; system removes the override so OS settings win. */
export function writeThemeChoice(
  storage: ThemeStorage | null | undefined,
  choice: ThemeChoice,
): void {
  try {
    if (!storage) return;
    if (choice === "system") storage.removeItem(THEME_STORAGE_KEY);
    else storage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // A blocked storage API should never prevent a theme change in this tab.
  }
}

export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): Theme {
  return choice === "system" ? (prefersDark ? "dark" : "light") : choice;
}

/** Resolve a preference into the payload shared by every theme control. */
export function createThemeRuntimeChange(
  choice: ThemeChoice,
  prefersDark: boolean,
): ThemeRuntimeChange {
  return { choice, theme: resolveTheme(choice, prefersDark) };
}

/** Apply the resolved theme without requiring a route reload. */
export function applyThemeToDocument(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_META_COLOR[theme]);
}

/** Broadcast a change to controls mounted in other routes/components. */
export function emitThemeChange(change: ThemeRuntimeChange): void {
  if (typeof window === "undefined" || typeof CustomEvent === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ThemeRuntimeChange>(THEME_CHANGE_EVENT, { detail: change }),
  );
}

/** Subscribe to theme changes and return a cleanup function for onMount. */
export function subscribeThemeChanges(
  listener: (change: ThemeRuntimeChange) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handle = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (!isThemeRuntimeChange(detail)) return;
    listener(detail);
  };
  window.addEventListener(THEME_CHANGE_EVENT, handle);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, handle);
}

function isThemeRuntimeChange(value: unknown): value is ThemeRuntimeChange {
  if (!value || typeof value !== "object") return false;
  const change = value as { choice?: unknown; theme?: unknown };
  return (
    (change.choice === "system" || change.choice === "light" || change.choice === "dark") &&
    (change.theme === "light" || change.theme === "dark")
  );
}

/** Resolve, persist, apply, and broadcast one user preference change. */
export function setThemePreference(choice: ThemeChoice): Theme {
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
  const change = createThemeRuntimeChange(choice, prefersDark);
  applyThemeToDocument(change.theme);
  if (typeof window !== "undefined") {
    try {
      writeThemeChoice(window.localStorage, choice);
    } catch {
      // A blocked storage API must not prevent the current-tab theme change.
    }
    emitThemeChange(change);
  }
  return change.theme;
}
