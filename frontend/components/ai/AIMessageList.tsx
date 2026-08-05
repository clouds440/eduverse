"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { CopilotIcon } from "./CopilotIcon";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { AICopilotMessage } from "./AICopilotProvider";
import { cn } from "@/lib/utils";

interface AIMessageListProps {
  messages: AICopilotMessage[];
}

export function AIMessageList({ messages }: AIMessageListProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="h-full min-h-0 overflow-y-auto px-3 py-5 custom-scrollbar sm:px-5">
      <div className="mx-auto grid max-w-3xl gap-5">
        {messages.map((message) => {
          const isUser = message.role === "user";
          const Icon = CopilotIcon;
          return (
            <div
              key={message.id}
                className={cn("flex min-w-0 gap-2.5", isUser && "flex-row-reverse")}
            >
              {!isUser && (
                <div
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border shadow-sm",
                    isUser
                      ? "border-primary/25 bg-primary text-primary-foreground"
                      : "border-border bg-card text-primary",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
              )}
              <div
                className={cn(
                  "group/message relative min-w-0 rounded-2xl border px-3.5 py-3 shadow-xs",
                  isUser
                    ? "max-w-[82%] border-primary/20 bg-primary text-primary-foreground"
                    : message.status === "error"
                      ? "max-w-[92%] border-danger/25 bg-danger/10 text-danger"
                      : "max-w-[92%] border-border/60 bg-card/95 text-foreground",
                )}
              >
                {message.status === "sending" && !message.content ? (
                  <div className="min-w-48 py-0.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/35" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                      </span>
                      <span className="truncate text-sm font-semibold text-muted-foreground">
                        {formatStatusLabel(message.statusLabel)}
                      </span>
                    </div>
                  </div>
                ) : isUser ? (
                  <>
                    <MessageCopyButton
                      content={message.content}
                      isUser={isUser}
                    />
                    <p className="whitespace-pre-wrap pr-5 text-sm font-semibold leading-6">
                      {message.content}
                    </p>
                  </>
                ) : (
                  <div className="relative">
                    <MessageCopyButton
                      content={message.content}
                      isUser={isUser}
                    />
                    <MarkdownRenderer
                      content={message.content}
                      className="prose-sm max-w-none pr-5 text-sm leading-6 [&>*:first-child]:mt-0! [&>*:last-child]:mb-0! [&>p:first-child]:mt-0!"
                    />
                    <MessageContextRow message={message} />
                    {message.status === "streaming" && (
                      <span
                        className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-full bg-primary align-middle"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function formatStatusLabel(label?: string) {
  if (!label) return "Thinking";
  const normalized = label.trim();
  if (!normalized) return "Thinking";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function MessageContextRow({ message }: { message: AICopilotMessage }) {
  const sources = dedupeLabels(message.sources ?? []).slice(0, 5);
  const actions = (message.relatedActions ?? [])
    .filter((action) => isSafeInternalHref(action.href))
    .slice(0, 4);

  if (!sources.length && !actions.length) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
      {sources.map((source) => (
        <span
          key={`${source.kind}:${source.label}`}
          className="rounded-md border border-border/70 bg-background/70 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground"
        >
          {source.label}
        </span>
      ))}
      {actions.map((action) => (
        <Link
          key={`${action.href}:${action.label}`}
          href={action.href}
          className="rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
        >
          {action.label}
        </Link>
      ))}
    </div>
  );
}

function dedupeLabels(items: Array<{ label: string; kind: string }>) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(item.label.trim());
  });
}

function isSafeInternalHref(href: string) {
  return href.startsWith("/") && !href.startsWith("//");
}

function MessageCopyButton({
  content,
  isUser,
}: {
  content: string;
  isUser: boolean;
}) {
  const [copied, setCopied] = useState(false);
  if (!content.trim()) return null;
  const Icon = copied ? Check : Copy;

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copyMessage}
      aria-label={copied ? "Message copied" : "Copy message"}
      title={copied ? "Copied" : "Copy"}
      className={cn(
        "absolute right-0.5 bottom-0.5 z-10 flex h-7 w-7 items-center justify-center rounded-md border text-xs shadow-xs opacity-70 transition-all hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 sm:opacity-0 sm:group-hover/message:opacity-100",
        isUser
          ? "border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
          : "border-border/60 bg-background/80 text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}
