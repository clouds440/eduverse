'use client';

import Image from 'next/image';
import { X } from 'lucide-react';

interface ImagePreviewModalProps {
    imageUrl: string;
    onClose: () => void;
}

export function ImagePreviewModal({ imageUrl, onClose }: ImagePreviewModalProps) {
    return (
        <div
            className="absolute w-full h-full z-50 flex items-center justify-center bg-accent/90 backdrop-blur-sm"
            onClick={onClose}
        >
            <div className="relative max-w-4xl max-h-screen p-3 sm:p-4 w-full h-full flex items-center justify-center">
                <div className="relative w-full h-full max-h-[85vh] flex items-center justify-center">
                    <Image
                        src={imageUrl}
                        alt="Preview"
                        fill
                        className="object-contain rounded-lg shadow-2xl"
                        unoptimized
                    />
                </div>
                <button
                    title='Close'
                    type='button'
                    onClick={onClose}
                    className="absolute top-3 sm:top-4 right-3 sm:right-4 p-2 bg-accent/80 hover:bg-accent/70 rounded-full transition-colors shadow-lg"
                >
                    <X size={24} className="text-primary/80 hover:text-primary" />
                </button>
            </div>
        </div>
    );
}
