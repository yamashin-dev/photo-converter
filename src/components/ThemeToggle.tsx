"use client";

import { useSyncExternalStore } from "react";
import styles from "./ThemeToggle.module.css";
import { IconMoon, IconSun } from "./Icon";
import {
  getThemeServerSnapshot,
  getThemeSnapshot,
  subscribeTheme,
  toggleTheme,
} from "@/lib/theme";

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);

  return (
    <button
      type="button"
      className={styles.button}
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "ライトモードに切り替える" : "ダークモードに切り替える"}
    >
      {theme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
    </button>
  );
}
