"use client";

import { useEffect } from "react";
import { useSaliStore } from "@/lib/store";

// Applies the persisted theme to the <html> element's class list.
// Must be rendered once at the root level.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSaliStore((s) => s.theme);

  useEffect(() => {
    const html = document.documentElement;
    if (theme === "light") {
      html.classList.remove("dark");
      html.classList.add("light");
    } else {
      html.classList.remove("light");
      html.classList.add("dark");
    }
  }, [theme]);

  return <>{children}</>;
}
