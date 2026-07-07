"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  CreditCard,
  Gauge,
  PanelRightClose,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useBackStackEntry } from "@/context/BackNavigationContext";
import { useAuth } from "@/context/AuthContext";
import { useUI } from "@/context/UIContext";
import { AIUsageSourceType, Role } from "@/types";
import { cn } from "@/lib/utils";
import { useAICopilot } from "./AICopilotProvider";
import { AICopilotHome } from "./AICopilotHome";
import { AIMessageInput } from "./AIMessageInput";
import { AIMessageList } from "./AIMessageList";

export function AICopilotPanel() {
  const { user } = useAuth();
  const { isDesktop, mounted } = useUI();
  const {
    isOpen,
    close,
    messages,
    entitlement,
    entitlementLoading,
    isSending,
    error,
    sendPrompt,
    retryLast,
    cancel,
    resetConversation,
    refreshEntitlement,
  } = useAICopilot();

  useBackStackEntry({
    enabled: isOpen,
    label: "AI Copilot",
    priority: 75,
    onBack: close,
  });

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, isOpen]);

  if (!mounted || !isOpen) return null;

  const allowed = entitlement?.allowed;
  const sourceLabel = allowed
    ? entitlement.source.sourceType === AIUsageSourceType.ORGANIZATION
      ? "Org funded"
      : "Personal"
    : undefined;
  const remainingCredits = allowed
    ? entitlement.source.balance.remainingCredits
    : undefined;
  const hasMessages = messages.length > 0;
  const disabled = entitlementLoading || allowed === false || isSending;

  return (
    <>
      {!isDesktop && (
        <button
          type="button"
          aria-label="Close AI Copilot overlay"
          className="fixed inset-0 z-90 bg-background/55 backdrop-blur-sm"
          onClick={close}
        />
      )}
      <aside
        role="dialog"
        aria-modal={!isDesktop}
        aria-label="EduVerse AI Copilot"
        className={cn(
          "fixed z-100 flex min-w-0 flex-col overflow-hidden border border-border/70 bg-background shadow-2xl",
          "animate-in fade-in slide-in-from-bottom-4 duration-200",
          isDesktop
            ? "bottom-5 right-5 top-5 w-[min(480px,calc(100vw-2.5rem))] rounded-xl"
            : "inset-0 rounded-none",
        )}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-card px-3 py-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-primary">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="truncate text-sm font-black text-foreground">
                  EduVerse AI Copilot
                </h1>
                {sourceLabel && (
                  <Badge variant="success" size="xs">
                    {sourceLabel}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
                {allowed
                  ? `${(remainingCredits ?? 0).toLocaleString()} credits remaining`
                  : entitlementLoading
                    ? "Checking access"
                    : "Premium addon"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              icon={RefreshCw}
              onClick={refreshEntitlement}
              aria-label="Refresh AI access"
              title="Refresh AI access"
              disabled={entitlementLoading}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              icon={Plus}
              onClick={resetConversation}
              title="New Copilot conversation"
              aria-label="New Copilot conversation"
              disabled={isSending && messages.length === 0}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              icon={isDesktop ? PanelRightClose : X}
              onClick={close}
              title="Close AI Copilot"
              aria-label="Close AI Copilot"
            />
          </div>
        </header>

        <div className="min-h-0 flex-1 bg-background">
          {hasMessages ? (
            <AIMessageList messages={messages} />
          ) : (
            <div className="h-full overflow-y-auto p-3 custom-scrollbar sm:p-4">
              <AICopilotHome
                role={user?.role}
                entitlementLoading={entitlementLoading}
                entitlementAllowed={entitlement?.allowed}
                denialMessage={
                  !entitlement?.allowed ? entitlement?.message : undefined
                }
                sourceLabel={sourceLabel}
                remainingCredits={remainingCredits}
                onPrompt={sendPrompt}
                disabled={disabled}
              />
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Link
                  href="/ai"
                  onClick={close}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-black text-foreground shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/60"
                >
                  <Gauge className="h-4 w-4" aria-hidden="true" />
                  Usage
                </Link>
                <Link
                  href={
                    user?.role === Role.ORG_ADMIN ? "/settings?tab=ai" : "/ai"
                  }
                  onClick={close}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-black text-foreground shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/60"
                >
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                  Subscription
                </Link>
              </div>
            </div>
          )}
        </div>

        <AIMessageInput
          disabled={disabled}
          isSending={isSending}
          error={error}
          onSend={sendPrompt}
          onCancel={cancel}
          onRetry={retryLast}
        />
      </aside>
    </>
  );
}
