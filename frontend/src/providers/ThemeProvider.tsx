import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  compactMode: boolean;
  animationsEnabled: boolean;
  setTheme: (theme: Theme) => void;
  setCompactMode: (compact: boolean) => void;
  setAnimationsEnabled: (animations: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [compactMode, setCompactModeState] = useState(false);
  const [animationsEnabled, setAnimationsEnabledState] = useState(true);

  // Load initial from local storage or set defaults
  useEffect(() => {
    const savedTheme = localStorage.getItem("aegis_theme") as Theme | null;
    const savedCompact = localStorage.getItem("aegis_compact");
    const savedAnimations = localStorage.getItem("aegis_animations");

    if (savedTheme) setThemeState(savedTheme);
    if (savedCompact !== null) setCompactModeState(savedCompact === "true");
    if (savedAnimations !== null) setAnimationsEnabledState(savedAnimations === "true");

    // Fetch from Supabase user metadata if available
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (user && user.user_metadata) {
        const meta = user.user_metadata;
        if (meta.pref_theme) {
          setThemeState(meta.pref_theme as Theme);
          localStorage.setItem("aegis_theme", meta.pref_theme);
        }
        if (meta.pref_compact !== undefined) {
          setCompactModeState(meta.pref_compact);
          localStorage.setItem("aegis_compact", String(meta.pref_compact));
        }
        if (meta.pref_animations !== undefined) {
          setAnimationsEnabledState(meta.pref_animations);
          localStorage.setItem("aegis_animations", String(meta.pref_animations));
        }
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session?.user?.user_metadata) {
          const meta = session.user.user_metadata;
          if (meta.pref_theme) {
            setThemeState(meta.pref_theme as Theme);
            localStorage.setItem("aegis_theme", meta.pref_theme);
          }
          if (meta.pref_compact !== undefined) {
            setCompactModeState(meta.pref_compact);
            localStorage.setItem("aegis_compact", String(meta.pref_compact));
          }
          if (meta.pref_animations !== undefined) {
            setAnimationsEnabledState(meta.pref_animations);
            localStorage.setItem("aegis_animations", String(meta.pref_animations));
          }
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Apply attributes
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (compactMode) {
      document.documentElement.setAttribute("data-compact", "true");
    } else {
      document.documentElement.removeAttribute("data-compact");
    }
    if (!animationsEnabled) {
      document.documentElement.setAttribute("data-no-animations", "true");
    } else {
      document.documentElement.removeAttribute("data-no-animations");
    }
  }, [theme, compactMode, animationsEnabled]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("aegis_theme", newTheme);
  };

  const setCompactMode = (compact: boolean) => {
    setCompactModeState(compact);
    localStorage.setItem("aegis_compact", String(compact));
  };

  const setAnimationsEnabled = (animations: boolean) => {
    setAnimationsEnabledState(animations);
    localStorage.setItem("aegis_animations", String(animations));
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        compactMode,
        animationsEnabled,
        setTheme,
        setCompactMode,
        setAnimationsEnabled,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
