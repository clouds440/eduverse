'use client';

import React, { useMemo, useEffect, useRef } from 'react';
import { marked } from 'marked';
import { getPublicUrl } from '@/lib/utils';
import { normalizeSafeUrl } from '@/lib/safeUrl';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

const failedMarkdownImageUrls = new Set<string>();

const escapeHtml = (str?: string) => {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

const escapeRawHtml = (str: string) => str.replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const MarkdownRenderer = React.memo(function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [, forceUpdate] = React.useState({});

    const htmlContent = useMemo(() => {
        try {
            const renderer = new marked.Renderer();

            // Override image rendering to use getPublicUrl and graceful fallback
            renderer.image = ({ href, title, text }) => {
                const resolved = href ? getPublicUrl(href) : '';
                const url = normalizeSafeUrl(resolved, { allowRelative: true });
                const alt = escapeHtml(text || title || 'Image');
                const titleAttr = escapeHtml(title || '');

                // Placeholder markup shown when no url or when image fails to load
                const placeholder = `
                                        <div class="text-center relative w-32 h-32 border border-border rounded-md bg-card/40 flex flex-col items-center justify-center">
                                                <div class="absolute top-1 left-1 text-[10px] text-muted-foreground max-w-full truncate px-1">${alt}</div>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image-off-icon lucide-image-off text-foreground"><line x1="2" x2="22" y1="2" y2="22"/><path d="M10.41 10.41a2 2 0 1 1-2.83-2.83"/><line x1="13.5" x2="6" y1="13.5" y2="21"/><line x1="18" x2="21" y1="12" y2="15"/><path d="M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59"/><path d="M21 15V5a2 2 0 0 0-2-2H9"/></svg>
                                                <span class="italic text-[10px] text-muted-foreground mt-1">Couldn't load image</span>
                                        </div>
                                `;

                if (!url || failedMarkdownImageUrls.has(url)) return placeholder;

                // When url exists, render the image with a simple error handler
                return `
                                    <img src="${escapeHtml(url)}" alt="${alt}" title="${titleAttr}" class="max-w-full h-auto rounded-lg shadow-sm my-2 border border-border markdown-image" data-failed-url="${escapeHtml(url)}" />
                                `;
            };

            // Override link rendering for external/internal links
            renderer.link = ({ href, title, text }) => {
                if (!href) return `<a title="${escapeHtml(title || '')}">${text}</a>`;

                let url = href;
                if (href.startsWith('/uploads/') || href.startsWith('uploads/') || href.includes('/chat-files/') || href.includes('/mail-files/')) {
                    // Only use getPublicUrl for known backend asset patterns
                    url = getPublicUrl(href);
                }

                const safeUrl = normalizeSafeUrl(url, { allowRelative: true, allowMailTo: true, allowTel: true });
                if (!safeUrl) return `<span>${text}</span>`;

                const isExternal = /^[a-z][a-z\d+.-]*:/i.test(safeUrl) || safeUrl.startsWith('www.');
                const targetAttr = isExternal ? 'target="_blank" rel="noopener noreferrer"' : '';
                return `<a href="${escapeHtml(safeUrl)}" title="${escapeHtml(title || '')}" ${targetAttr}>${text}</a>`;
            };

            // Trim trailing newlines and escape raw HTML before parsing markdown.
            const markdown = escapeRawHtml((content || '').replace(/\n+$/g, ''));
            if (typeof window !== 'undefined') {
                const failedMap = (window as Window & { __eduverseFailedMarkdownImages?: Record<string, boolean> }).__eduverseFailedMarkdownImages;
                if (failedMap) {
                    Object.keys(failedMap).forEach((url) => {
                        if (failedMap[url]) failedMarkdownImageUrls.add(url);
                    });
                }
            }
            return marked.parse(markdown, {
                breaks: true, // Support single line breaks
                gfm: true,   // GitHub Flavored Markdown
                renderer,
            }) as string;
        } catch (error) {
            console.error('Markdown parsing error:', error);
            return escapeHtml(content || '');
        }
    }, [content]);

    useEffect(() => {
        if (!containerRef.current) return;

        const cleanups: Array<() => void> = [];
        const images = containerRef.current.querySelectorAll('img.markdown-image');
        images.forEach((img) => {
            const url = img.getAttribute('data-failed-url');
            if (!url) return;

            const handleError = () => {
                failedMarkdownImageUrls.add(url);
                // Store in window for persistence across renders
                if (typeof window !== 'undefined') {
                    const failedMap = (window as Window & { __eduverseFailedMarkdownImages?: Record<string, boolean> }).__eduverseFailedMarkdownImages || {};
                    failedMap[url] = true;
                    (window as Window & { __eduverseFailedMarkdownImages?: Record<string, boolean> }).__eduverseFailedMarkdownImages = failedMap;
                }
                // Force re-render to show placeholder
                forceUpdate({});
            };

            img.addEventListener('error', handleError);
            cleanups.push(() => img.removeEventListener('error', handleError));
        });

        return () => cleanups.forEach((cleanup) => cleanup());
    }, [htmlContent]);

    return (
        <div
            ref={containerRef}
            className={`markdown-content ${className}`}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
            dir="auto"
            style={{
                lineHeight: '1.6',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere'
            }}
        />
    );
});

// Add global CSS for markdown content
if (typeof document !== 'undefined') {
    const styleId = 'markdown-renderer-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
                /* Let the surrounding container (e.g. .message-bubble) control white-space.
                    Use inherit so we avoid conflicting pre-wrap rules that cause extra blank lines. */
                .markdown-content { color: inherit; overflow-wrap: anywhere; word-break: break-word; white-space: inherit; }
            /* Remove paragraph bottom margins to avoid extra space inside message bubbles */
            .markdown-content p { margin: 0 0 0 0; line-height: 1.6; }
            .markdown-content p:last-child { margin-bottom: 0; }
            .markdown-content strong, .markdown-content b { font-weight: 800; color: inherit; }
            .markdown-content a { color: var(--primary); text-decoration: underline; font-weight: 700; text-underline-offset: 2px; }
            .markdown-content a:hover { opacity: 0.8; }
            .markdown-content ul, .markdown-content ol { margin: 0 0 0 0; padding-left: 1rem; }
            .markdown-content li { margin: 0 0 0 0; }
            .markdown-content ul { list-style-type: disc; }
            .markdown-content ol { list-style-type: decimal; }
            .markdown-content h1, .markdown-content h2, .markdown-content h3 { 
                font-weight: 900; 
                line-height: 1;
                margin-top: 0.75rem;
                margin-bottom: 0.25rem; 
                color: inherit;
                letter-spacing: -0.025em;
            }
            .markdown-content h1 { font-size: 1.5rem; }
            .markdown-content h2 { font-size: 1.25rem; }
            .markdown-content h3 { font-size: 1.125rem; }
            .markdown-content blockquote {
                border-left: 4px solid var(--border-color, #e5e7eb);
                padding-left: 1rem;
                font-style: italic;
                color: inherit;
                margin: 1rem 0;
            }
            .markdown-content code {
                background-color: var(--muted-bg, rgba(226, 232, 240, 0.5));
                padding: 0.2rem 0.4rem;
                border-radius: 0.25rem;
                font-size: 0.875rem;
                font-weight: 700;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                color: var(--primary);
            }
            .markdown-content pre { white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; margin: 0; }
            .markdown-content code { white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
            .markdown-content img { margin: 0; display: block; }
        `;
        document.head.appendChild(style);
    }
}
