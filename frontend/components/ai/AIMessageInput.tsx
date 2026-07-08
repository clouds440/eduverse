"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { CircleStop, SendHorizontal } from "lucide-react";

interface AIMessageInputProps {
  disabled?: boolean;
  isSending?: boolean;
  error?: string | null;
  onSend: (prompt: string) => void;
  onCancel: () => void;
  onRetry: () => void;
}

export function AIMessageInput({
  disabled,
  isSending,
  error,
  onSend,
  onCancel,
  onRetry,
}: AIMessageInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(180, Math.max(48, textarea.scrollHeight))}px`;
  }, [value]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const prompt = value.trim();
    if (!prompt || disabled || isSending) return;
    setValue("");
    onSend(prompt);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form
      onSubmit={submit}
      className="px-3 pb-3 pt-2 sm:px-4 sm:pb-4"
    >
      {error && (
        <div className="mb-2 flex items-center justify-between gap-3 rounded-md border border-danger/25 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
          <span className="min-w-0 truncate">{error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 font-black cursor-pointer underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}
      <div className="flex min-w-0 items-end">
        <div className="min-w-0 flex-1 rounded-3xl border-2 border-border/70 bg-card/95 shadow-lg shadow-foreground/5 transition-all focus-within:border-primary/30 focus-within:bg-background/70 focus-within:ring-4 focus-within:ring-primary/10">
          <div className="flex min-w-0 items-end px-3">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled || isSending}
              rows={1}
              placeholder={
                disabled
                  ? "EduVerse Copilot is not available."
                  : "Ask EduVerse Copilot..."
              }
              className="max-h-45 min-h-12 w-full resize-none border-none bg-transparent px-2 py-3 text-[14px] font-semibold leading-relaxed text-foreground outline-none transition-[height] duration-300 placeholder:text-muted-foreground focus:outline-none focus:ring-0 sm:text-[15px]"
              aria-label="Message EduVerse Copilot"
            />
          </div>
        </div>
        {isSending ? (
          <div className="ml-2 flex w-12 items-end justify-center">
            <button
              type="button"
              onClick={onCancel}
              aria-label="Stop response"
              className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-md transition-transform hover:scale-[1.03] hover:bg-secondary/90 hover:shadow-lg active:scale-95"
            >
              <CircleStop size={18} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div
            className={`flex items-end justify-center transition-all duration-300 ease-out ${value.trim() && !disabled ? "ml-2 w-12 scale-100 opacity-100" : "ml-0 w-0 scale-50 overflow-hidden opacity-0"}`}
          >
            <button
              type="submit"
              disabled={disabled || !value.trim()}
              aria-label="Send message"
              className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-[1.03] hover:bg-primary/90 hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            >
              <SendHorizontal size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      {error && (
        <button type="button" onClick={onRetry} className="sr-only">
          Retry last Copilot prompt
        </button>
      )}
    </form>
  );
}
