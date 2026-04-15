import type { ImageFile, CompressionOptions } from "../types";

/* ------------------------------------------------------------------ */
/*  Validation errors                                                  */
/* ------------------------------------------------------------------ */

export interface ValidationErrors {
  files?: string;
  outputDir?: string;
  quality?: string;
}

/* ------------------------------------------------------------------ */
/*  Core validator                                                     */
/* ------------------------------------------------------------------ */

export function validate(
  files: ImageFile[],
  outputDir: string | null,
  options: CompressionOptions,
): ValidationErrors {
  const errors: ValidationErrors = {};

  /* At least one pending file */
  const pending = files.filter((f) => f.status === "pending");
  if (files.length === 0) {
    errors.files = "Add at least one image to get started.";
  } else if (pending.length === 0) {
    errors.files = "All images have been processed. Add new images to continue.";
  }

  /* Unsupported file check (belt-and-suspenders — should never slip through) */
  const unsupported = files.filter((f) => f.format === "unknown" && f.status === "pending");
  if (unsupported.length > 0) {
    const names = unsupported.map((f) => f.name).join(", ");
    errors.files = `Unsupported format: ${names}. Only JPEG, PNG, and WebP are accepted.`;
  }

  /* Output folder */
  if (!outputDir) {
    errors.outputDir = "Select a destination folder before compressing.";
  }

  /* Quality range */
  if (!Number.isInteger(options.quality) || options.quality < 1 || options.quality > 100) {
    errors.quality = "Quality must be a whole number from 1 to 100.";
  }

  return errors;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function isValid(errors: ValidationErrors): boolean {
  return Object.keys(errors).length === 0;
}
