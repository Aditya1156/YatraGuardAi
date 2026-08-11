import { AppError } from './respond';
import type { ImagePart } from '@/lib/ai/gemini';

/**
 * Reads a photo out of a multipart request for the OCR pipelines (8.1, 8.4).
 * Phone cameras produce large files, so the cap is enforced before the bytes
 * are ever buffered into a base64 string.
 */

const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export async function readImageFromRequest(
  request: Request,
  field = 'image',
): Promise<ImagePart> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new AppError('Send the photo as multipart/form-data.', 400, 'BAD_UPLOAD');
  }

  const file = form.get(field);
  if (!(file instanceof File)) {
    throw new AppError('No photo was attached.', 400, 'NO_IMAGE');
  }
  if (file.size === 0) {
    throw new AppError('That photo came through empty. Try again.', 400, 'EMPTY_IMAGE');
  }
  if (file.size > MAX_BYTES) {
    throw new AppError('That photo is over 6 MB. Retake it at a lower resolution.', 413, 'IMAGE_TOO_LARGE');
  }

  const mimeType = file.type || 'image/jpeg';
  if (!ALLOWED.has(mimeType)) {
    throw new AppError('Use a JPEG, PNG or WebP photo.', 415, 'UNSUPPORTED_IMAGE');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return { mimeType, data: buffer.toString('base64') };
}

/** Reads an optional non-file field from the same form. */
export function readTextField(form: FormData, field: string): string | null {
  const value = form.get(field);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
