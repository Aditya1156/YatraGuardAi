'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ImageUp, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Photo capture for the OCR modules (8.1 and 8.4).
 *
 * Uses `<input capture="environment">` rather than getUserMedia: it opens the
 * phone's own camera app, which focuses and exposes far better than anything we
 * would build, works in an installed PWA on both platforms, and needs no
 * permission prompt of its own.
 */

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

/**
 * Downscales before upload. A modern phone photo is 4–8 MB, which is slow on
 * hotel wifi and well past what the OCR model needs to read a bill.
 */
async function compress(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    if (!blob) return file;

    return new File([blob], 'capture.jpg', { type: 'image/jpeg' });
  } catch {
    // A HEIC the browser cannot decode still uploads fine — let the server try.
    return file;
  }
}

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClear: () => void;
  /** What the user is being asked to photograph, e.g. "the bill". */
  subject: string;
  hint: string;
  disabled?: boolean;
}

export function CameraCapture({
  onCapture,
  onClear,
  subject,
  hint,
  disabled,
}: CameraCaptureProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Object URLs leak until revoked, and this component can cycle many times.
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const prepared = await compress(file);
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(prepared);
      });
      onCapture(prepared);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    if (cameraRef.current) cameraRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
    onClear();
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      {preview ? (
        <div className="overflow-hidden rounded-card bg-surface shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={`Photo of ${subject}`} className="max-h-72 w-full object-contain" />
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-xs text-muted-foreground">Ready to check</span>
            <Button variant="ghost" size="sm" onClick={reset} disabled={disabled}>
              <RotateCcw aria-hidden />
              Retake
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            'flex flex-col items-center rounded-card border border-dashed border-border bg-surface px-6 py-9 text-center',
            busy && 'opacity-60',
          )}
        >
          <Camera className="size-6 text-trust-indigo" aria-hidden />
          <p className="mt-3 text-sm font-medium">Photograph {subject}</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">{hint}</p>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={() => cameraRef.current?.click()} disabled={disabled || busy}>
              <Camera aria-hidden />
              Open camera
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => galleryRef.current?.click()}
              disabled={disabled || busy}
            >
              <ImageUp aria-hidden />
              Choose a photo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
