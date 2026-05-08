'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Toggle } from '@/components/ui/Toggle';
import { PlayCircle, X, Youtube, Globe } from 'lucide-react';

interface ExternalLinkInputProps {
    value: string;
    onChange: (value: string) => void;
    isVideo: boolean;
    onIsVideoChange: (isVideo: boolean) => void;
    disabled?: boolean;
    error?: string;
}

export function ExternalLinkInput({
    value,
    onChange,
    isVideo,
    onIsVideoChange,
    disabled = false,
    error
}: ExternalLinkInputProps) {
    const [thumbnail, setThumbnail] = useState<string | null>(null);

    useEffect(() => {
        if (isVideo && value) {
            const thumb = extractThumbnail(value);
            setThumbnail(thumb);
        } else {
            setThumbnail(null);
        }
    }, [value, isVideo]);

    const extractThumbnail = (url: string): string | null => {
        if (!url) return null;

        // YouTube
        if (url.includes('youtube.com/watch?v=')) {
            const videoId = url.split('v=')[1]?.split('&')[0];
            return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
        }
        if (url.includes('youtu.be/')) {
            const videoId = url.split('youtu.be/')[1]?.split('?')[0];
            return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
        }

        // Vimeo (requires API, but we can try a basic approach)
        if (url.includes('vimeo.com/')) {
            const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
            // Vimeo thumbnails require their API, so we'll return null for now
            // Could be enhanced with oEmbed API later
            return null;
        }

        return null;
    };

    const getVideoPlatform = (url: string): string => {
        if (url.includes('youtube') || url.includes('youtu.be')) return 'YouTube';
        if (url.includes('vimeo')) return 'Vimeo';
        return 'Video';
    };

    const handleClear = () => {
        onChange('');
        setThumbnail(null);
    };

    return (
        <div className="space-y-1">
            <div className="flex justify-between items-center">
                <Label htmlFor="externalLink">External Link (Optional)</Label>
                <Toggle
                    checked={isVideo}
                    onCheckedChange={onIsVideoChange}
                    disabled={disabled}
                    label="Embed as Video"
                    size="sm"
                    textColor='text-muted-foreground'
                />
            </div>

            <div className="relative">
                <Input
                    id="externalLink"
                    type="url"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    error={!!error}
                    icon={isVideo ? Youtube : Globe}
                    placeholder={isVideo ? "https://youtube.com/watch?v=..." : "https://drive.google.com/..."}
                    disabled={disabled}
                    className="font-medium pr-10"
                />
                {value && !disabled && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {error && <p className="text-xs text-dangerfont-semibold">{error}</p>}

            {/* Thumbnail Preview */}
            {isVideo && thumbnail && (
                <div className="relative group">
                    <div className="relative rounded-lg overflow-hidden border border-border shadow-sm">
                        <img
                            src={thumbnail}
                            alt="Video thumbnail"
                            className="w-full h-72 object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <PlayCircle className="w-12 h-12 text-white" />
                        </div>
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white font-semibold">
                            {getVideoPlatform(value)}
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 italic">
                        Video will be embedded from: {value}
                    </p>
                </div>
            )}

            {/* Non-video link preview */}
            {!isVideo && value && (
                <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <Globe className="w-5 h-5 text-primary" />
                    <span className="text-sm text-muted-foreground truncate flex-1">
                        {value}
                    </span>
                </div>
            )}
        </div>
    );
}
