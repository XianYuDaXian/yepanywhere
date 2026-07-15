/**
 * 前端发图前压缩（对齐 Grok CLI 风格）。
 * - 只缩不放大
 * - 长边优先压到 1024，短边等比
 * - JPEG 编码；若仍过大则降质量并再缩边（边长不低于 256）
 * - 目标体积 < 400KB
 */

export const IMAGE_LONG_EDGE = 1024;
export const IMAGE_MIN_EDGE = 256;
/** 最终目标体积 */
export const IMAGE_TARGET_MAX_BYTES = 400 * 1024;
/** 超过该体积时进入更激进的降质/缩边循环 */
export const IMAGE_HARD_MAX_BYTES = Math.round(1.5 * 1024 * 1024);

const DEFAULT_QUALITY = 0.82;
const MIN_QUALITY = 0.45;
const QUALITY_STEP = 0.08;
const SHRINK_RATIO = 0.85;

const SKIP_MIME = new Set([
  "image/gif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

export interface ScaledSize {
  width: number;
  height: number;
}

/**
 * 按长边上限等比缩小；不放大。
 */
export function computeScaledSize(
  width: number,
  height: number,
  longEdge: number = IMAGE_LONG_EDGE,
): ScaledSize {
  if (width <= 0 || height <= 0) {
    return { width: Math.max(1, width), height: Math.max(1, height) };
  }
  const longSide = Math.max(width, height);
  if (longSide <= longEdge) {
    return { width, height };
  }
  const scale = longEdge / longSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * 体积仍过大时继续缩边；任一边不低于 minEdge。
 */
export function shrinkSizeForBytes(
  width: number,
  height: number,
  ratio: number = SHRINK_RATIO,
  minEdge: number = IMAGE_MIN_EDGE,
): ScaledSize {
  if (width <= 0 || height <= 0) {
    return { width: Math.max(1, width), height: Math.max(1, height) };
  }
  // 已经触底则不再缩小
  if (width <= minEdge && height <= minEdge) {
    return { width, height };
  }
  let nextW = Math.max(1, Math.round(width * ratio));
  let nextH = Math.max(1, Math.round(height * ratio));

  // 保证短边不低于 minEdge；若等比后仍过小则按短边回推
  const short = Math.min(nextW, nextH);
  if (short < minEdge) {
    const boost = minEdge / short;
    nextW = Math.max(1, Math.round(nextW * boost));
    nextH = Math.max(1, Math.round(nextH * boost));
  }

  // 若结果反而更大（极端小图），保持原尺寸
  if (nextW >= width && nextH >= height) {
    return { width, height };
  }
  return { width: nextW, height: nextH };
}

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  // 部分环境粘贴图 type 为空，靠扩展名兜底
  return /\.(png|jpe?g|webp|bmp|heic|heif|avif)$/i.test(file.name);
}

function shouldSkipCompression(file: File): boolean {
  if (!isImageFile(file)) return true;
  if (SKIP_MIME.has(file.type)) return true;
  if (/\.gif$/i.test(file.name) || /\.svg$/i.test(file.name)) return true;
  return false;
}

function replaceExtension(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base || "image"}.${ext}`;
}

type DrawableImage = ImageBitmap | HTMLImageElement;

async function loadDrawableImage(file: File): Promise<DrawableImage> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  // 旧环境回退到 HTMLImageElement
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to load image"));
      el.src = url;
    });
    return img;
  } finally {
    // 解码完成后再释放；多数浏览器会保留像素缓冲
    URL.revokeObjectURL(url);
  }
}

function getImageSize(source: DrawableImage): ScaledSize {
  if ("naturalWidth" in source) {
    return {
      width: source.naturalWidth || source.width,
      height: source.naturalHeight || source.height,
    };
  }
  return { width: source.width, height: source.height };
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), type, quality);
  });
  if (!blob) {
    throw new Error("Image encode failed");
  }
  return blob;
}

function drawToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D unavailable");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

/**
 * 压缩单张图片。
 * 非图片或无需处理时返回原文件。
 */
export async function compressImageForUpload(file: File): Promise<File> {
  if (shouldSkipCompression(file)) {
    return file;
  }

  // 小图且体积已达标：不压
  // 尺寸未知时仍尝试读取；读取失败则回退原文件
  let source: DrawableImage;
  try {
    source = await loadDrawableImage(file);
  } catch {
    return file;
  }

  try {
    const { width: sourceW, height: sourceH } = getImageSize(source);
    let size = computeScaledSize(sourceW, sourceH, IMAGE_LONG_EDGE);

    // 原图已小于长边上限，且体积 <= 400KB：直接返回
    if (
      size.width === sourceW &&
      size.height === sourceH &&
      file.size <= IMAGE_TARGET_MAX_BYTES
    ) {
      return file;
    }

    let quality = DEFAULT_QUALITY;
    let bestBlob: Blob | null = null;

    // 先按目标边长 JPEG；若仍超 1.5MB 或 400KB，循环降质/缩边
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const canvas = drawToCanvas(source, size.width, size.height);
      const blob = await canvasToBlob(canvas, "image/jpeg", quality);

      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
      }

      if (blob.size <= IMAGE_TARGET_MAX_BYTES) {
        bestBlob = blob;
        break;
      }

      // 体积规则：仍过大时优先降质量，再缩边
      if (quality - QUALITY_STEP >= MIN_QUALITY) {
        quality = Math.round((quality - QUALITY_STEP) * 100) / 100;
        continue;
      }

      // 质量已到底：缩边（不低于 256）
      const next = shrinkSizeForBytes(
        size.width,
        size.height,
        SHRINK_RATIO,
        IMAGE_MIN_EDGE,
      );
      if (next.width === size.width && next.height === size.height) {
        // 无法再缩
        break;
      }
      size = next;
      quality = DEFAULT_QUALITY;
    }

    if (!bestBlob) {
      return file;
    }

    // 压缩后反而更大：保留原文件（例如已是高压缩 JPEG）
    if (bestBlob.size >= file.size && file.type === "image/jpeg") {
      return file;
    }

    const nextName = replaceExtension(file.name, "jpg");
    return new File([bestBlob], nextName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    if ("close" in source && typeof source.close === "function") {
      source.close();
    }
  }
}

/**
 * 批量准备上传文件：图片压缩，其他原样。
 */
export async function prepareFilesForUpload(files: File[]): Promise<File[]> {
  const result: File[] = [];
  for (const file of files) {
    try {
      result.push(await compressImageForUpload(file));
    } catch {
      result.push(file);
    }
  }
  return result;
}
