'use client';

import React, { useMemo, useEffect, useRef } from 'react';
import { marked } from 'marked';
import { getPublicUrl } from '@/lib/utils';
import { normalizeSafeUrl } from '@/lib/safeUrl';
import Prism from 'prismjs';
import mermaid from 'mermaid';
import he from 'he';

// Import Prism components for common languages
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';

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

    // Initialize mermaid
    useEffect(() => {
        mermaid.initialize({
            startOnLoad: false,
            theme: 'dark', // Always use dark theme for diagrams
            securityLevel: 'loose',
            fontFamily: 'inherit',
            themeVariables: {
                background: '#0f172a',
                primaryColor: '#4f46e5',
                secondaryColor: '#1e293b',
                tertiaryColor: '#192231'
            }
        });
    }, []);

    const htmlContent = useMemo(() => {
        try {
            const renderer = new marked.Renderer();

            // Custom code block rendering with PrismJS and Mermaid support
            renderer.code = ({ text, lang }) => {
                // Decode entities from escapeRawHtml to get clean text for processing
                const decodedText = he.decode(text);

                if (lang === 'mermaid') {
                    return `<div class="mermaid-outer-container my-4 overflow-auto scrollbar-thin" style="width: 100%; min-width: 0;">
                                <div class="mermaid-container" style="min-width: 600px; display: flex; justify-content: center; background: #0f172a; padding: 2rem; border-radius: 1rem; border: 1px solid rgba(255,255,255,0.05);">
                                    <div class="mermaid" style="width: 100%; display: flex; justify-content: center;">${decodedText}</div>
                                </div>
                            </div>`;
                }

                const language = lang || 'text';
                const prismLanguage = Prism.languages[language] || Prism.languages.text;
                const highlighted = Prism.highlight(decodedText, prismLanguage, language);

                return `<div class="code-block-wrapper my-4 relative group max-w-full overflow-hidden flex flex-col border border-border/50 rounded-xl bg-slate-800" style="min-width: 0;">
                            <div class="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-slate-900/50">
                                <div class="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 group-hover:text-primary transition-colors">${language}</div>
                                <button class="copy-code-btn p-1.5 rounded-md bg-slate-700/30 hover:bg-slate-700/60 text-slate-400 hover:text-white transition-all flex items-center justify-center border border-white/5" data-code="${escapeHtml(decodedText)}">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="copy-icon"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="check-icon hidden text-emerald-400"><polyline points="20 6 9 17 4 12"/></svg>
                                </button>
                            </div>
                            <pre class="language-${language} p-4 text-slate-100 overflow-x-auto scrollbar-thin max-w-full"><code class="language-${language}">${highlighted}</code></pre>
                        </div>`;
            };

            // Override image rendering to use getPublicUrl and graceful fallback
            renderer.image = ({ href, title, text }) => {
                const resolved = href ? getPublicUrl(href) : '';
                const url = normalizeSafeUrl(resolved, { allowRelative: true });
                const alt = escapeHtml(text || title || 'Image');
                const titleAttr = escapeHtml(title || '');

                const placeholder = `
                    <div class="text-center relative w-32 h-32 border border-border rounded-md bg-card/40 flex flex-col items-center justify-center">
                        <div class="absolute top-1 left-1 text-[10px] text-muted-foreground max-w-full truncate px-1">${alt}</div>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image-off-icon lucide-image-off text-foreground"><line x1="2" x2="22" y1="2" y2="22"/><path d="M10.41 10.41a2 2 0 1 1-2.83-2.83"/><line x1="13.5" x2="6" y1="13.5" y2="21"/><line x1="18" x2="21" y1="12" y2="15"/><path d="M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59"/><path d="M21 15V5a2 2 0 0 0-2-2H9"/></svg>
                        <span class="italic text-[10px] text-muted-foreground mt-1">Couldn't load image</span>
                    </div>
                `;

                if (!url || failedMarkdownImageUrls.has(url)) return placeholder;

                return `
                    <img src="${escapeHtml(url)}" alt="${alt}" title="${titleAttr}" class="max-w-full h-auto rounded-lg shadow-sm my-2 border border-border markdown-image" data-failed-url="${escapeHtml(url)}" />
                `;
            };

            // Override link rendering
            renderer.link = ({ href, title, text }) => {
                if (!href) return `<a title="${escapeHtml(title || '')}">${text}</a>`;

                let url = href;
                if (href.startsWith('/uploads/') || href.startsWith('uploads/') || href.includes('/chat-files/') || href.includes('/mail-files/')) {
                    url = getPublicUrl(href);
                }

                const safeUrl = normalizeSafeUrl(url, { allowRelative: true, allowMailTo: true, allowTel: true });
                if (!safeUrl) return `<span>${text}</span>`;

                const isExternal = /^[a-z][a-z\d+.-]*:/i.test(safeUrl) || safeUrl.startsWith('www.');
                const targetAttr = isExternal ? 'target="_blank" rel="noopener noreferrer"' : '';

                // RICH DOCUMENT PREVIEW: Premium card with dedicated download button
                const docMatch = text.match(/^(📄 PDF:|📝 Doc:|📎 Attachment:)\s*(.*)/);
                if (docMatch) {
                    const type = docMatch[1];
                    const fileName = docMatch[2].trim();
                    const iconColor = type.includes('PDF') ? '#ef4444' : type.includes('Doc') ? '#3b82f6' : '#64748b';
                    const iconBg = type.includes('PDF') ? 'rgba(239, 68, 68, 0.1)' : type.includes('Doc') ? 'rgba(59, 130, 246, 0.1)' : 'rgba(100, 116, 139, 0.1)';
                    const cleanType = type.replace(/[:\s📄📝📎]/g, '').trim();

                    // SVG icon selection based on document type
                    const getIconSvg = () => {
                        if (type.includes('PDF')) {
                            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13h6"/><path d="M9 17h6"/><path d="M9 9h1"/></svg>`;
                        } else if (type.includes('Doc')) {
                            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>`;
                        } else {
                            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;
                        }
                    };

                    // Premium card layout with dedicated download button on the right
                    return `
                    <div class="doc-preview-card group my-4 no-underline">
                        <div class="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border/50 shadow-lg hover:shadow-xl hover:border-border/70 transition-all duration-300">
                            <!-- Left: Document Icon with subtle scaling -->
                            <div class="shrink-0 w-12 h-12 flex items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 shadow-sm" 
                                style="background: ${iconBg}; color: ${iconColor};">
                                ${getIconSvg()}
                            </div>
                            
                            <!-- Middle: File details area -->
                            <div class="flex-1 min-w-0 space-y-1.5">
                                <p class="text-sm font-semibold text-foreground truncate tracking-tight">
                                    ${escapeHtml(fileName)}
                                </p>
                                <div class="flex items-center flex-wrap gap-2">
                                    <span class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-white shadow-sm" 
                                        style="background: ${iconColor};">
                                        ${escapeHtml(cleanType)}
                                    </span>
                                    <span class="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
                                        Secure document
                                    </span>
                                </div>
                            </div>
                            
                            <!-- Right: Dedicated Download Button (Premium) -->
                            <a href="${escapeHtml(safeUrl)}" 
                            download 
                            ${targetAttr}
                            class="shrink-0 flex items-center gap-2 px-4! py-2.5! rounded-xl! bg-primary/5! text-primary! font-semibold text-sm border border-primary/20 hover:bg-primary/20! hover:text-primary! hover:border-primary! hover:shadow-md! transition-all duration-300 group/btn no-underline!"
                            aria-label="Download ${escapeHtml(fileName)}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="transition-transform group-hover/btn:translate-y-0.5">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="7 10 12 15 17 10"/>
                                    <line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                <span class="hidden sm:inline text-sm font-medium">Download</span>
                            </a>
                        </div>
                    </div>
                `;
                }

                return `<a href="${escapeHtml(safeUrl)}" title="${escapeHtml(title || '')}" ${targetAttr}>${text}</a>`;
            };

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
                breaks: true,
                gfm: true,
                renderer,
            }) as string;
        } catch (error) {
            console.error('Markdown parsing error:', error);
            return escapeHtml(content || '');
        }
    }, [content]);

    // Cleanup and effects for post-render processing
    useEffect(() => {
        if (!containerRef.current) return;

        const cleanups: Array<() => void> = [];

        // Handle images
        const images = containerRef.current.querySelectorAll('img.markdown-image');
        images.forEach((img) => {
            const url = img.getAttribute('data-failed-url');
            if (!url) return;

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

        // Run mermaid
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

        return () => {
            cleanups.forEach((cleanup) => cleanup());
            currentContainer?.removeEventListener('click', handleCopyClick);
        };
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

// Add global CSS for markdown content and code themes
if (typeof document !== 'undefined') {
    const styleId = 'markdown-renderer-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            .markdown-content { color: inherit; overflow-wrap: anywhere; word-break: break-word; white-space: inherit; }
            .markdown-content p { margin: 0 0 0 0; line-height: 1.6; }
            .markdown-content p:last-child { margin-bottom: 0; }
            .markdown-content strong, .markdown-content b { font-weight: 800; color: inherit; }
            .markdown-content a { color: cyan; background: rgba(50, 60, 100, 0.4); border-radius: 3px; padding: 1px 4px; text-decoration: underline; font-weight: 700; text-underline-offset: 2px; }
            .markdown-content a:hover { opacity: 0.8; }
            .markdown-content ul, .markdown-content ol { margin: 0 0 0 0; padding-left: 1rem; }
            .markdown-content li { margin: 0 0 0 0; }
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
            .markdown-content img { margin: 0; display: block; }
            
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
            }

            /* PrismJS Theme Overrides - Premium Look */
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
