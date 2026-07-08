"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
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
    <div className="h-full min-h-0 overflow-y-auto px-3 py-4 custom-scrollbar sm:px-4">
      <div className="mx-auto grid max-w-3xl gap-4">
        {messages.map((message) => {
          const isUser = message.role === "user";
          const Icon = Sparkles;
          return (
            <div
              key={message.id}
              className={cn("flex min-w-0 gap-3", isUser && "flex-row-reverse")}
            >
              {!isUser && (
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border shadow-sm",
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
                  "group/message relative min-w-0 max-w-[82%] rounded-lg border px-3 py-2.5 shadow-sm",
                  isUser
                    ? "border-primary/20 bg-primary text-primary-foreground"
                    : message.status === "error"
                      ? "border-danger/30 bg-danger/10 text-danger"
                      : "border-border/70 bg-card text-foreground",
                )}
              >
                {message.status === "sending" && !message.content ? (
                  <div className="min-w-55 overflow-hidden rounded-md border border-primary/15 bg-primary/5 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Sparkles
                          className="h-3.5 w-3.5 animate-pulse"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="truncate text-xs font-black text-foreground">
                        {message.statusLabel ?? "Thinking"}
                      </span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-primary/10">
                      <div className="h-full w-1/2 animate-[ai-progress_1.4s_ease-in-out_infinite] rounded-full bg-primary/70" />
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
