'use client';

import React, { useMemo, useEffect, useRef } from 'react';
import { marked } from 'marked';
import { getPublicUrl } from '@/lib/utils';
import { normalizeSafeUrl } from '@/lib/safeUrl';
import { getOptimisticImageFallback, resolveOptimisticImageFallback } from '@/lib/optimisticMedia';
import { AttachmentPreviewCard, getAttachmentPreviewKind, type AttachmentPreviewKind } from './AttachmentPreviewCard';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike'; // Must be loaded first
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-sql';
import mermaid from 'mermaid';
import he from 'he';

interface MarkdownRendererProps {
    content: string;
    className?: string;
    attachmentAlign?: 'left' | 'right';
    compactAttachments?: boolean;
    attachmentsFirst?: boolean;
}

const failedMarkdownImageUrls = new Set<string>();
let mermaidInitialized = false;

const SAFE_CODE_LANGUAGE_REGEX = /^[a-z0-9_-]+$/i;

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

const normalizeCodeLanguage = (lang?: string) => {
    const firstToken = (lang || '').trim().split(/\s+/)[0] || 'text';
    return SAFE_CODE_LANGUAGE_REGEX.test(firstToken) ? firstToken : 'text';
};

const markdownRenderer = new marked.Renderer();

// Custom code block rendering with PrismJS and Mermaid support
markdownRenderer.code = ({ text, lang }) => {
    const decodedText = he.decode(text);
    const language = normalizeCodeLanguage(lang);
    const languageLabel = escapeHtml((lang || '').trim() || 'text');

    if (language === 'mermaid') {
        return `<div class="mermaid-outer-container my-4 overflow-auto scrollbar-thin" style="width: 100%; min-width: 0;">
                    <div class="mermaid-container" style="min-width: 600px; display: flex; justify-content: center; background: #0f172a; padding: 2rem; border-radius: 1rem; border: 1px solid rgba(255,255,255,0.05);">
                        <div class="mermaid" style="width: 100%; display: flex; justify-content: center;">${escapeHtml(decodedText)}</div>
                    </div>
                </div>`;
    }

    const prismLanguage = Prism.languages[language] || Prism.languages.text;
    const highlighted = Prism.highlight(decodedText, prismLanguage, language);

    return `<div class="code-block-wrapper relative group max-w-full my-1.5 overflow-hidden flex flex-col border border-border/30 rounded-xl bg-card/90" style="min-width: 0;">
                <div class="flex items-center justify-between px-4 py-1 border-b border-border/10 bg-card/80">
                    <div class="text-sm tracking-widest text-muted-foreground group-hover:text-primary transition-colors">${languageLabel}</div>
                    <button class="copy-code-btn p-1.5 rounded-md bg-background/30 hover:bg-background/60 text-muted-foreground hover:text-foreground transition-all flex items-center justify-center border border-border" data-code="${escapeHtml(decodedText)}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="copy-icon"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="check-icon hidden text-success"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                </div>
                <pre class="language-${language} p-4 text-foreground/80 overflow-x-auto scrollbar-thin max-w-full"><code class="language-${language}">${highlighted}</code></pre>
            </div>`;
};

// Override image rendering to use getPublicUrl and graceful fallback
markdownRenderer.image = ({ href, title, text }) => {
    const resolved = href && /^(blob:|https?:)/i.test(href) ? href : href ? getPublicUrl(href) : '';
    const url = normalizeSafeUrl(resolved, { allowRelative: true });
    const alt = escapeHtml(text || title || 'Image');
    const titleAttr = escapeHtml(title || '');

    const placeholder = `
        <div class="text-center relative w-32 h-32 border border-border rounded-lg bg-card/40 flex flex-col items-center justify-center">
            <div class="absolute top-1 left-1 text-[10px] text-muted-foreground max-w-full truncate px-1">${alt}</div>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image-off-icon lucide-image-off text-foreground"><line x1="2" x2="22" y1="2" y2="22"/><path d="M10.41 10.41a2 2 0 1 1-2.83-2.83"/><line x1="13.5" x2="6" y1="13.5" y2="21"/><line x1="18" x2="21" y1="12" y2="15"/><path d="M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59"/><path d="M21 15V5a2 2 0 0 0-2-2H9"/></svg>
            <span class="italic text-[10px] text-muted-foreground mt-1">Couldn't load image</span>
        </div>
    `;

    if (!url || failedMarkdownImageUrls.has(url)) return placeholder;

    const optimisticSrc = getOptimisticImageFallback(url);
    const imageSrc = optimisticSrc || url;
    const remoteSrcAttrs = optimisticSrc ? ` data-final-src="${escapeHtml(url)}"` : '';
    const placeholderSrcAttrs = optimisticSrc ? ` data-placeholder-src="${escapeHtml(optimisticSrc)}"` : '';

    return `
        <img src="${escapeHtml(imageSrc)}" alt="${alt}" title="${titleAttr}" class="h-auto rounded-lg shadow-sm my-1 markdown-image cursor-pointer hover:opacity-90 transition-opacity" data-failed-url="${escapeHtml(imageSrc)}"${remoteSrcAttrs}${placeholderSrcAttrs} decoding="async" />
    `;
};

// Override link rendering
markdownRenderer.link = ({ href, title, text }) => {
    if (!href) return `<a title="${escapeHtml(title || '')}">${text}</a>`;

    let url = href;
    if (href.startsWith('/uploads/') || href.startsWith('uploads/') || href.includes('/chat-files/') || href.includes('/mail-files/')) {
        url = getPublicUrl(href);
    }

    const safeUrl = normalizeSafeUrl(url, { allowRelative: true, allowMailTo: true, allowTel: true });
    if (!safeUrl) return `<span>${text}</span>`;

    const isExternal = /^[a-z][a-z\d+.-]*:/i.test(safeUrl) || safeUrl.startsWith('www.');
    const targetAttr = isExternal ? 'target="_blank" rel="noopener noreferrer"' : '';

    return `<a href="${escapeHtml(safeUrl)}" title="${escapeHtml(title || '')}" ${targetAttr} data-chat-link="true" draggable="false">${text}</a>`;
};

export const MarkdownRenderer = React.memo(function MarkdownRenderer({ content, className = '', attachmentAlign = 'left', compactAttachments = false, attachmentsFirst = false }: MarkdownRendererProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [, forceUpdate] = React.useState({});
    const stopLinkGesturePropagation = (event: React.SyntheticEvent<HTMLDivElement>) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const link = target.closest('a[data-chat-link="true"]');
        if (!link) return;

        event.stopPropagation();
        if (event.type === 'contextmenu') {
            event.preventDefault();
        }
    };

    // Initialize mermaid
    useEffect(() => {
        if (!mermaidInitialized) {
            mermaid.initialize({
                startOnLoad: false,
                theme: 'dark', // Always use dark theme for diagrams
                securityLevel: 'strict',
                fontFamily: 'inherit',
                themeVariables: {
                    background: '#0f172a',
                    primaryColor: '#4f46e5',
                    secondaryColor: '#1e293b',
                    tertiaryColor: '#192231'
                }
            });
            mermaidInitialized = true;
        }
    }, []);

    // 1. Extract special document attachment links before compiling markdown.
    // This allows rendering AttachmentPreviewCard components natively inside the standard React reconciliation loop.
    const { attachments, cleanedContent } = useMemo(() => {
        const extracted: { fileName: string; href: string; kind: AttachmentPreviewKind }[] = [];
        const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let finalCleanedContent = content || '';
        let match;
        const matchesToReplace: string[] = [];

        markdownLinkRegex.lastIndex = 0;

        while ((match = markdownLinkRegex.exec(content || '')) !== null) {
            const fullLinkMarkdown = match[0];
            const text = match[1];
            const href = match[2];

            const docMatch = text.match(/^(?:📄|📝|📊|📽️|📦|📎)?\s*(PDF:|DOC:|Doc:|XLS:|PPT:|ARCHIVE:|ZIP:|Attachment:)\s*(.*)/i);
            if (docMatch) {
                const type = docMatch[1];
                const fileName = docMatch[2].trim();
                const resolved = href && /^(blob:|https?:)/i.test(href) ? href : href ? getPublicUrl(href) : '';
                const safeUrl = normalizeSafeUrl(resolved, { allowRelative: true });

                if (safeUrl) {
                    const kind = getAttachmentPreviewKind(type, fileName);
                    extracted.push({
                        fileName,
                        href: safeUrl,
                        kind
                    });
                    matchesToReplace.push(fullLinkMarkdown);
                }
            }
        }

        matchesToReplace.forEach(m => {
            finalCleanedContent = finalCleanedContent.replace(m, '');
        });

        return { attachments: extracted, cleanedContent: finalCleanedContent.trim() };
    }, [content]);

    // 2. Parse the remaining text without document attachment markup
    const htmlContent = useMemo(() => {
        if (!cleanedContent) return '';
        try {
            const markdown = escapeRawHtml(cleanedContent.replace(/\n+$/g, ''));

            if (typeof window !== 'undefined') {
                const failedMap = (window as Window & { __eduverseFailedMarkdownImages?: Record<string, boolean> }).__eduverseFailedMarkdownImages;
                if (failedMap) {
                    Object.keys(failedMap).forEach((url) => {
                        if (failedMap[url]) failedMarkdownImageUrls.add(url);
                    });
                }
            }

            return marked.parse(markdown, {
                breaks: true,
                gfm: true,
                renderer: markdownRenderer,
            }) as string;
        } catch (error) {
            console.error('Markdown parsing error:', error);
            return escapeHtml(cleanedContent);
        }
    }, [cleanedContent]);

    // Cleanup and effects for post-render processing
    useEffect(() => {
        if (!containerRef.current) return;

        const cleanups: Array<() => void> = [];

        // Handle images
        const images = containerRef.current.querySelectorAll('img.markdown-image');
        images.forEach((img) => {
            const url = img.getAttribute('data-failed-url');
            if (!url) return;
            const finalSrc = img.getAttribute('data-final-src');
            const placeholderSrc = img.getAttribute('data-placeholder-src');
            let cancelled = false;

            if (finalSrc) {
                if (placeholderSrc) {
                    (img as HTMLElement).style.backgroundImage = `url("${placeholderSrc.replace(/"/g, '\\"')}")`;
                    (img as HTMLElement).style.backgroundSize = 'contain';
                    (img as HTMLElement).style.backgroundPosition = 'center';
                    (img as HTMLElement).style.backgroundRepeat = 'no-repeat';
                }

                const preloader = new window.Image();
                preloader.decoding = 'async';
                preloader.onload = () => {
                    const swap = () => {
                        if (cancelled || !img.isConnected) return;
                        img.setAttribute('src', finalSrc);
                        img.setAttribute('data-failed-url', finalSrc);
                        img.removeAttribute('data-final-src');
                        img.removeAttribute('data-placeholder-src');
                        resolveOptimisticImageFallback(finalSrc);
                        window.setTimeout(() => {
                            if (!img.isConnected) return;
                            (img as HTMLElement).style.backgroundImage = '';
                            (img as HTMLElement).style.backgroundSize = '';
                            (img as HTMLElement).style.backgroundPosition = '';
                            (img as HTMLElement).style.backgroundRepeat = '';
                        }, 250);
                    };

                    if (typeof preloader.decode === 'function') {
                        preloader.decode().then(swap).catch(swap);
                    } else {
                        swap();
                    }
                };
                preloader.onerror = () => {
                    // Keep the local blob visible for this session if the remote image is not ready.
                };
                preloader.src = finalSrc;
                cleanups.push(() => {
                    cancelled = true;
                    preloader.onload = null;
                    preloader.onerror = null;
                });
            }

            const handleError = () => {
                failedMarkdownImageUrls.add(url);
                if (typeof window !== 'undefined') {
                    const failedMap = (window as Window & { __eduverseFailedMarkdownImages?: Record<string, boolean> }).__eduverseFailedMarkdownImages || {};
                    failedMap[url] = true;
                    (window as Window & { __eduverseFailedMarkdownImages?: Record<string, boolean> }).__eduverseFailedMarkdownImages = failedMap;
                }
                forceUpdate({});
            };

            img.addEventListener('error', handleError);
            cleanups.push(() => img.removeEventListener('error', handleError));
        });

        // Run mermaid only when this message actually contains a diagram.
        if (htmlContent.includes('class="mermaid"')) {
            const renderMermaid = async () => {
                const mermaidElements = containerRef.current?.querySelectorAll('.mermaid');
                if (mermaidElements && mermaidElements.length > 0) {
                    try {
                        await mermaid.run({
                            nodes: mermaidElements as unknown as NodeListOf<HTMLElement>
                        });
                    } catch (err) {
                        console.error('Mermaid render error:', err);
                    }
                }
            };
            renderMermaid();
        }

        // Handle copy code button clicks
        const handleCopyClick = async (e: MouseEvent) => {
            const btn = (e.target as HTMLElement).closest('.copy-code-btn') as HTMLButtonElement;
            if (!btn) return;

            const code = btn.getAttribute('data-code');
            if (!code) return;

            try {
                await navigator.clipboard.writeText(code);

                // Visual feedback
                const copyIcon = btn.querySelector('.copy-icon');
                const checkIcon = btn.querySelector('.check-icon');

                if (copyIcon && checkIcon) {
                    copyIcon.classList.add('hidden');
                    checkIcon.classList.remove('hidden');
                    btn.classList.add('bg-emerald-500/20', 'border-emerald-500/30');

                    setTimeout(() => {
                        copyIcon.classList.remove('hidden');
                        checkIcon.classList.add('hidden');
                        btn.classList.remove('bg-emerald-500/20', 'border-emerald-500/30');
                    }, 2000);
                }
            } catch (err) {
                console.error('Failed to copy code:', err);
            }
        };

        const currentContainer = containerRef.current;
        currentContainer?.addEventListener('click', handleCopyClick);

        // Drag-to-scroll for code blocks (for regular mouse users)
        const preElements = currentContainer?.querySelectorAll('.code-block-wrapper pre');
        preElements?.forEach(pre => {
            const el = pre as HTMLElement;
            let isDown = false;
            let startX = 0;
            let scrollLeftStart = 0;

            const onMouseDown = (e: MouseEvent) => {
                if (el.scrollWidth <= el.clientWidth) return;
                isDown = true;
                el.style.cursor = 'grabbing';
                el.style.userSelect = 'none';
                startX = e.pageX - el.offsetLeft;
                scrollLeftStart = el.scrollLeft;
            };
            const onMouseUp = () => {
                if (!isDown) return;
                isDown = false;
                el.style.cursor = 'grab';
                el.style.userSelect = '';
            };
            const onMouseLeave = () => {
                if (!isDown) return;
                isDown = false;
                el.style.cursor = 'grab';
                el.style.userSelect = '';
            };
            const onMouseMove = (e: MouseEvent) => {
                if (!isDown) return;
                e.preventDefault();
                const x = e.pageX - el.offsetLeft;
                const walk = (x - startX) * 1.5;
                el.scrollLeft = scrollLeftStart - walk;
            };

            if (el.scrollWidth > el.clientWidth) {
                el.style.cursor = 'grab';
            }

            el.addEventListener('mousedown', onMouseDown);
            el.addEventListener('mouseup', onMouseUp);
            el.addEventListener('mouseleave', onMouseLeave);
            el.addEventListener('mousemove', onMouseMove);

            cleanups.push(() => {
                el.removeEventListener('mousedown', onMouseDown);
                el.removeEventListener('mouseup', onMouseUp);
                el.removeEventListener('mouseleave', onMouseLeave);
                el.removeEventListener('mousemove', onMouseMove);
            });
        });

        return () => {
            cleanups.forEach((cleanup) => cleanup());
            currentContainer?.removeEventListener('click', handleCopyClick);
        };
    }, [htmlContent]);

    const renderedAttachmentCards = attachments.length > 0 ? (
        <div
            className={`markdown-attachments flex flex-col gap-1 ${attachmentAlign === 'right' ? 'items-end' : 'items-start'} w-full ${attachmentsFirst ? 'mt-0.5 mb-0' : 'mt-1'}`}
            style={{ ['--markdown-edge-offset' as string]: '0.5rem' }}
        >
            {attachments.map((att, idx) => (
                <AttachmentPreviewCard
                    key={idx}
                    fileName={att.fileName}
                    href={att.href}
                    kind={att.kind}
                    align={attachmentAlign}
                    compact={compactAttachments}
                />
            ))}
        </div>
    ) : null;

    return (
        <div className={`markdown-renderer flex flex-col w-full ${attachmentsFirst ? 'markdown-renderer-attachments-first' : ''}`}>
            {attachmentsFirst && renderedAttachmentCards}
            {htmlContent && (
                <div
                    ref={containerRef}
                    className={`markdown-content ${className}`}
                    onClickCapture={stopLinkGesturePropagation}
                    onContextMenuCapture={stopLinkGesturePropagation}
                    onMouseDownCapture={stopLinkGesturePropagation}
                    onMouseUpCapture={stopLinkGesturePropagation}
                    onPointerDownCapture={stopLinkGesturePropagation}
                    onPointerUpCapture={stopLinkGesturePropagation}
                    onTouchStartCapture={stopLinkGesturePropagation}
                    onTouchEndCapture={stopLinkGesturePropagation}
                    dangerouslySetInnerHTML={{ __html: htmlContent }}
                    dir="auto"
                    style={{
                        lineHeight: '1.6',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere'
                    }}
                />
            )}
            {!attachmentsFirst && renderedAttachmentCards}
        </div>
    );
});

// Add global CSS for markdown content and code themes
if (typeof document !== 'undefined') {
    const styleId = 'markdown-renderer-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            .markdown-content { --markdown-edge-offset: 0.5rem; color: inherit; overflow-wrap: anywhere; word-break: break-word; white-space: inherit; }
            .markdown-content p { margin: 4px; line-height: 1.6; }
            .markdown-content p:last-child { margin-bottom: 1; }
            .markdown-renderer-attachments-first > .markdown-content:first-child p:first-child,
            .markdown-renderer-attachments-first > .markdown-attachments + .markdown-content p:first-child {
                margin-top: 1px;
            }
            .markdown-renderer-attachments-first > .markdown-attachments + .markdown-content p:first-child {
                margin-bottom: 1px;
                line-height: 1.35;
            }
            .markdown-content strong, .markdown-content b { font-weight: 800; color: inherit; }
            .markdown-content a {
                color: #fff !important;
                background: rgba(15, 23, 42, 0.32);
                border-radius: 5px;
                padding: 1px 4px;
                text-decoration: underline !important;
                font-weight: 800;
                text-underline-offset: 2px;
                overflow-wrap: anywhere;
                word-break: break-word;
                touch-action: manipulation;
                -webkit-touch-callout: none;
            }
            .markdown-content a:hover { opacity: 0.8; }
            .markdown-content ul, .markdown-content ol { margin: 2px; padding-left: 1rem; }
            .markdown-content li { margin: 4px; }
            .markdown-content ul { list-style-type: disc; }
            .markdown-content ol { list-style-type: decimal; }
            .markdown-content h1, .markdown-content h2, .markdown-content h3 { 
                font-weight: 900; 
                line-height: 1.2;
               
                margin-top: 1.25rem;
                margin-bottom: 0.5rem; 
                color: inherit;
                letter-spacing: -0.025em;
            }
            .markdown-content h1 { font-size: 1.5rem; }
            .markdown-content h2 { font-size: 1.25rem; }
            .markdown-content h3 { font-size: 1.125rem; }
            .markdown-content blockquote {
                border-left: 4px solid var(--primary);
                padding: 0.5rem 1rem;
                font-style: italic;
                color: var(--card-text);
                background: var(--muted-bg, rgba(0,0,0,0.05));
                border-radius: 0 0.5rem 0.5rem 0;
                margin: 1rem 0;
            }
            .markdown-content code {
                background-color: #1e293b; /* slate-800 */
                padding: 0.15rem 0.3rem;
                border-radius: 0.25rem;
                font-size: 0.9em;
                font-weight: 600;
                font-family: var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                color: #818cf8; /* indigo-400 for contrast on dark */
            }
            .markdown-content pre code {
                background-color: transparent !important;
                padding: 0;
                border-radius: 0;
                font-size: 0.85rem;
                font-weight: 400;
                color: inherit;
                display: block;
            }
            .markdown-content pre { 
                margin: 0;
                font-family: var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                max-width: 100%;
                overflow-x: auto;
            }
            .markdown-content img { margin: 2px 0 0 0; display: block; }
            .markdown-content img.markdown-image {
                width: calc(100% + (var(--markdown-edge-offset) * 2));
                max-width: calc(100% + (var(--markdown-edge-offset) * 2));
                max-height: min(25rem, 55vh);
                height: auto;
                border-radius: 0.75rem;
                margin-inline: calc(var(--markdown-edge-offset) * -1);
                object-fit: contain;
            }
            .markdown-renderer-attachments-first .markdown-content p:has(img.markdown-image) {
                margin-bottom: 1px;
                line-height: 1.35;
            }
            .markdown-renderer-attachments-first .markdown-content img.markdown-image + br {
                display: none;
            }
            .markdown-renderer-attachments-first .markdown-content p:has(img.markdown-image) + p {
                margin-top: 1px;
            }
            .markdown-content .mermaid-outer-container,
            .markdown-content blockquote,
            .markdown-content ul,
            .markdown-content ol {
                width: calc(100% + (var(--markdown-edge-offset) * 2));
                max-width: calc(100% + (var(--markdown-edge-offset) * 2));
                margin-inline: calc(var(--markdown-edge-offset) * -1);
            }
            .markdown-content .code-block-wrapper {
                width: calc(99.25% + (var(--markdown-edge-offset) * 2) - 0.75rem);
                max-width: calc(100% + (var(--markdown-edge-offset) * 2) - 0.75rem);
                margin-inline: auto;
            }
            .markdown-content ul,
            .markdown-content ol {
                padding-left: calc(1rem + var(--markdown-edge-offset));
                padding-right: var(--markdown-edge-offset);
            }
            
            /* Mermaid Specifics */
            .mermaid-container {
                width: 100%;
                display: flex;
                justify-content: center;
                background: #0f172a; /* Always dark bg */
                padding: 2rem;
                border-radius: 1rem;
                border: 1px solid rgba(255,255,255,0.05);
                margin: 1.5rem 0;
            }
            .mermaid {
                width: 100%;
                display: flex;
                justify-content: center;
            }
            .mermaid svg {
                max-width: 100% !important;
                width: 100% !important;
                height: auto !important;
                color: inherit !important;
            }

            /* PrismJS Theme Overrides - Original Premium Look */
            .token.comment, .token.prolog, .token.doctype, .token.cdata { color: #94a3b8; font-style: italic; }
            .token.punctuation { color: #94a3b8; }
            .token.namespace { opacity: .7; }
            .token.property, .token.tag, .token.boolean, .token.number, .token.constant, .token.symbol, .token.deleted { color: #f43f5e; }
            .token.selector, .token.attr-name, .token.string, .token.char, .token.builtin, .token.inserted { color: #10b981; }
            .token.operator, .token.entity, .token.url, .language-css .token.string, .style .token.string { color: #3b82f6; }
            .token.atrule, .token.attr-value, .token.keyword { color: #8b5cf6; }
            .token.function, .token.class-name { color: #f59e0b; }
            .token.regex, .token.important, .token.variable { color: #ec4899; }
            
            .dark .token.property, .dark .token.tag, .dark .token.boolean, .dark .token.number, .dark .token.constant, .dark .token.symbol, .dark .token.deleted { color: #fb7185; }
            .dark .token.selector, .dark .token.attr-name, .dark .token.string, .dark .dark .token.char, .dark .token.builtin, .dark .token.inserted { color: #34d399; }
            .dark .token.operator, .dark .token.entity, .dark .token.url { color: #60a5fa; }
            .dark .token.atrule, .dark .token.attr-value, .dark .token.keyword { color: #a78bfa; }
            .dark .token.function, .dark .token.class-name { color: #fbbf24; }

            /* Document Preview Cards */
            .doc-preview-card {
                display: block;
                max-width: 380px;
                text-decoration: none !important;
            }
            .markdown-attachments {
                width: calc(100% + (var(--markdown-edge-offset) * 2));
                max-width: calc(100% + (var(--markdown-edge-offset) * 2));
                margin-inline: calc(var(--markdown-edge-offset) * -1);
                padding: 0 1px;
            }
            .doc-preview-card p {
                margin: 0 !important;
                line-height: 1.4 !important;
            }
            .doc-preview-card .shadow-inner {
                box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06);
            }
        `;
        document.head.appendChild(style);
    }
}
