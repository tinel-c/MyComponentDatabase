"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  type ThemeId,
  DEFAULT_THEME,
  DARK_THEME_IDS,
  THEME_STORAGE_KEY,
  getTheme,
} from "@/lib/themes";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
});

function applyTheme(id: ThemeId) {
  const html = document.documentElement;
  html.setAttribute("data-theme", id);
  if (DARK_THEME_IDS.includes(id)) {
    html.classList.add("dark");
    html.classList.remove("light");
  } else {
    html.classList.remove("dark");
    html.classList.add("light");
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    const initial = getTheme(stored).id;
    queueMicrotask(() => {
      setThemeState(initial);
      applyTheme(initial);
    });
  }, []);

  const setTheme = useCallback((newTheme: ThemeId) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export const themeFlashScript = `(function(){
  var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||${JSON.stringify(DEFAULT_THEME)};
  var dark=${JSON.stringify(DARK_THEME_IDS)};
  document.documentElement.setAttribute('data-theme',t);
  if(dark.indexOf(t)!==-1){document.documentElement.classList.add('dark')}
  else{document.documentElement.classList.remove('dark');document.documentElement.classList.add('light')}
}())`;
