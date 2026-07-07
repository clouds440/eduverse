"use client";

import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { Badge } from "@/components/ui/Badge";
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
                  "min-w-0 max-w-[82%] rounded-lg border px-3 py-2.5 shadow-sm",
                  isUser
                    ? "border-primary/20 bg-primary text-primary-foreground"
                    : message.status === "error"
                      ? "border-danger/30 bg-danger/10 text-danger"
                      : "border-border/70 bg-card text-foreground",
                )}
              >
                {message.status === "sending" && !message.content ? (
                  <div className="flex items-center gap-2 py-1.5">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary delay-100" />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary delay-200" />
                  </div>
                ) : isUser ? (
                  <p className="whitespace-pre-wrap text-sm font-semibold leading-6">
                    {message.content}
                  </p>
                ) : (
                  <div className="relative">
                    <MarkdownRenderer
                      content={message.content}
                      className="prose-sm max-w-none text-sm leading-6"
                    />
                    {message.status === "streaming" && (
                      <span
                        className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-full bg-primary align-middle"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                )}
                {message.usage && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/40 pt-2">
                    <Badge variant="secondary" size="sm">
                      {message.usage.creditEstimate} credits
                    </Badge>
                    <Badge variant="neutral" size="sm">
                      {message.provider?.name ?? "provider"}
                    </Badge>
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
