"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import {
  Check,
  CreditCard,
  Gauge,
  History,
  MoreHorizontal,
  Pencil,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
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
import { AISuggestedPrompts } from "./AISuggestedPrompts";

export function AICopilotPanel() {
  const { user } = useAuth();
  const { isDesktop, mounted } = useUI();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [actionsCollapsed, setActionsCollapsed] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const {
    isOpen,
    close,
    messages,
    conversationId,
    activeConversationTitle,
    conversations,
    conversationsLoading,
    suggestedQuestions,
    isDocked,
    dockedWidth,
    dockHostAvailable,
    setIsDocked,
    setDockedWidth,
    entitlement,
    entitlementLoading,
    isSending,
    error,
    sendPrompt,
    retryLast,
    cancel,
    resetConversation,
    refreshEntitlement,
    refreshConversations,
    loadConversation,
    renameConversation,
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
  const showSuggestions =
    allowed === true && !hasMessages && suggestedQuestions.length > 0;
  const dockedActive = isDesktop && isDocked && dockHostAvailable;

  if (!mounted || !isOpen) return null;

  const startEditTitle = (id: string, title: string) => {
    setEditingTitleId(id);
    setEditingTitle(title);
  };

  const saveTitle = async () => {
    const id = editingTitleId;
    const title = editingTitle.trim();
    if (!id || !title) {
      setEditingTitleId(null);
      return;
    }
    await renameConversation(id, title);
    setEditingTitleId(null);
  };

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(pointerId);
    const onPointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.min(
        Math.max(window.innerWidth - moveEvent.clientX, 420),
        760,
      );
      setDockedWidth(nextWidth);
    };
    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

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
        style={dockedActive ? { width: dockedWidth } : undefined}
        className={cn(
          "z-100 flex min-w-0 flex-col overflow-hidden border border-border/70 bg-background shadow-2xl",
          dockedActive
            ? "relative h-full rounded-none border-y-0 border-r-0 animate-in fade-in slide-in-from-right-3 duration-200"
            : "animate-in fade-in slide-in-from-bottom-4 duration-200",
          isDesktop
            ? dockedActive
              ? ""
              : "fixed bottom-5 right-5 top-5 w-[min(560px,calc(100vw-2.5rem))] rounded-xl"
            : "fixed inset-0 rounded-none",
        )}
      >
        {dockedActive && (
          <div
            role="separator"
            aria-orientation="vertical"
            title="Resize AI Copilot"
            onPointerDown={startResize}
            className="group absolute left-0 top-0 z-10 h-full w-2 cursor-col-resize touch-none bg-transparent transition-colors hover:bg-primary/10"
          >
            <span className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border transition-colors group-hover:bg-primary/55" />
          </div>
        )}
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
              </div>
              <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
                {activeConversationTitle
                  ? activeConversationTitle
                  : allowed
                    ? `${(remainingCredits ?? 0).toLocaleString()} credits remaining`
                    : entitlementLoading
                      ? "Checking access"
                      : "Premium addon"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!actionsCollapsed && (
              <>
                {isDesktop && dockHostAvailable && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    icon={dockedActive ? PanelRightClose : PanelRightOpen}
                    onClick={() => setIsDocked((current) => !current)}
                    title={
                      dockedActive
                        ? "Use floating Copilot"
                        : "Dock Copilot to the right"
                    }
                    aria-label={
                      dockedActive
                        ? "Use floating Copilot"
                        : "Dock Copilot to the right"
                    }
                  />
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  icon={History}
                  onClick={() => {
                    setHistoryOpen((current) => !current);
                    void refreshConversations();
                  }}
                  title="Previous Copilot conversations"
                  aria-label="Previous Copilot conversations"
                  disabled={conversationsLoading}
                />
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
              </>
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              icon={MoreHorizontal}
              onClick={() => setActionsCollapsed((current) => !current)}
              title={actionsCollapsed ? "Show Copilot actions" : "Collapse Copilot actions"}
              aria-label={actionsCollapsed ? "Show Copilot actions" : "Collapse Copilot actions"}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              icon={X}
              onClick={close}
              title="Close AI Copilot"
              aria-label="Close AI Copilot"
            />
          </div>
        </header>

        {historyOpen && (
          <div className="shrink-0 border-b border-border/70 bg-card/70 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Previous Chats
              </p>
              <button
                type="button"
                onClick={() => {
                  resetConversation();
                  setHistoryOpen(false);
                }}
                className="text-xs font-black text-primary hover:underline"
              >
                New chat
              </button>
            </div>
            <div className="grid max-h-52 gap-2 overflow-y-auto custom-scrollbar">
              {conversationsLoading ? (
                <div className="rounded-lg border border-border/70 bg-background/70 p-3 text-sm font-semibold text-muted-foreground">
                  Loading conversations...
                </div>
              ) : conversations.length === 0 ? (
                <div className="rounded-lg border border-border/70 bg-background/70 p-3 text-sm font-semibold text-muted-foreground">
                  No previous Copilot chats yet.
                </div>
              ) : (
                conversations.map((conversation) => {
                  const isActive = conversation.id === conversationId;
                  const isEditing = editingTitleId === conversation.id;
                  return (
                    <div
                      key={conversation.id}
                      className={cn(
                        "flex min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-background/70 p-2",
                        isActive && "border-primary/35 bg-primary/5",
                      )}
                    >
                      {isEditing ? (
                        <input
                          value={editingTitle}
                          onChange={(event) =>
                            setEditingTitle(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void saveTitle();
                            if (event.key === "Escape") setEditingTitleId(null);
                          }}
                          onBlur={() => void saveTitle()}
                          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm font-semibold text-foreground outline-none focus:border-primary/40"
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            void loadConversation(conversation.id);
                            setHistoryOpen(false);
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-sm font-black text-foreground">
                            {conversation.title}
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                            {conversation.messageCount} messages
                            {conversation.creditTotal > 0
                              ? ` - ${conversation.creditTotal.toLocaleString()} credits`
                              : ""}
                          </p>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          isEditing
                            ? void saveTitle()
                            : startEditTitle(
                                conversation.id,
                                conversation.title,
                              )
                        }
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={
                          isEditing ? "Save chat title" : "Edit chat title"
                        }
                      >
                        {isEditing ? (
                          <Check className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

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
              />
              {allowed === true && (
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
                      user?.role === Role.ORG_ADMIN ? "/settings?tab=ai" : "/ai/subscription"
                    }
                    onClick={close}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-black text-foreground shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/60"
                  >
                    <CreditCard className="h-4 w-4" aria-hidden="true" />
                    Subscription
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {showSuggestions && (
          <div className="shrink-0 px-1 pb-1">
            <AISuggestedPrompts
              suggestions={suggestedQuestions}
              onSelect={sendPrompt}
              disabled={disabled}
            />
          </div>
        )}

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
