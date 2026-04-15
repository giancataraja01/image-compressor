/**
 * useOutputFolder — reusable hook for Tauri native folder selection.
 *
 * Wraps `@tauri-apps/plugin-dialog` `open({ directory: true })` with
 * React state management, safe cancel handling, and localStorage
 * persistence so the last-used folder is remembered across restarts.
 *
 * Usage:
 *   const { outputDir, pickOutputFolder } = useOutputFolder();
 */

import { useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";

const STORAGE_KEY = "imageCompressor:outputDir";

/**
 * Open the native macOS folder picker.
 *
 * @param title  Dialog title shown in the picker window.
 * @returns      The selected folder's absolute path, or `null` if cancelled.
 */
export async function pickFolder(
  title = "Select Output Folder"
): Promise<string | null> {
  const selected = await open({ directory: true, title });
  // `open` returns `string | string[] | null` for directory mode.
  // With `multiple` unset it's `string | null`.
  return typeof selected === "string" ? selected : null;
}

export function useOutputFolder() {
  const [outputDir, setOutputDir] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });

  /**
   * Open the native folder picker and store the result.
   * If the user cancels, state is left unchanged.
   *
   * @returns The selected path, or `null` if cancelled.
   */
  const pickOutputFolder = useCallback(async (): Promise<string | null> => {
    const dir = await pickFolder();
    if (dir) {
      setOutputDir(dir);
      try {
        localStorage.setItem(STORAGE_KEY, dir);
      } catch {
        /* storage full or blocked — non-critical */
      }
    }
    return dir;
  }, []);

  return { outputDir, setOutputDir, pickOutputFolder } as const;
}
