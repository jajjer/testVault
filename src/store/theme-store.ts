import { create } from "zustand";

const STORAGE_KEY = "testvault-theme";
const LEGACY_THEME_KEY = "railyard-theme";

function applyDomTheme(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function readStoredTheme(): "light" | "dark" {
  try {
    if (typeof localStorage === "undefined") return "light";
    let s = localStorage.getItem(STORAGE_KEY);
    if (s !== "dark" && s !== "light") {
      const legacy = localStorage.getItem(LEGACY_THEME_KEY);
      if (legacy === "dark" || legacy === "light") {
        localStorage.setItem(STORAGE_KEY, legacy);
        s = legacy;
      }
    }
    if (s === "dark" || s === "light") return s;
  } catch {
    /* ignore */
  }
  return "light";
}

const initialTheme = readStoredTheme();
applyDomTheme(initialTheme);

interface ThemeState {
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme,

  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
    applyDomTheme(theme);
    set({ theme });
  },

  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    get().setTheme(next);
  },
}));
