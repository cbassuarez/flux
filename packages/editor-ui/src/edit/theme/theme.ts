import { useEffect, useState } from "react";

export type EditorTheme = "dark" | "light" | "blueprint";

const STORAGE_KEY = "flux.theme";
const THEMES: EditorTheme[] = ["dark", "light", "blueprint"];

const isBrowser = typeof window !== "undefined";

function isTheme(value: string | null): value is EditorTheme {
  return value != null && THEMES.includes(value as EditorTheme);
}

export function getPreferredTheme(): EditorTheme {
  if (!isBrowser) return "dark";
  const stored = getStoredTheme();
  if (stored) return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

export function getStoredTheme(): EditorTheme | null {
  if (!isBrowser) return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function applyTheme(theme: EditorTheme) {
  if (!isBrowser) return;
  document.documentElement.dataset.theme = theme;
}

export function persistTheme(theme: EditorTheme) {
  applyTheme(theme);
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures.
  }
}

export function getTheme(): EditorTheme {
  if (!isBrowser) return "dark";
  const current = document.documentElement.dataset.theme;
  return isTheme(current) ? current : getPreferredTheme();
}

export function useTheme() {
  const [theme, setTheme] = useState<EditorTheme>(() => getTheme());

  useEffect(() => {
    persistTheme(theme);
  }, [theme]);

  return { theme, setTheme };
}
