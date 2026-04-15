/**
 * useCompression — single bridge layer between React and Tauri/Rust.
 *
 * Every Rust `#[tauri::command]` is exposed here as a typed async function.
 * Components should NEVER call `invoke()` directly — always go through this hook.
 *
 * Rust command            → hook method             → returns
 * ─────────────────────────────────────────────────────────────────
 * check_vips_installed    → checkVipsInstalled()    → VipsStatus
 * get_file_info           → getFileInfo(path)       → FileInfo
 * compress_image          → compressImage(…)        → CompressResult
 * compress_batch          → compressBatch(…)        → BatchCompressResult
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  CompressionOptions,
  CompressRequest,
  CompressResult,
  BatchCompressResult,
  FileInfo,
  VipsStatus,
} from "../types";

/** Build a `CompressRequest` from UI-level types. */
function buildRequest(
  inputPath: string,
  outputFolder: string,
  options: CompressionOptions
): CompressRequest {
  return {
    inputPath,
    outputFolder,
    quality: options.quality,
    outputFormat:
      options.outputFormat === "original" ? null : options.outputFormat,
    lossless: options.lossless,
    stripMetadata: options.stripMetadata,
    maxDimension: options.maxDimension,
  };
}

export function useCompression() {
  /** Check whether vips is installed; resolves with a structured status. */
  async function checkVipsInstalled(): Promise<VipsStatus> {
    return invoke<VipsStatus>("check_vips_installed");
  }

  /** Read basic metadata for a file on disk. */
  async function getFileInfo(path: string): Promise<FileInfo> {
    return invoke<FileInfo>("get_file_info", { path });
  }

  /**
   * Compress a single image.
   *
   * @param inputPath     Absolute path to the source image.
   * @param outputFolder  Absolute path to the output directory.
   * @param options       Compression settings from the UI.
   */
  async function compressImage(
    inputPath: string,
    outputFolder: string,
    options: CompressionOptions
  ): Promise<CompressResult> {
    const request = buildRequest(inputPath, outputFolder, options);
    return invoke<CompressResult>("compress_image", { request });
  }

  /**
   * Compress multiple images in one IPC round-trip.
   *
   * @param inputPaths    Array of absolute source paths.
   * @param outputFolder  Shared output directory.
   * @param options       Compression settings (applied to every file).
   */
  async function compressBatch(
    inputPaths: string[],
    outputFolder: string,
    options: CompressionOptions
  ): Promise<BatchCompressResult> {
    const requests = inputPaths.map((p) =>
      buildRequest(p, outputFolder, options)
    );
    return invoke<BatchCompressResult>("compress_batch", { requests });
  }

  return {
    checkVipsInstalled,
    getFileInfo,
    compressImage,
    compressBatch,
  } as const;
}
