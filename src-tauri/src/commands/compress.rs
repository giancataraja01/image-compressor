use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

/* ------------------------------------------------------------------ */
/*  Error codes                                                        */
/* ------------------------------------------------------------------ */

/// Stable error codes the frontend can match on to display contextual
/// messages. The string value is serialised as `errorCode` in JSON.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    FileNotFound,
    UnsupportedFormat,
    PermissionDenied,
    OutputFolderError,
    VipsNotInstalled,
    VipsExecFailed,
    InvalidFilename,
    MetadataError,
    Unknown,
}

/* ------------------------------------------------------------------ */
/*  Contract types                                                     */
/* ------------------------------------------------------------------ */

/// Request payload for a single image compression job.
/// `rename_all = "camelCase"` so the TS consumer sends idiomatic JS keys.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompressRequest {
    /// Absolute path to the source image.
    pub input_path: String,
    /// Directory where the compressed file will be written.
    pub output_folder: String,
    /// Target format (`"jpeg"`, `"png"`, `"webp"`). `None` = keep original.
    pub output_format: Option<String>,
    /// Quality 1–100. Ignored when `lossless` is true.
    pub quality: u32,
    /// Lossless encoding (WebP native, JPEG → Q=100, PNG → default compression).
    pub lossless: bool,
    /// Strip EXIF / ICC / XMP metadata from the output.
    pub strip_metadata: bool,
    /// Max width or height in pixels. 0 means no resize.
    pub max_dimension: u32,
}

/// Per-file result returned after compression.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompressResult {
    /// Whether this file was compressed successfully.
    pub success: bool,
    /// Echo of the input path — used to correlate results in batch mode.
    pub input_path: String,
    /// Absolute path to the generated file (empty on failure).
    pub output_path: String,
    /// Source file size in bytes.
    pub original_size: u64,
    /// Output file size in bytes (0 on failure).
    pub compressed_size: u64,
    /// Percentage saved: `(1 - compressed / original) * 100`. 0.0 on failure.
    pub savings_percent: f64,
    /// Human-readable error description (`None` on success).
    pub error: Option<String>,
    /// Stable machine-readable error code (`None` on success).
    pub error_code: Option<ErrorCode>,
}

/// Aggregate result returned by `compress_batch`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchCompressResult {
    /// One `CompressResult` per request, in the same order.
    pub results: Vec<CompressResult>,
    /// Total number of files in the batch.
    pub total: usize,
    /// Files that compressed successfully.
    pub succeeded: usize,
    /// Files that failed.
    pub failed: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub format: String,
}

/// Find the vips binary. Tauri apps don't inherit the user's shell PATH,
/// so we check well-known locations per platform before falling back to PATH.
fn find_vips_binary() -> Result<String, String> {
    // 1. Check next to the running executable (bundled vips on Windows)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let sibling = dir.join(if cfg!(windows) { "vips.exe" } else { "vips" });
            if sibling.exists() {
                let path = sibling.to_string_lossy().to_string();
                eprintln!("[vips] Found bundled at {}", path);
                return Ok(path);
            }
        }
    }

    // 2. Platform-specific well-known paths
    #[cfg(target_os = "macos")]
    {
        // Apple Silicon Homebrew
        let apple_silicon = "/opt/homebrew/bin/vips";
        if Path::new(apple_silicon).exists() {
            eprintln!("[vips] Found at {}", apple_silicon);
            return Ok(apple_silicon.to_string());
        }

        // Intel Mac Homebrew
        let intel = "/usr/local/bin/vips";
        if Path::new(intel).exists() {
            eprintln!("[vips] Found at {}", intel);
            return Ok(intel.to_string());
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Common install location via choco or manual install
        let choco = r"C:\ProgramData\chocolatey\bin\vips.exe";
        if Path::new(choco).exists() {
            eprintln!("[vips] Found at {}", choco);
            return Ok(choco.to_string());
        }
    }

    // 3. Fall back to PATH — verify it actually resolves
    let vips_name = if cfg!(windows) { "vips.exe" } else { "vips" };
    match Command::new(vips_name).arg("--version").output() {
        Ok(o) if o.status.success() => {
            eprintln!("[vips] Found on PATH");
            Ok(vips_name.to_string())
        }
        _ => {
            eprintln!("[vips] NOT FOUND in any known location");
            let hint = if cfg!(windows) {
                "vips is not installed. Download it from https://github.com/libvips/build-win64-mxe/releases and add it to PATH."
            } else {
                "vips is not installed. Install it with: brew install vips"
            };
            Err(hint.to_string())
        }
    }
}

fn detect_format(path: &Path) -> Option<&'static str> {
    path.extension()
        .and_then(|ext| ext.to_str())
        .and_then(|ext| match ext.to_lowercase().as_str() {
            "jpg" | "jpeg" => Some("jpeg"),
            "png" => Some("png"),
            "webp" => Some("webp"),
            _ => None,
        })
}

/// Build the vips output suffix string for the given format, quality, and flags.
///
/// - JPEG:  `[Q=<quality>,strip]`  or `[Q=100,strip]` when lossless
/// - WebP:  `[Q=<quality>,strip]`  or `[lossless,strip]`
/// - PNG:   `[compression=<level>,strip]`
fn build_vips_suffix(format: &str, quality: u32, lossless: bool, strip: bool) -> String {
    let mut opts: Vec<String> = Vec::new();

    match format {
        "jpeg" => {
            let q = if lossless { 100 } else { quality };
            opts.push(format!("Q={}", q));
        }
        "webp" => {
            if lossless {
                opts.push("lossless".to_string());
            } else {
                opts.push(format!("Q={}", quality));
            }
        }
        "png" => {
            if !lossless {
                let compression = ((100u32.saturating_sub(quality)) * 9) / 100;
                opts.push(format!("compression={}", compression));
            }
        }
        _ => {}
    }

    if strip {
        opts.push("strip".to_string());
    }

    if opts.is_empty() {
        String::new()
    } else {
        format!("[{}]", opts.join(","))
    }
}

fn output_extension(format: &str) -> &'static str {
    match format {
        "jpeg" => "jpg",
        "png" => "png",
        "webp" => "webp",
        _ => "jpg",
    }
}

/// Convert a raw std::io::Error into a message a non-technical user can act on.
fn friendly_io_msg(err: &std::io::Error) -> String {
    match err.kind() {
        std::io::ErrorKind::NotFound => "the file or folder does not exist".to_string(),
        std::io::ErrorKind::PermissionDenied => "permission denied — check file or folder permissions".to_string(),
        _ => err.to_string(),
    }
}

/* ------------------------------------------------------------------ */
/*  Core logic (shared by single + batch commands)                     */
/* ------------------------------------------------------------------ */

/// Convenience: build a failed `CompressResult` with the given error.
fn fail(input_path: &str, original_size: u64, code: ErrorCode, error: impl Into<String>) -> CompressResult {
    let msg = error.into();
    eprintln!("[compress] ERROR {:?} — {} — {}", code, input_path, msg);
    CompressResult {
        success: false,
        input_path: input_path.to_string(),
        output_path: String::new(),
        original_size,
        compressed_size: 0,
        savings_percent: 0.0,
        error: Some(msg),
        error_code: Some(code),
    }
}

/// Map a std::io::Error to the most specific ErrorCode.
fn io_error_code(err: &std::io::Error) -> ErrorCode {
    match err.kind() {
        std::io::ErrorKind::NotFound => ErrorCode::FileNotFound,
        std::io::ErrorKind::PermissionDenied => ErrorCode::PermissionDenied,
        _ => ErrorCode::Unknown,
    }
}

/// Compress one image via `vips copy`. Never panics — all errors are
/// captured in `CompressResult.error` so callers never see an `Err`.
///
/// ## vips commands used
///
/// The strategy is `vips copy <input> <output>[opts]`. vips infers the
/// encoder from the output extension and applies the bracket-suffix
/// options:
///
/// | Format | Lossy suffix              | Lossless suffix   |
/// |--------|---------------------------|-------------------|
/// | JPEG   | `[Q=<1-100>,strip]`       | `[Q=100,strip]`   |
/// | WebP   | `[Q=<1-100>,strip]`       | `[lossless,strip]` |
/// | PNG    | `[compression=<0-9>,strip]` | `[strip]`         |
///
/// - `Q` — quality factor (JPEG/WebP).
/// - `lossless` — WebP lossless flag.
/// - `compression` — zlib level 0-9 (mapped from quality: high quality →
///   low compression). Omitted when lossless so vips uses its default.
/// - `strip` — remove all metadata (EXIF, ICC, XMP).
fn execute_compress(req: &CompressRequest, vips_binary: &str) -> CompressResult {
    let input = Path::new(&req.input_path);

    eprintln!("[compress] START {}", req.input_path);

    // 1. Validate the source file exists
    if !input.exists() {
        return fail(&req.input_path, 0, ErrorCode::FileNotFound,
            format!("File not found: {}", req.input_path));
    }

    // 2. Read original size
    let original_size = match std::fs::metadata(input) {
        Ok(m) => m.len(),
        Err(e) => return fail(&req.input_path, 0, io_error_code(&e),
            format!("Cannot read file: {}", friendly_io_msg(&e))),
    };

    // 3. Detect the source format from the file extension
    let input_format = match detect_format(input) {
        Some(f) => f,
        None => return fail(
            &req.input_path,
            original_size,
            ErrorCode::UnsupportedFormat,
            format!(
                "Unsupported format (.{ext}). Only JPEG, PNG, and WebP are supported.",
                ext = input.extension().and_then(|e| e.to_str()).unwrap_or("none")
            ),
        ),
    };

    // 4. Resolve target format — `None` means keep original
    let target_format = req.output_format.as_deref().unwrap_or(input_format);
    let ext = output_extension(target_format);

    // 5. Extract filename stem
    let stem = match input.file_stem().and_then(|s| s.to_str()) {
        Some(s) => s,
        None => return fail(&req.input_path, original_size, ErrorCode::InvalidFilename,
            "The filename contains characters that cannot be processed."),
    };

    // 6. Create the output folder if it doesn't exist
    let output_dir = Path::new(&req.output_folder);
    if !output_dir.exists() {
        if let Err(e) = std::fs::create_dir_all(output_dir) {
            return fail(
                &req.input_path,
                original_size,
                ErrorCode::OutputFolderError,
                format!("Cannot create output folder: {}", friendly_io_msg(&e)),
            );
        }
    }

    // 6b. Verify output folder is writable
    if output_dir.exists() {
        let probe = output_dir.join(".compressor_write_test");
        match std::fs::write(&probe, b"") {
            Ok(_) => { let _ = std::fs::remove_file(&probe); }
            Err(e) => return fail(
                &req.input_path,
                original_size,
                ErrorCode::PermissionDenied,
                format!("Output folder is not writable: {}", friendly_io_msg(&e)),
            ),
        }
    }

    // 7. Build the output path: <folder>/<stem>-compressed.<ext>
    let output_path = output_dir.join(format!("{}-compressed.{}", stem, ext));

    // 8. Build vips suffix options and assemble the CLI argument
    let quality = req.quality.clamp(1, 100);
    let suffix = build_vips_suffix(target_format, quality, req.lossless, req.strip_metadata);
    let output_arg = format!("{}{}", output_path.display(), suffix);

    // 9. Execute vips — use `thumbnail` when resizing, `copy` otherwise
    let resize = req.max_dimension > 0;
    let (vips_cmd, vips_args): (&str, Vec<String>) = if resize {
        // vips thumbnail <input> <output>[opts] <size> --size down
        // --size down ensures images smaller than max_dimension are NOT upscaled.
        ("thumbnail", vec![
            req.input_path.clone(),
            output_arg.clone(),
            req.max_dimension.to_string(),
            "--size".to_string(),
            "down".to_string(),
        ])
    } else {
        ("copy", vec![
            req.input_path.clone(),
            output_arg.clone(),
        ])
    };

    eprintln!("[compress] RUN {} {} {}", vips_binary, vips_cmd, vips_args.join(" "));
    let result = match Command::new(vips_binary)
        .arg(vips_cmd)
        .args(&vips_args)
        .output()
    {
        Ok(r) => r,
        Err(e) => {
            let code = if e.kind() == std::io::ErrorKind::NotFound {
                ErrorCode::VipsNotInstalled
            } else {
                ErrorCode::VipsExecFailed
            };
            return fail(
                &req.input_path,
                original_size,
                code,
                format!("Failed to run vips: {}. Install it with: brew install vips", friendly_io_msg(&e)),
            );
        }
    };

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        eprintln!("[compress] VIPS STDERR: {}", stderr.trim());
        return fail(
            &req.input_path,
            original_size,
            ErrorCode::VipsExecFailed,
            format!("vips failed: {}", stderr.trim()),
        );
    }

    // 10. Read compressed size and compute savings
    let compressed_size = match std::fs::metadata(&output_path) {
        Ok(m) => m.len(),
        Err(e) => {
            return fail(
                &req.input_path,
                original_size,
                io_error_code(&e),
                format!("Cannot read compressed file: {}", friendly_io_msg(&e)),
            );
        }
    };

    let savings_percent = if original_size > 0 {
        (1.0 - (compressed_size as f64 / original_size as f64)) * 100.0
    } else {
        0.0
    };

    eprintln!("[compress] OK {} — {} → {} ({:.1}%)", req.input_path, original_size, compressed_size, savings_percent);

    CompressResult {
        success: true,
        input_path: req.input_path.clone(),
        output_path: output_path.to_string_lossy().to_string(),
        original_size,
        compressed_size,
        savings_percent,
        error: None,
        error_code: None,
    }
}

/* ------------------------------------------------------------------ */
/*  Tauri commands                                                     */
/* ------------------------------------------------------------------ */

/// Compress a single image.
#[tauri::command]
pub async fn compress_image(request: CompressRequest) -> Result<CompressResult, String> {
    let vips = find_vips_binary()?;
    Ok(execute_compress(&request, &vips))
}

/// Compress a batch of images. Per-file errors are captured in each
/// `CompressResult`; the command only returns `Err` if the vips binary
/// itself cannot be located.
#[tauri::command]
pub async fn compress_batch(requests: Vec<CompressRequest>) -> Result<BatchCompressResult, String> {
    let vips = find_vips_binary()?;
    let total = requests.len();

    let results: Vec<CompressResult> = requests
        .iter()
        .map(|req| execute_compress(req, &vips))
        .collect();

    let succeeded = results.iter().filter(|r| r.success).count();

    Ok(BatchCompressResult {
        results,
        total,
        succeeded,
        failed: total - succeeded,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VipsStatus {
    pub success: bool,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn check_vips_installed() -> Result<VipsStatus, String> {
    let vips = match find_vips_binary() {
        Ok(path) => path,
        Err(e) => {
            return Ok(VipsStatus {
                success: false,
                version: None,
                error: Some(e),
            });
        }
    };

    let output = match Command::new(&vips).arg("--version").output() {
        Ok(o) => o,
        Err(e) => {
            return Ok(VipsStatus {
                success: false,
                version: None,
                error: Some(format!(
                    "Failed to execute vips: {}. Install it with: brew install vips",
                    e
                )),
            });
        }
    };

    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(VipsStatus {
            success: true,
            version: Some(version),
            error: None,
        })
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Ok(VipsStatus {
            success: false,
            version: None,
            error: Some(if stderr.is_empty() {
                "vips exited with a non-zero status".to_string()
            } else {
                stderr
            }),
        })
    }
}

#[tauri::command]
pub async fn get_file_info(path: String) -> Result<FileInfo, String> {
    let p = Path::new(&path);

    if !p.exists() {
        eprintln!("[file_info] NOT FOUND {}", path);
        return Err(format!("FILE_NOT_FOUND: {}", path));
    }

    let metadata = std::fs::metadata(p).map_err(|e| {
        eprintln!("[file_info] METADATA ERROR {} — {}", path, e);
        match e.kind() {
            std::io::ErrorKind::PermissionDenied =>
                format!("PERMISSION_DENIED: Cannot read \"{}\" — check file permissions.", p.file_name().and_then(|n| n.to_str()).unwrap_or(&path)),
            _ => format!("METADATA_ERROR: {}", friendly_io_msg(&e)),
        }
    })?;

    let name = p
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let format = detect_format(p).unwrap_or("unknown").to_string();

    Ok(FileInfo {
        path,
        name,
        size: metadata.len(),
        format,
    })
}
