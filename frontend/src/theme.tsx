import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import type { ReactNode } from "react";
export type Theme = "light" | "dark";
type Preference = { theme: Theme; pending: boolean };
function readPreference(): Preference | null {
  try {
    const theme = localStorage.getItem("album-theme");
    if (theme !== "light" && theme !== "dark") return null;
    // Existing preferences predate account synchronization and are retained.
    return {
      theme,
      pending: localStorage.getItem("album-theme-pending") !== "0",
    };
  } catch {
    return null;
  }
}
function writePreference(value: Preference) {
  try {
    localStorage.setItem("album-theme", value.theme);
    localStorage.setItem("album-theme-pending", value.pending ? "1" : "0");
  } catch {}
}
type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  adoptTheme: (theme: Theme) => void;
  markSaved: (theme: Theme) => void;
  getPreference: () => Preference | null;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useRef<Preference | null>(readPreference());
  const [theme, updateTheme] = useState<Theme>(
    preference.current?.theme || "light",
  );
  const apply = useCallback((value: Preference) => {
    preference.current = value;
    writePreference(value);
    updateTheme(value.theme);
  }, []);
  const setTheme = useCallback(
    (theme: Theme) => apply({ theme, pending: true }),
    [apply],
  );
  const adoptTheme = useCallback(
    (theme: Theme) => apply({ theme, pending: false }),
    [apply],
  );
  const markSaved = useCallback(
    (theme: Theme) => {
      if (preference.current?.theme === theme) apply({ theme, pending: false });
    },
    [apply],
  );
  const getPreference = useCallback(() => preference.current, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#1c1724" : "#fcf5fc");
  }, [theme]);
  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (event.key === "album-theme" || event.key === "album-theme-pending") {
        const saved = readPreference();
        if (saved) {
          preference.current = saved;
          updateTheme(saved.theme);
        }
      }
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);
  const value = useMemo(
    () => ({ theme, setTheme, adoptTheme, markSaved, getPreference }),
    [theme, setTheme, adoptTheme, markSaved, getPreference],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("ThemeProvider is required");
  return value;
}
