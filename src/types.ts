/* ------------------------------------------------------------------ */
/*  Image formats                                                      */
/* ------------------------------------------------------------------ */

/** Formats the app can read and write. */
export type ImageFormat = "jpeg" | "png" | "webp";

/** Output format selector — "original" keeps the source format. */
export type OutputFormat = "original" | ImageFormat;

/* ------------------------------------------------------------------ */
/*  Job status                                                         */
/* ------------------------------------------------------------------ */

/** Lifecycle of a single compression job. */
export type JobStatus = "pending" | "compressing" | "done" | "error";

/* ------------------------------------------------------------------ */
/*  Selected file                                                      */
/* ------------------------------------------------------------------ */

/** A file the user has added to the queue. */
export interface ImageFile {
  /** Client-side UUID — not related to the filesystem. */
  id: string;
  /** Absolute path on disk (provided by Tauri). */
  path: string;
  /** Display name (basename). */
  name: string;
  /** Original file size in bytes. */
  size: number;
  /** Detected format based on extension. */
  format: ImageFormat | "unknown";
  /** Current job status. */
  status: JobStatus;
  /** Size in bytes after compression (set when `status === "done"`). */
  compressedSize?: number;
  /** Absolute path of the compressed output file. */
  outputPath?: string;
  /** Error message (set when `status === "error"`). */
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  Compression settings                                               */
/* ------------------------------------------------------------------ */

/** User-configurable compression options. */
export interface CompressionOptions {
  /** Target format — or keep the source format. */
  outputFormat: OutputFormat;
  /** Quality 1–100 (ignored when `lossless` is true). */
  quality: number;
  /** Use lossless encoding (WebP/PNG only — JPEG falls back to Q=100). */
  lossless: boolean;
  /** Strip EXIF / ICC / XMP metadata from the output. */
  stripMetadata: boolean;
  /** Max width or height in pixels. 0 = no resize. */
  maxDimension: number;
}

/* ------------------------------------------------------------------ */
/*  Backend request / response (match Rust structs in compress.rs)     */
/* ------------------------------------------------------------------ */

/** Sent to the `compress_image` / `compress_batch` Tauri commands. */
export interface CompressRequest {
  /** Absolute path to the source image. */
  inputPath: string;
  /** Directory where the compressed file will be written. */
  outputFolder: string;
  /** Target format (`"jpeg"` | `"png"` | `"webp"`). `null` = keep original. */
  outputFormat: string | null;
  /** Quality 1–100. Ignored when `lossless` is true. */
  quality: number;
  /** Lossless encoding (WebP native, JPEG → Q=100, PNG default). */
  lossless: boolean;
  /** Strip EXIF / ICC / XMP metadata from the output. */
  stripMetadata: boolean;
  /** Max width or height in pixels. 0 = no resize. */
  maxDimension: number;
}

/** Per-file result returned by `compress_image` / inside `BatchCompressResult`. */
export interface CompressResult {
  success: boolean;
  /** Echo of the input path — correlates results in batch mode. */
  inputPath: string;
  outputPath: string;
  originalSize: number;
  compressedSize: number;
  /** `(1 - compressed / original) * 100`. 0 on failure. */
  savingsPercent: number;
  error?: string;
  /** Machine-readable error code from `ErrorCode` enum (Rust). */
  errorCode?: string;
}

/** Returned by the `compress_batch` Tauri command. */
export interface BatchCompressResult {
  results: CompressResult[];
  total: number;
  succeeded: number;
  failed: number;
}

/** Returned by the `get_file_info` Tauri command. */
export interface FileInfo {
  path: string;
  name: string;
  size: number;
  format: string;
}

/** Returned by the `check_vips_installed` Tauri command. */
export interface VipsStatus {
  success: boolean;
  version: string | null;
  error: string | null;
}
