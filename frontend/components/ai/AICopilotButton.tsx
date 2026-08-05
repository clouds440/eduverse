"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useAICopilot } from "./AICopilotProvider";
import { useUI } from "@/context/UIContext";
import { useGlobal } from "@/context/GlobalContext";
import { cn } from "@/lib/utils";
import { CopilotIcon } from "./CopilotIcon";

export function AICopilotButton() {
  const {
    isOpen,
    toggle,
    entitlement,
    entitlementLoading,
    isSending,
    isDocked,
    dockHostAvailable,
  } = useAICopilot();
  const { isDesktop, mounted } = useUI();
  const { dispatch } = useGlobal();
  const [dismissed, setDismissed] = useState(false);
  const isAllowed = entitlement?.allowed;

  if (mounted && isDesktop && isOpen && isDocked && dockHostAvailable)
    return null;
  if (!mounted || (dismissed && !isOpen)) return null;

  const dismissButton = () => {
    setDismissed(true);
    dispatch({
      type: "TOAST_ADD",
      payload: {
        message:
          "EduVerse Copilot button hidden. Reload the page to bring it back.",
        type: "info",
      },
    });
  };

  return (
    <div className="fixed bottom-4 right-4 z-100 lg:bottom-5 lg:right-5 group">
      {!isOpen && (
        <button
          type="button"
          onClick={dismissButton}
          aria-label="Dismiss EduVerse Copilot button"
          className="hidden group-hover:flex absolute -right-2 -top-2 z-10 h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground shadow-md transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
      {!isOpen && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Open EduVerse Copilot"
          aria-pressed={isOpen}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-primary shadow-xl",
            "duration-200 ease-out hover:-translate-y-0.5 hover:shadow-2xl",
            isAllowed && "border-cyan border-2",
            entitlementLoading && "animate-pulse",
          )}
        >
          <CopilotIcon
            className={cn(
              "h-10 w-9 transition-transform duration-200 grayscale",
              isAllowed && "grayscale-0",
              isSending && "animate-pulse",
            )}
            aria-hidden={true}
          />
        </button>
      )}
    </div>
  );
}
