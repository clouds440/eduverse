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
  Lightbulb,
  MoreHorizontal,
  Pencil,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useBackStackEntry } from "@/context/BackNavigationContext";
import { useAuth } from "@/context/AuthContext";
import { useUI } from "@/context/UIContext";
import { AIUsageSourceType, Role, type AIConversationSummary } from "@/types";
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
  const [actionsCollapsed, setActionsCollapsed] = useState(true);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AIConversationSummary | null>(
    null,
  );
  const {
    isOpen,
    close,
    messages,
    conversationId,
    activeConversationTitle,
    conversations,
    conversationsLoading,
    suggestedQuestions,
    suggestedQuestionsLoading,
    suggestedQuestionsLoaded,
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
    loadSuggestedQuestions,
    loadConversation,
    renameConversation,
    deleteConversation,
  } = useAICopilot();

  useBackStackEntry({
    enabled: isOpen,
    label: "EduVerse Copilot",
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
  const denialCode = entitlement && entitlement.allowed === false ? entitlement.code : undefined;
  const creditLimitReached = isCreditLimitReachedCode(denialCode);
  const canUseAccountActions = allowed === true || creditLimitReached;
  const sourceLabel = allowed
    ? entitlement.source.sourceType === AIUsageSourceType.ORGANIZATION
      ? "Org funded"
      : "Personal"
    : undefined;
  const remainingCredits = allowed
    ? entitlement.source.balance.remainingCredits
    : creditLimitReached
      ? 0
    : undefined;
  const monthlyCredits = allowed ? entitlement.source.balance.monthlyCredits : undefined;
  const hasMessages = messages.length > 0;
  const disabled = entitlementLoading || (allowed === false && !creditLimitReached) || isSending;
  const showSuggestions =
    allowed === true && !creditLimitReached && !hasMessages && suggestedQuestions.length > 0;
  const showSuggestionPrompt =
    allowed === true
    && !creditLimitReached
    && !hasMessages
    && suggestedQuestions.length === 0
    && !suggestedQuestionsLoaded;
  const dockedActive = isDesktop && isDocked && dockHostAvailable;
  const subscriptionHref = "/ai/subscription";

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

  const confirmDeleteConversation = async () => {
    if (!deleteTarget) return;
    try {
      await deleteConversation(deleteTarget.id);
    } catch (error) {
      console.warn("Unable to delete Copilot conversation", error);
    } finally {
      setDeleteTarget(null);
    }
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
          aria-label="Close EduVerse Copilot overlay"
          className="fixed inset-0 z-90 bg-background/55 backdrop-blur-sm"
          onClick={close}
        />
      )}
      <aside
        role="dialog"
        aria-modal={!isDesktop}
        aria-label="EduVerse Copilot"
        style={dockedActive ? { width: dockedWidth } : undefined}
        className={cn(
          "z-100 relative flex min-w-0 flex-col overflow-hidden border border-border/70 bg-background shadow-2xl",
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
            title="Resize EduVerse Copilot"
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
                  EduVerse Copilot
                </h1>
              </div>
              <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
                {activeConversationTitle
                  ? activeConversationTitle
                  : allowed
                    ? `${(remainingCredits ?? 0).toLocaleString()} credits remaining`
                    : creditLimitReached
                      ? "Credit limit reached"
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
                  aria-label="Refresh Copilot access"
                  title="Refresh Copilot access"
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
              title={
                actionsCollapsed
                  ? "Show Copilot actions"
                  : "Collapse Copilot actions"
              }
              aria-label={
                actionsCollapsed
                  ? "Show Copilot actions"
                  : "Collapse Copilot actions"
              }
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              icon={X}
              onClick={close}
              title="Close EduVerse Copilot"
              aria-label="Close EduVerse Copilot"
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
                entitlementAllowed={creditLimitReached ? true : entitlement?.allowed}
                denialCode={denialCode}
                denialMessage={
                  !entitlement?.allowed ? entitlement?.message : undefined
                }
                sourceLabel={sourceLabel}
                remainingCredits={remainingCredits}
                monthlyCredits={monthlyCredits}
              />
              {canUseAccountActions && (
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
                    href={subscriptionHref}
                    onClick={close}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-black text-foreground shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/60"
                  >
                    <CreditCard className="h-4 w-4" aria-hidden="true" />
                    {creditLimitReached ? "Top up" : "Subscription"}
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

        {showSuggestionPrompt && (
          <div className="shrink-0 px-3 pb-2 sm:px-4">
            <div className="flex items-center justify-between gap-3 rounded-full border border-border/70 bg-card/90 px-3 py-2 shadow-sm">
              <div className="flex min-w-0 items-center gap-2">
                <Lightbulb className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                <span className="truncate text-xs font-black text-foreground">
                  Need ideas?
                </span>
              </div>
              <button
                type="button"
                onClick={() => void loadSuggestedQuestions()}
                disabled={suggestedQuestionsLoading || disabled}
                className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-black text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {suggestedQuestionsLoading ? "Finding ideas" : "Show suggested prompts"}
              </button>
            </div>
          </div>
        )}

        {hasMessages && creditLimitReached && (
          <div className="shrink-0 px-3 pb-2 sm:px-4">
            <div className="flex flex-col gap-3 rounded-lg border border-warning/35 bg-warning/10 px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-black text-warning">
                  AI Credit limit reached
                </p>
                <p className="mt-1 text-xs font-semibold leading-5 text-warning/90">
                  EduVerse Copilot is still unlocked, but this billing period has no credits left.
                </p>
              </div>
              <Link
                href={subscriptionHref}
                onClick={close}
                className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-md bg-warning px-3 py-1.5 text-xs font-black text-white shadow-sm transition-colors hover:bg-warning/90"
              >
                Top up credits
              </Link>
            </div>
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

        {historyOpen && (
          <>
            <button
              type="button"
              aria-label="Close chat history"
              onClick={() => setHistoryOpen(false)}
              className="absolute inset-0 z-30 bg-background/45 backdrop-blur-[2px]"
            />
            <section className="absolute inset-y-0 left-0 z-40 flex w-[min(390px,calc(100%-1.5rem))] max-w-full flex-col border-r border-border/70 bg-background shadow-2xl animate-in slide-in-from-left-4 duration-200">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-card px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-foreground">
                    Chat history
                  </p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
                    Resume, rename, or delete Copilot chats
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  icon={X}
                  onClick={() => setHistoryOpen(false)}
                  title="Close chat history"
                  aria-label="Close chat history"
                />
              </div>
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    resetConversation();
                    setHistoryOpen(false);
                  }}
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-black text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New chat
                </button>
                <button
                  type="button"
                  onClick={refreshConversations}
                  disabled={conversationsLoading}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
                  aria-label="Refresh chat history"
                  title="Refresh chat history"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
                {conversationsLoading ? (
                  <div className="rounded-lg border border-border/70 bg-card p-4 text-sm font-semibold text-muted-foreground">
                    Loading conversations...
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="rounded-lg border border-border/70 bg-card p-4 text-sm font-semibold text-muted-foreground">
                    No previous Copilot chats yet.
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {conversations.map((conversation) => {
                      const isActive = conversation.id === conversationId;
                      const isEditing = editingTitleId === conversation.id;
                      return (
                        <div
                          key={conversation.id}
                          className={cn(
                            "flex min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-card p-2 shadow-sm transition-colors",
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
                              className="min-w-0 flex-1 py-1 text-left"
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
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(conversation)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                            aria-label="Delete Copilot chat"
                            title="Delete chat"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </aside>
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteConversation()}
        title="Delete Copilot chat?"
        description={
          deleteTarget
            ? `This permanently deletes "${deleteTarget.title}" and its messages. This cannot be undone.`
            : "This permanently deletes the selected Copilot chat and its messages. This cannot be undone."
        }
        confirmText="Delete"
        isDestructive
      />
    </>
  );
}

function isCreditLimitReachedCode(code?: string | null) {
  return code === "ORG_CREDITS_EXHAUSTED"
    || code === "ROLE_CREDITS_EXHAUSTED"
    || code === "PERSONAL_CREDITS_EXHAUSTED";
}
