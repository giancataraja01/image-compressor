/**
 * useFileDrop — handles Tauri native drag-and-drop + file classification.
 *
 * Responsibilities:
 *   1. Register / cleanup the Tauri `onDragDropEvent` listener (once)
 *   2. Track `isDragging` visual state
 *   3. Split dropped paths into accepted / rejected / duplicate buckets
 *   4. Call the consumer's `onDrop` callback with the three buckets
 *
 * The hook never touches React file state directly — the consumer decides
 * what to do with the classified paths (e.g. call getFileInfo, log, etc.).
 */

import { useEffect, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";

/* ------------------------------------------------------------------ */
/*  Pure helpers (exported so App.tsx / tests can reuse them)          */
/* ------------------------------------------------------------------ */

const SUPPORTED_EXT = ["jpg", "jpeg", "png", "webp"] as const;
export type SupportedExt = (typeof SUPPORTED_EXT)[number];

/** Extract the lowercase extension from an absolute path. */
export function extOf(path: string): string {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

/** True when the path ends with a supported image extension. */
export function isSupportedImage(path: string): boolean {
  return (SUPPORTED_EXT as readonly string[]).includes(extOf(path));
}

/**
 * Classify an array of file paths.
 *
 * @param paths        Raw paths from the drop event or file dialog.
 * @param existingSet  Set of paths already in the queue (for dedup).
 * @returns `{ accepted, rejected, duplicates }`
 */
export function classifyPaths(
  paths: string[],
  existingSet: Set<string>
): {
  accepted: string[];
  rejected: string[];
  duplicates: string[];
} {
  const accepted: string[] = [];
  const rejected: string[] = [];
  const duplicates: string[] = [];

  for (const p of paths) {
    if (!isSupportedImage(p)) {
      rejected.push(p);
    } else if (existingSet.has(p)) {
      duplicates.push(p);
    } else {
      accepted.push(p);
      // Also record in the set so two identical paths in the same
      // drop batch don't both land in `accepted`.
      existingSet.add(p);
    }
  }

  return { accepted, rejected, duplicates };
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export interface DropResult {
  accepted: string[];
  rejected: string[];
  duplicates: string[];
}

interface UseFileDropOptions {
  /**
   * Current file paths already in the queue.
   * Passed as an array — the hook converts to a Set internally.
   */
  existingPaths: string[];
  /** Called after every valid drop with the classified paths. */
  onDrop: (result: DropResult) => void;
}

export function useFileDrop({ existingPaths, onDrop }: UseFileDropOptions) {
  const [isDragging, setIsDragging] = useState(false);

  // Keep a ref to the latest values so the listener registered once
  // always sees current state — no need to re‑register on every render.
  const existingRef = useRef(existingPaths);
  existingRef.current = existingPaths;

  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      const { type } = event.payload;

      if (type === "enter" || type === "over") {
        setIsDragging(true);
        return;
      }

      if (type === "leave") {
        setIsDragging(false);
        return;
      }

      // type === "drop"
      setIsDragging(false);
      const result = classifyPaths(
        event.payload.paths,
        new Set(existingRef.current)
      );
      onDropRef.current(result);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []); // registered once — refs keep it up to date

  return { isDragging } as const;
}
