import { describe, expect, it, vi } from "vitest";
import {
  createThemeRuntimeChange,
  emitThemeChange,
  readThemeChoice,
  resolveTheme,
  subscribeThemeChanges,
  THEME_STORAGE_KEY,
  writeThemeChoice,
} from "$lib/application/theme";

function storage(initial?: string): Storage {
  let value = initial ?? null;
  return {
    getItem: (key) => key === THEME_STORAGE_KEY ? value : null,
    setItem: (key, next) => { if (key === THEME_STORAGE_KEY) value = next; },
    removeItem: (key) => { if (key === THEME_STORAGE_KEY) value = null; },
    clear: () => { value = null; },
    key: () => null,
    get length() { return value === null ? 0 : 1; },
  };
}

describe("theme preference", () => {
  it("uses system when no explicit preference exists", () => {
    expect(readThemeChoice(storage())).toBe("system");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("persists explicit choices and clears them for system", () => {
    const target = storage();
    writeThemeChoice(target, "dark");
    expect(readThemeChoice(target)).toBe("dark");
    expect(resolveTheme(readThemeChoice(target), false)).toBe("dark");
    writeThemeChoice(target, "system");
    expect(readThemeChoice(target)).toBe("system");
  });

  it("ignores malformed values", () => {
    expect(readThemeChoice(storage("midnight"))).toBe("system");
  });

  it("keeps runtime theme controls synchronized through one event", () => {
    const target = new EventTarget();
    vi.stubGlobal("window", target);
    try {
      const changes: ReturnType<typeof createThemeRuntimeChange>[] = [];
      const unsubscribe = subscribeThemeChanges((change) => changes.push(change));

      emitThemeChange(createThemeRuntimeChange("system", true));
      expect(changes).toEqual([{ choice: "system", theme: "dark" }]);

      unsubscribe();
      emitThemeChange(createThemeRuntimeChange("light", true));
      expect(changes).toEqual([{ choice: "system", theme: "dark" }]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
