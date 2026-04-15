/**
 * errors.ts — maps machine-readable error codes from the Rust backend
 * to user-friendly messages for the UI.
 *
 * Error codes come from the `ErrorCode` enum in compress.rs, serialized
 * as SCREAMING_SNAKE_CASE (e.g. "FILE_NOT_FOUND", "PERMISSION_DENIED").
 *
 * `get_file_info` errors use a "CODE: detail" prefix format instead.
 */

/* ------------------------------------------------------------------ */
/*  Error-code → friendly message map                                  */
/* ------------------------------------------------------------------ */

const FRIENDLY: Record<string, string> = {
  FILE_NOT_FOUND: "File not found — it may have been moved or deleted.",
  UNSUPPORTED_FORMAT: "This image format is not supported.",
  PERMISSION_DENIED: "Permission denied — check that the app can access this file.",
  OUTPUT_FOLDER_ERROR: "Cannot write to the destination folder. Please choose a different one.",
  VIPS_NOT_INSTALLED: "vips is not installed. See the README for setup instructions.",
  VIPS_EXEC_FAILED: "Compression failed for this image. The file may be corrupted.",
  INVALID_FILENAME: "This filename contains characters that cannot be processed.",
  METADATA_ERROR: "Unable to read file metadata.",
  UNKNOWN: "Something went wrong. Please try again.",
};

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Return a user-friendly message for a CompressResult error.
 *
 * Prefers `errorCode` (stable); falls back to raw `error` string.
 */
export function friendlyError(
  errorCode?: string,
  rawError?: string
): string {
  if (errorCode && errorCode in FRIENDLY) {
    return FRIENDLY[errorCode];
  }
  return rawError ?? "An unexpected error occurred.";
}

/**
 * Parse a prefixed error string from `get_file_info`
 * (e.g. `"FILE_NOT_FOUND: /path/to/file"`) and return a friendly message.
 *
 * Falls back to the raw string if no known prefix is found.
 */
export function friendlyFileInfoError(raw: string): string {
  const colon = raw.indexOf(":");
  if (colon > 0) {
    const prefix = raw.slice(0, colon).trim();
    if (prefix in FRIENDLY) return FRIENDLY[prefix];
  }
  return raw;
}
