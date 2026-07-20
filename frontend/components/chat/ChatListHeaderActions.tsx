"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquarePlus, MoreVertical, ShieldCheck } from "lucide-react";

interface ChatListHeaderActionsProps {
  canCreateChat: boolean;
  onNewChat: () => void;
  onOpenBlockedDms: () => void;
}

export function ChatListHeaderActions({
  canCreateChat,
  onNewChat,
  onOpenBlockedDms,
}: ChatListHeaderActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  return (
    <div className="flex items-center gap-2">
      {canCreateChat && (
        <button
          type="button"
          onClick={onNewChat}
          className="p-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 cursor-pointer transition-all shadow-sm hover:shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          title="New Chat"
        >
          <MessageSquarePlus size={18} />
        </button>
      )}

      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="p-2.5 bg-background/80 text-muted-foreground border border-border/60 rounded-xl hover:bg-muted hover:text-foreground cursor-pointer transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          title="Message options"
          aria-haspopup="menu"
          aria-expanded={isOpen}
        >
          <MoreVertical size={18} />
        </button>

        {isOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-2 z-50 min-w-48 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-xl"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onOpenBlockedDms();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ShieldCheck size={15} />
              Blocked Users
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
