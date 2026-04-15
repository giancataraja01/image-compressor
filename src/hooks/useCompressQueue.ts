/**
 * useCompressQueue — sequential one-by-one compression with per-file
 * status updates, progress tracking, error resilience, and cancellation.
 *
 * Usage:
 *   const queue = useCompressQueue({ compressImage, onFileUpdate, onLog });
 *   queue.start(files, outputDir, options);  // kick off
 *   queue.cancel();                          // abort remaining
 */

import { useCallback, useRef, useState } from "react";
import type { ImageFile, CompressionOptions, CompressResult } from "../types";
import { fmtSize } from "../utils/format";
import { friendlyError } from "../utils/errors";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Status update pushed to the consumer for every file transition. */
export interface FileUpdate {
  id: string;
  status: ImageFile["status"];
  compressedSize?: number;
  outputPath?: string;
  savingsPercent?: number;
  error?: string;
}

interface UseCompressQueueOptions {
  /** The bridge function that calls Rust for a single file. */
  compressImage: (
    inputPath: string,
    outputFolder: string,
    options: CompressionOptions
  ) => Promise<CompressResult>;

  /**
   * Called after each file finishes (success or failure).
   * The consumer applies this to its own `files` state.
   */
  onFileUpdate: (update: FileUpdate) => void;

  /** Append a line to the activity log. */
  onLog: (message: string) => void;
}

export interface CompressQueueState {
  /** True while the queue is processing. */
  isCompressing: boolean;
  /** Number of files finished so far in this run. */
  completed: number;
  /** Total files in the current batch (0 when idle). */
  total: number;
}

/** Summary produced after a batch completes. */
export interface BatchSummary {
  /** Number of files that compressed successfully. */
  succeeded: number;
  /** Number of files that failed. */
  failed: number;
  /** Total original size in bytes. */
  totalOriginal: number;
  /** Total compressed size in bytes. */
  totalCompressed: number;
  /** Elapsed wall-clock time in milliseconds. */
  elapsedMs: number;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useCompressQueue({
  compressImage,
  onFileUpdate,
  onLog,
}: UseCompressQueueOptions) {
  const [state, setState] = useState<CompressQueueState>({
    isCompressing: false,
    completed: 0,
    total: 0,
  });

  // Cancellation flag — checked between files.
  const cancelledRef = useRef(false);

  /**
   * Process `files` one at a time. Each file transitions through:
   *
   *   pending → compressing → done | error
   *
   * A failure on one file does NOT stop the rest.
   */
  const start = useCallback(
    async (
      files: ImageFile[],
      outputDir: string,
      options: CompressionOptions
    ): Promise<BatchSummary | null> => {
      const pending = files.filter((f) => f.status === "pending");
      if (pending.length === 0 || !outputDir) return null;

      cancelledRef.current = false;
      setState({ isCompressing: true, completed: 0, total: pending.length });
      onLog(
        `Compressing ${pending.length} image${pending.length > 1 ? "s" : ""}…`
      );

      let done = 0;
      let succeeded = 0;
      let failed = 0;
      let totalOriginal = 0;
      let totalCompressed = 0;
      const t0 = performance.now();

      for (const file of pending) {
        // --- check cancellation before starting the next file ---
        if (cancelledRef.current) {
          onLog(`Cancelled — ${pending.length - done} image${pending.length - done > 1 ? "s" : ""} skipped.`);
          break;
        }

        // Mark as compressing
        onFileUpdate({ id: file.id, status: "compressing" });
        onLog(`Processing ${file.name}…`);

        try {
          const result = await compressImage(file.path, outputDir, options);

          if (result.success) {
            succeeded += 1;
            totalOriginal += result.originalSize;
            totalCompressed += result.compressedSize;
            onFileUpdate({
              id: file.id,
              status: "done",
              compressedSize: result.compressedSize,
              outputPath: result.outputPath,
              savingsPercent: result.savingsPercent,
            });
            onLog(
              `✓ ${file.name} — ${fmtSize(result.originalSize)} → ${fmtSize(result.compressedSize)} (−${result.savingsPercent.toFixed(1)}%)`
            );
          } else {
            failed += 1;
            const msg = friendlyError(result.errorCode, result.error);
            onFileUpdate({
              id: file.id,
              status: "error",
              error: msg,
            });
            onLog(`✗ ${file.name} — ${msg}`);
          }
        } catch (err) {
          // IPC-level failure (e.g. command rejected before reaching Rust)
          failed += 1;
          const msg = typeof err === "string" ? err : "Compression failed — check the log for details.";
          onFileUpdate({
            id: file.id,
            status: "error",
            error: msg,
          });
          onLog(`✗ ${file.name} — ${msg}`);
        }

        done += 1;
        setState((prev) => ({ ...prev, completed: done }));
      }

      onLog("All done.");
      setState({ isCompressing: false, completed: done, total: pending.length });

      return {
        succeeded,
        failed,
        totalOriginal,
        totalCompressed,
        elapsedMs: performance.now() - t0,
      };
    },
    [compressImage, onFileUpdate, onLog]
  );

  /** Cancel after the current file finishes. */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  return { ...state, start, cancel } as const;
}
