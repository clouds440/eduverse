'use client';

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { X, Check, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface ImageCropperModalProps {
  /** The raw data-url of the image to crop */
  imageSrc: string;
  /** Called with the final cropped File blob when user confirms */
  onConfirm: (croppedFile: File) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Original filename — used to name the output file */
  filename: string;
}

/**
 * Turns an image element + crop rect into a Blob via an off-screen <canvas>.
 */
async function getCroppedBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height,
      );

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      }, 'image/jpeg', 0.92);
    };
    image.onerror = () => reject(new Error('Failed to load image'));
  });
}

import { ModalOverlay } from './Modal';
import { Button } from './Button';

export function ImageCropperModal({
  imageSrc,
  onConfirm,
  onCancel,
  filename,
}: ImageCropperModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [confirming, setConfirming] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setConfirming(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      const ext = filename.split('.').pop() ?? 'jpg';
      const outputName = filename.replace(/\.[^.]+$/, `-cropped.${ext}`);
      const file = new File([blob], outputName, { type: 'image/jpeg' });
      onConfirm(file);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <ModalOverlay isOpen={true} maxWidth="max-w-4xl" className="bg-card rounded-lg flex flex-col p-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <h3 className="text-base font-bold text-foreground tracking-tight leading-none">Crop Logo Image</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Cropper */}
      <div className="relative bg-card" style={{ height: 580 }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={1}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          cropShape="rect"
          showGrid={true}
        />
      </div>

      {/* Controls */}
      <div className="px-5 py-4 space-y-4 border-t border-border bg-muted/50 shrink-0">
        {/* Zoom */}
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-black tracking-widest text-muted-foreground w-12">Zoom</span>
          <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 h-1.5 appearance-none rounded-full bg-border accent-primary cursor-pointer"
          />
          <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
        </div>

        {/* Rotation */}
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-black tracking-widest text-muted-foreground w-12">Rotate</span>
          <RotateCw className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
            className="flex-1 h-1.5 appearance-none rounded-full bg-border accent-primary cursor-pointer"
          />
          <span className="text-xs font-bold text-muted-foreground w-10 text-right">{rotation}°</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 px-5 py-5 bg-muted/30 border-t border-border shrink-0">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          className="flex-1 tracking-widest"
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant='primary'
          onClick={handleConfirm}
          disabled={confirming}
          icon={Check}
          className="flex-1 tracking-widest btn-haptic"
        >
          {confirming ? "Processing..." : "Crop"}
        </Button>
      </div>
    </ModalOverlay>
  );
}
