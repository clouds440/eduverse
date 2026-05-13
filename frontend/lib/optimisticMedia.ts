const optimisticImageFallbacks = new Map<string, string>();
const resolvedRemoteImages = new Set<string>();

const IMAGE_MARKDOWN_RE = /!\[[^\]]*]\(([^)\s]+)\)/g;

function extractMarkdownImageUrls(content: string): string[] {
    return Array.from(content.matchAll(IMAGE_MARKDOWN_RE), match => match[1]).filter(Boolean);
}

function isBlobUrl(url: string) {
    return url.startsWith('blob:');
}

export function registerOptimisticImageFallbacks(localContent: string | undefined, remoteContent: string | undefined) {
    if (typeof window === 'undefined' || !localContent || !remoteContent) return;

    const localUrls = extractMarkdownImageUrls(localContent);
    const remoteUrls = extractMarkdownImageUrls(remoteContent);
    const pairCount = Math.min(localUrls.length, remoteUrls.length);

    for (let i = 0; i < pairCount; i++) {
        const localUrl = localUrls[i];
        const remoteUrl = remoteUrls[i];

        if (!isBlobUrl(localUrl) || isBlobUrl(remoteUrl) || resolvedRemoteImages.has(remoteUrl)) continue;
        optimisticImageFallbacks.set(remoteUrl, localUrl);
    }
}

export function getOptimisticImageFallback(remoteUrl: string): string | null {
    if (resolvedRemoteImages.has(remoteUrl)) return null;
    return optimisticImageFallbacks.get(remoteUrl) ?? null;
}

export function resolveOptimisticImageFallback(remoteUrl: string) {
    const localUrl = optimisticImageFallbacks.get(remoteUrl);
    optimisticImageFallbacks.delete(remoteUrl);
    resolvedRemoteImages.add(remoteUrl);

    if (localUrl?.startsWith('blob:') && typeof window !== 'undefined') {
        window.setTimeout(() => URL.revokeObjectURL(localUrl), 5000);
    }
}
