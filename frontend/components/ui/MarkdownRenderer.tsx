'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import he from 'he';
import { getPublicUrl } from '@/lib/utils';
import { normalizeSafeUrl } from '@/lib/safeUrl';
import { getOptimisticImageFallback, resolveOptimisticImageFallback } from '@/lib/optimisticMedia';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

type PrismNamespace = typeof import('prismjs');

const failedMarkdownImageUrls = new Set<string>();
const SAFE_CODE_LANGUAGE_REGEX = /^[a-z0-9_-]+$/i;

let prismPromise: Promise<PrismNamespace> | null = null;
let mermaidPromise: Promise<typeof import('mermaid')['default']> | null = null;
let mermaidInitialized = false;

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

async function loadPrismLanguage(language: string) {
    const Prism = await (prismPromise ??= import('prismjs').then(module => module.default ?? module));

    if (language === 'text') return Prism;

    await import('prismjs/components/prism-clike');

    switch (language) {
        case 'c':
            await import('prismjs/components/prism-c');
            break;
        case 'javascript':
        case 'js':
            await import('prismjs/components/prism-javascript');
            break;
        case 'typescript':
        case 'ts':
            await import('prismjs/components/prism-javascript');
            await import('prismjs/components/prism-typescript');
            break;
        case 'jsx':
            await import('prismjs/components/prism-javascript');
            await import('prismjs/components/prism-jsx');
            break;
        case 'tsx':
            await import('prismjs/components/prism-javascript');
            await import('prismjs/components/prism-jsx');
            await import('prismjs/components/prism-typescript');
            await import('prismjs/components/prism-tsx');
            break;
        case 'bash':
        case 'sh':
        case 'shell':
            await import('prismjs/components/prism-bash');
            break;
        case 'json':
            await import('prismjs/components/prism-json');
            break;
        case 'css':
            await import('prismjs/components/prism-css');
            break;
        case 'markdown':
        case 'md':
            await import('prismjs/components/prism-markdown');
            break;
        case 'python':
        case 'py':
            await import('prismjs/components/prism-python');
            break;
        case 'rust':
        case 'rs':
            await import('prismjs/components/prism-rust');
            break;
        case 'cpp':
        case 'c++':
            await import('prismjs/components/prism-cpp');
            break;
        case 'java':
            await import('prismjs/components/prism-java');
            break;
        case 'go':
            await import('prismjs/components/prism-go');
            break;
        case 'yaml':
        case 'yml':
            await import('prismjs/components/prism-yaml');
            break;
        case 'sql':
            await import('prismjs/components/prism-sql');
            break;
    }

    return Prism;
}

async function getMermaid() {
    const mermaid = await (mermaidPromise ??= import('mermaid').then(module => module.default));
    if (!mermaidInitialized) {
        mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
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
    return mermaid;
}

const markdownRenderer = new marked.Renderer();

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

    return `<div class="code-block-wrapper relative group max-w-full my-1.5 overflow-hidden flex flex-col border border-border/30 rounded-xl bg-card/90" style="min-width: 0;" data-code-language="${escapeHtml(language)}">
                <div class="flex items-center justify-between px-4 py-1 border-b border-border/10 bg-card/80">
                    <div class="text-sm tracking-widest text-muted-foreground group-hover:text-primary transition-colors">${languageLabel}</div>
                    <button class="copy-code-btn p-1.5 rounded-md bg-background/30 hover:bg-background/60 text-muted-foreground hover:text-foreground transition-all flex items-center justify-center border border-border" data-code="${escapeHtml(decodedText)}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="copy-icon"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="check-icon hidden text-success"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                </div>
                <pre class="language-${language} p-4 text-foreground/80 overflow-x-auto scrollbar-thin max-w-full"><code class="language-${language}">${escapeHtml(decodedText)}</code></pre>
            </div>`;
};

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

    return `<img src="${escapeHtml(imageSrc)}" alt="${alt}" title="${titleAttr}" class="h-auto rounded-lg shadow-sm my-1 markdown-image cursor-pointer hover:opacity-90 transition-opacity" data-failed-url="${escapeHtml(imageSrc)}"${remoteSrcAttrs}${placeholderSrcAttrs} decoding="async" />`;
};

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

function useMarkdownImages(containerRef: React.RefObject<HTMLDivElement | null>, htmlContent: string, forceUpdate: () => void) {
    useEffect(() => {
        if (!containerRef.current) return;
        const cleanups: Array<() => void> = [];

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
                const failedMap = (window as Window & { __eduverseFailedMarkdownImages?: Record<string, boolean> }).__eduverseFailedMarkdownImages || {};
                failedMap[url] = true;
                (window as Window & { __eduverseFailedMarkdownImages?: Record<string, boolean> }).__eduverseFailedMarkdownImages = failedMap;
                forceUpdate();
            };

            img.addEventListener('error', handleError);
            cleanups.push(() => img.removeEventListener('error', handleError));
        });

        return () => cleanups.forEach((cleanup) => cleanup());
    }, [containerRef, forceUpdate, htmlContent]);
}

function useMarkdownEnhancements(containerRef: React.RefObject<HTMLDivElement | null>, htmlContent: string) {
    useEffect(() => {
        const currentContainer = containerRef.current;
        if (!currentContainer) return;
        const cleanups: Array<() => void> = [];

        if (htmlContent.includes('code-block-wrapper')) {
            currentContainer.querySelectorAll<HTMLElement>('.code-block-wrapper').forEach((wrapper) => {
                const code = wrapper.querySelector('code');
                const language = normalizeCodeLanguage(wrapper.getAttribute('data-code-language') || undefined);
                if (!code || code.getAttribute('data-highlighted') === 'true') return;

                loadPrismLanguage(language).then((Prism) => {
                    if (!code.isConnected) return;
                    const raw = he.decode(code.textContent || '');
                    const grammar = Prism.languages[language] || Prism.languages.text;
                    code.innerHTML = Prism.highlight(raw, grammar, language);
                    code.setAttribute('data-highlighted', 'true');
                }).catch((error) => {
                    console.error('Failed to highlight markdown code block:', error);
                });
            });
        }

        if (htmlContent.includes('class="mermaid"')) {
            getMermaid().then((mermaid) => {
                const mermaidElements = currentContainer.querySelectorAll('.mermaid');
                if (mermaidElements.length === 0) return;
                return mermaid.run({
                    nodes: mermaidElements as unknown as NodeListOf<HTMLElement>
                });
            }).catch((error) => {
                console.error('Mermaid render error:', error);
            });
        }

        const handleCopyClick = async (event: MouseEvent) => {
            const btn = (event.target as HTMLElement).closest('.copy-code-btn') as HTMLButtonElement | null;
            if (!btn) return;

            const code = btn.getAttribute('data-code');
            if (!code) return;

            try {
                await navigator.clipboard.writeText(code);
                const copyIcon = btn.querySelector('.copy-icon');
                const checkIcon = btn.querySelector('.check-icon');

                if (copyIcon && checkIcon) {
                    copyIcon.classList.add('hidden');
                    checkIcon.classList.remove('hidden');
                    btn.classList.add('bg-emerald-500/20', 'border-emerald-500/30');

                    window.setTimeout(() => {
                        copyIcon.classList.remove('hidden');
                        checkIcon.classList.add('hidden');
                        btn.classList.remove('bg-emerald-500/20', 'border-emerald-500/30');
                    }, 2000);
                }
            } catch (error) {
                console.error('Failed to copy code:', error);
            }
        };

        currentContainer.addEventListener('click', handleCopyClick);

        const preElements = currentContainer.querySelectorAll('.code-block-wrapper pre');
        preElements.forEach(pre => {
            const el = pre as HTMLElement;
            let isDown = false;
            let startX = 0;
            let scrollLeftStart = 0;

            const onMouseDown = (event: MouseEvent) => {
                if (el.scrollWidth <= el.clientWidth) return;
                isDown = true;
                el.style.cursor = 'grabbing';
                el.style.userSelect = 'none';
                startX = event.pageX - el.offsetLeft;
                scrollLeftStart = el.scrollLeft;
            };
            const stopDragging = () => {
                if (!isDown) return;
                isDown = false;
                el.style.cursor = 'grab';
                el.style.userSelect = '';
            };
            const onMouseMove = (event: MouseEvent) => {
                if (!isDown) return;
                event.preventDefault();
                const x = event.pageX - el.offsetLeft;
                const walk = (x - startX) * 1.5;
                el.scrollLeft = scrollLeftStart - walk;
            };

            if (el.scrollWidth > el.clientWidth) {
                el.style.cursor = 'grab';
            }

            el.addEventListener('mousedown', onMouseDown);
            el.addEventListener('mouseup', stopDragging);
            el.addEventListener('mouseleave', stopDragging);
            el.addEventListener('mousemove', onMouseMove);

            cleanups.push(() => {
                el.removeEventListener('mousedown', onMouseDown);
                el.removeEventListener('mouseup', stopDragging);
                el.removeEventListener('mouseleave', stopDragging);
                el.removeEventListener('mousemove', onMouseMove);
            });
        });

        return () => {
            cleanups.forEach((cleanup) => cleanup());
            currentContainer.removeEventListener('click', handleCopyClick);
        };
    }, [containerRef, htmlContent]);
}

export const MarkdownRenderer = React.memo(function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [, setImageFailureVersion] = React.useState(0);
    const forceImageFailureUpdate = useCallback(() => setImageFailureVersion(version => version + 1), []);

    const stopLinkGesturePropagation = useCallback((event: React.SyntheticEvent<HTMLDivElement>) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const link = target.closest('a[data-chat-link="true"]');
        if (!link) return;

        event.stopPropagation();
        if (event.type === 'contextmenu') {
            event.preventDefault();
        }
    }, []);

    const htmlContent = useMemo(() => {
        const source = content || '';
        if (!source.trim()) return '';
        try {
            if (typeof window !== 'undefined') {
                const failedMap = (window as Window & { __eduverseFailedMarkdownImages?: Record<string, boolean> }).__eduverseFailedMarkdownImages;
                if (failedMap) {
                    Object.keys(failedMap).forEach((url) => {
                        if (failedMap[url]) failedMarkdownImageUrls.add(url);
                    });
                }
            }

            const markdown = escapeRawHtml(source.replace(/\n+$/g, ''));
            return marked.parse(markdown, {
                breaks: true,
                gfm: true,
                renderer: markdownRenderer,
            }) as string;
        } catch (error) {
            console.error('Markdown parsing error:', error);
            return escapeHtml(source);
        }
    }, [content]);

    useMarkdownImages(containerRef, htmlContent, forceImageFailureUpdate);
    useMarkdownEnhancements(containerRef, htmlContent);

    return (
        <div className="markdown-renderer flex flex-col w-full">
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
        </div>
    );
}, (prev, next) => (
    prev.content === next.content &&
    prev.className === next.className
));
