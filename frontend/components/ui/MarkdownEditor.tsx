import { useState, useRef, forwardRef, useImperativeHandle, useId, useEffect } from 'react';
import { Bold, Link as LinkIcon, Eye, Type, Zap, User, Hash, Mail, Calendar, PenTool, ShieldCheck } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CustomSelect } from './CustomSelect';

interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    rows?: number;
    className?: string;
    templates?: { label: string; content: string }[];
    orgData?: Record<string, string>;
    onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onFocus?: () => void;
}

export interface MarkdownEditorHandle {
    focus: () => void;
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(({
    value,
    onChange,
    placeholder = 'Enter message (Markdown supported)...',
    rows = 6,
    className = '',
    templates = [],
    orgData = {},
    onKeyDown,
    onFocus
}, ref) => {
    const [previewMode, setPreviewMode] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const editorId = useId();

    // Auto-resize when `value` changes (covers programmatic updates like editing)
    const resizeTextarea = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        const max = 320; // px
        ta.style.height = Math.min(ta.scrollHeight, max) + 'px';
    };

    // run on mount and whenever value changes
    useEffect(() => {
        resizeTextarea();
    }, [value]);

    useImperativeHandle(ref, () => ({
        focus: () => {
            if (previewMode) setPreviewMode(false);
            setTimeout(() => textareaRef.current?.focus(), 0);
        }
    }));

    const insertText = (before: string, after: string = '') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selected = text.substring(start, end);

        // Save current scroll position
        const scrollTop = textarea.scrollTop;

        const newValue = text.substring(0, start) + before + selected + after + text.substring(end);
        onChange(newValue);

        // Refocus and restore scroll/selection
        setTimeout(() => {
            textarea.focus();
            textarea.scrollTop = scrollTop;
            textarea.setSelectionRange(start + before.length, end + before.length);
        }, 0);
    };

    const applyTemplate = (content: string) => {
        let finalContent = content;
        // Replace placeholders with orgData
        Object.entries(orgData).forEach(([key, val]) => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            finalContent = finalContent.replace(regex, val || '');
        });
        onChange(finalContent);
    };

    return (
        <div className={`flex flex-col border border-border rounded-xl overflow-hidden bg-card shadow-inner ${className}`}>
            <div className="flex flex-wrap items-center justify-between px-3 bg-muted/30 border-b border-border gap-2">
                <div className="flex items-center gap-1 flex-wrap">
                    {!previewMode && (
                        <>
                            <button
                                type="button"
                                onClick={() => insertText('**', '**')}
                                className="p-1.5 hover:bg-card rounded-lg text-muted-foreground transition-colors border border-transparent hover:border-border"
                                title="Bold"
                            >
                                <Bold className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => insertText('[', '](url)')}
                                className="p-1.5 hover:bg-card rounded-lg text-muted-foreground transition-colors border border-transparent hover:border-border"
                                title="Link"
                            >
                                <LinkIcon className="w-4 h-4" />
                            </button>

                            <div className="h-6 w-px bg-border mx-1"></div>

                            {templates.length > 0 && (
                                <CustomSelect
                                    options={templates.map((t, i) => ({
                                        value: i.toString(),
                                        label: t.label,
                                        icon: Zap,
                                        iconClassName: 'text-warning'
                                    }))}
                                    value=""
                                    onChange={(val: string) => {
                                        const index = parseInt(val);
                                        if (!isNaN(index)) applyTemplate(templates[index].content);
                                    }}
                                    placeholder="Templates"
                                    icon={Zap}
                                    className="w-auto py-0!"
                                />
                            )}

                            {Object.keys(orgData).length > 0 && (
                                <CustomSelect
                                    options={[
                                        ...['name', 'id', 'email'].filter(k => orgData[k]).map(key => ({
                                            value: `org-${key}`,
                                            label: key.toUpperCase(),
                                            icon: key === 'name' ? User : key === 'id' ? Hash : Mail,
                                            iconClassName: key === 'name' ? 'text-primary' : key === 'id' ? 'text-danger' : 'text-info'
                                        })),
                                        ...['admin', 'role', 'date', 'signature'].filter(k => orgData[k]).map(key => ({
                                            value: `gen-${key}`,
                                            label: key.toUpperCase(),
                                            icon: key === 'admin' ? PenTool : key === 'role' ? ShieldCheck : key === 'date' ? Calendar : Zap,
                                            iconClassName: key === 'admin' ? 'text-success' : key === 'role' ? 'text-foreground' : key === 'date' ? 'text-warning' : 'text-danger'
                                        }))
                                    ]}
                                    value=""
                                    onChange={(val: string) => {
                                        const rest = val.split('-').slice(1);
                                        const key = rest.join('-');
                                        if (orgData[key]) insertText(orgData[key]);
                                    }}
                                    placeholder="Insert Data"
                                    icon={Hash}
                                    className="w-auto py-0!"
                                />
                            )}
                        </>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => setPreviewMode(!previewMode)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black tracking-widest rounded-lg transition-all border ${previewMode
                        ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                        : 'text-muted-foreground border-border hover:bg-card'
                        }`}
                >
                    {previewMode ? (
                        <>
                            <Type className="w-3.5 h-3.5" />
                            Edit Mode
                        </>
                    ) : (
                        <>
                            <Eye className="w-3.5 h-3.5" />
                            Preview
                        </>
                    )}
                </button>
            </div>

            <div className="relative min-h-auto">
                {previewMode ? (
                    <div className="p-5 overflow-y-auto max-h-100 bg-card">
                        {value.length > 0 ? (
                            <MarkdownRenderer content={value} />
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 opacity-30 select-none">
                                <Eye className="w-12 h-12 mb-2" />
                                <p className="font-black tracking-widest text-xs">Nothing to preview</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <textarea
                        id={editorId}
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={onKeyDown}
                        onFocus={onFocus}
                        placeholder={placeholder}
                        rows={rows + (value.length > 100 ? 3 : 0) + (value.length > 300 ? 3 : 0) + (value.length > 600 ? 3 : 0)}
                        className="w-full p-2.5 outline-none resize-y border-none focus:ring-0 bg-transparent custom-scrollbar max-h-110 min-h-10 font-medium leading-relaxed text-foreground placeholder:text-muted-foreground/50"
                    />
                )}
            </div>
        </div>
    );
});

MarkdownEditor.displayName = 'MarkdownEditor';
