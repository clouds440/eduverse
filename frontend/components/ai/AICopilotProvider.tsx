"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useUI } from "@/context/UIContext";
import {
  AIChatResponse,
  AIConversationSummary,
  AIEntitlementResponse,
  AISuggestedQuestion,
  AIUsageSourceType,
} from "@/types";
import { AICopilotButton } from "./AICopilotButton";
import { AICopilotPanel } from "./AICopilotPanel";

export interface AICopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "sending" | "streaming" | "complete" | "error";
  createdAt: number;
  provider?: AIChatResponse["provider"];
  usage?: AIChatResponse["usage"];
  statusLabel?: string;
}

interface AICopilotContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  messages: AICopilotMessage[];
  entitlement: AIEntitlementResponse | null;
  entitlementLoading: boolean;
  isSending: boolean;
  error: string | null;
  conversationId?: string;
  activeConversationTitle?: string | null;
  conversations: AIConversationSummary[];
  conversationsLoading: boolean;
  suggestedQuestions: AISuggestedQuestion[];
  suggestedQuestionsLoading: boolean;
  isDocked: boolean;
  dockedWidth: number;
  dockHostAvailable: boolean;
  setIsDocked: (value: boolean | ((current: boolean) => boolean)) => void;
  setDockedWidth: (value: number | ((current: number) => number)) => void;
  sendPrompt: (prompt: string) => Promise<void>;
  retryLast: () => Promise<void>;
  cancel: () => void;
  resetConversation: () => void;
  refreshEntitlement: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  renameConversation: (conversationId: string, title: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
}

const AICopilotContext = createContext<AICopilotContextValue | undefined>(
  undefined,
);

export function AICopilotProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const { isDesktop, mounted } = useUI();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AICopilotMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [activeConversationTitle, setActiveConversationTitle] = useState<
    string | null | undefined
  >();
  const [conversations, setConversations] = useState<AIConversationSummary[]>(
    [],
  );
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<
    AISuggestedQuestion[]
  >([]);
  const [suggestedQuestionsLoading, setSuggestedQuestionsLoading] =
    useState(false);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const [entitlement, setEntitlement] = useState<AIEntitlementResponse | null>(
    null,
  );
  const [entitlementLoading, setEntitlementLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDocked, setIsDocked] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("eduverse-ai-copilot-docked") === "true";
  });
  const [dockedWidth, setDockedWidth] = useState(() => {
    if (typeof window === "undefined") return 520;
    const stored = Number(
      window.localStorage.getItem("eduverse-ai-copilot-docked-width"),
    );
    return Number.isFinite(stored) ? Math.min(Math.max(stored, 420), 760) : 520;
  });
  const [dockHostAvailable, setDockHostAvailable] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastPromptRef = useRef<string | null>(null);
  const messagesRef = useRef<AICopilotMessage[]>([]);
  const conversationStorageKey = user
    ? `eduverse-ai-copilot-conversation:${user.id}`
    : null;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!mounted) return;
    setDockHostAvailable(
      Boolean(document.getElementById("eduverse-ai-copilot-dock-host")),
    );
  }, [mounted, pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("eduverse-ai-copilot-docked", String(isDocked));
  }, [isDocked]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "eduverse-ai-copilot-docked-width",
      String(dockedWidth),
    );
  }, [dockedWidth]);

  useEffect(() => {
    if (!conversationStorageKey || conversationId) return;
    const storedConversationId = sessionStorage.getItem(conversationStorageKey);
    if (storedConversationId) setConversationId(storedConversationId);
  }, [conversationId, conversationStorageKey]);

  useEffect(() => {
    if (!conversationStorageKey) return;
    if (conversationId) {
      sessionStorage.setItem(conversationStorageKey, conversationId);
    } else {
      sessionStorage.removeItem(conversationStorageKey);
    }
  }, [conversationId, conversationStorageKey]);

  const refreshEntitlement = useCallback(async () => {
    if (!token || !user) return;
    setEntitlementLoading(true);
    try {
      const next = await api.ai.getEntitlement(token);
      setEntitlement(next);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to load EduVerse Copilot access.";
      setEntitlement({ allowed: false, code: "UNAVAILABLE", message });
    } finally {
      setEntitlementLoading(false);
    }
  }, [token, user]);

  const refreshConversations = useCallback(async () => {
    if (!token || !user) return;
    setConversationsLoading(true);
    try {
      setConversations(await api.ai.getConversations(token));
    } catch (err) {
      console.warn("Unable to load EduVerse Copilot conversations", err);
    } finally {
      setConversationsLoading(false);
    }
  }, [token, user]);

  const refreshSuggestedQuestions = useCallback(async () => {
    if (!token || !user || suggestedQuestionsLoading || suggestionsLoaded)
      return;
    setSuggestedQuestionsLoading(true);
    try {
      const response = await api.ai.getSuggestedQuestions(token);
      setSuggestedQuestions(response.suggestions);
      setSuggestionsLoaded(true);
    } catch (err) {
      console.warn("Unable to load EduVerse Copilot suggestions", err);
      setSuggestionsLoaded(true);
    } finally {
      setSuggestedQuestionsLoading(false);
    }
  }, [suggestedQuestionsLoading, suggestionsLoaded, token, user]);

  useEffect(() => {
    if (!token || !user) {
      messagesRef.current = [];
      setMessages([]);
      setConversationId(undefined);
      setActiveConversationTitle(undefined);
      setConversations([]);
      setSuggestedQuestions([]);
      setSuggestionsLoaded(false);
      if (conversationStorageKey)
        sessionStorage.removeItem(conversationStorageKey);
      setEntitlement(null);
      return;
    }
    void refreshEntitlement();
    void refreshConversations();
  }, [
    conversationStorageKey,
    refreshConversations,
    refreshEntitlement,
    token,
    user,
  ]);

  useEffect(() => {
    if (!isOpen || entitlement?.allowed !== true || suggestionsLoaded) return;
    void refreshSuggestedQuestions();
  }, [
    entitlement?.allowed,
    isOpen,
    refreshSuggestedQuestions,
    suggestionsLoaded,
  ]);

  const close = useCallback(() => setIsOpen(false), []);
  const open = useCallback(() => {
    setIsOpen(true);
    if (!entitlement && !entitlementLoading) void refreshEntitlement();
  }, [entitlement, entitlementLoading, refreshEntitlement]);
  const toggle = useCallback(() => {
    setIsOpen((current) => {
      const next = !current;
      if (next && !entitlement && !entitlementLoading)
        void refreshEntitlement();
      return next;
    });
  }, [entitlement, entitlementLoading, refreshEntitlement]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsSending(false);
  }, []);

  const resetConversation = useCallback(() => {
    cancel();
    messagesRef.current = [];
    setMessages([]);
    setConversationId(undefined);
    setActiveConversationTitle(undefined);
    if (conversationStorageKey)
      sessionStorage.removeItem(conversationStorageKey);
    setError(null);
    lastPromptRef.current = null;
  }, [cancel, conversationStorageKey]);

  const loadConversation = useCallback(
    async (nextConversationId: string) => {
      if (!token || !user) return;
      cancel();
      setError(null);
      const detail = await api.ai.getConversation(nextConversationId, token);
      const nextMessages: AICopilotMessage[] = detail.messages
        .filter(
          (
            message,
          ): message is typeof message & { role: "user" | "assistant" } =>
            message.role === "user" || message.role === "assistant",
        )
        .map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          status: "complete",
          createdAt: new Date(message.createdAt).getTime(),
          provider: message.metadata?.providerName
            ? {
                name: message.metadata.providerName,
                model: message.metadata.model,
              }
            : undefined,
          usage:
            typeof message.metadata?.creditEstimate === "number"
              ? {
                  creditEstimate: message.metadata.creditEstimate,
                  providerTokenEstimate:
                    message.metadata.providerTokenEstimate ?? 0,
                  sourceType: entitlement?.allowed
                    ? entitlement.source.sourceType
                    : AIUsageSourceType.PERSONAL,
                  remainingCreditsBeforeRequest: 0,
                }
              : undefined,
        }));
      messagesRef.current = nextMessages;
      setMessages(nextMessages);
      setConversationId(detail.id);
      setActiveConversationTitle(detail.title);
      setIsOpen(true);
    },
    [cancel, entitlement, token, user],
  );

  const renameConversation = useCallback(
    async (targetConversationId: string, title: string) => {
      if (!token || !user) return;
      const updated = await api.ai.updateConversationTitle(
        targetConversationId,
        title,
        token,
      );
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === targetConversationId ? updated : conversation,
        ),
      );
      if (conversationId === targetConversationId) {
        setActiveConversationTitle(updated.title);
      }
    },
    [conversationId, token, user],
  );

  const sendPrompt = useCallback(
    async (prompt: string, options?: { retryLastUserMessage?: boolean }) => {
      const trimmed = prompt.trim();
      if (!trimmed || !token || !user || isSending) return;
      if (entitlement && !entitlement.allowed) {
        setIsOpen(true);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setIsOpen(true);
      setIsSending(true);
      setError(null);
      lastPromptRef.current = trimmed;
      const userMessage: AICopilotMessage = {
        id: makeMessageId("user"),
        role: "user",
        content: trimmed,
        status: "complete",
        createdAt: Date.now(),
      };
      const pendingAssistantId = makeMessageId("assistant");
      const pendingAssistantMessage: AICopilotMessage = {
        id: pendingAssistantId,
        role: "assistant",
        content: "",
        status: "sending",
        statusLabel: "Thinking",
        createdAt: Date.now(),
      };
      const updatePendingStatus = (statusLabel: string) => {
        setMessages((current) => {
          const next = current.map((message) =>
            message.id === pendingAssistantId && !message.content.trim()
              ? { ...message, statusLabel }
              : message,
          );
          messagesRef.current = next;
          return next;
        });
      };

      setMessages((current) => {
        const next = [...current, userMessage, pendingAssistantMessage];
        messagesRef.current = next;
        return next;
      });

      let waitingTimer: number | undefined;

      try {
        waitingTimer = window.setTimeout(() => {
          updatePendingStatus("Checking records");
        }, 10000);
        await api.ai.streamChat(
          {
            prompt: trimmed,
            conversationId,
            retryLastUserMessage: options?.retryLastUserMessage,
          },
          token,
          {
            onEvent: (event) => {
              if (event.type === "status") {
                updatePendingStatus(event.label);
                return;
              }

              if (event.type === "conversation") {
                updatePendingStatus("Checking your workspace");
                setConversationId(event.conversationId);
                setActiveConversationTitle(event.title);
                return;
              }

              if (event.type === "delta") {
                if (waitingTimer) window.clearTimeout(waitingTimer);
                setMessages((current) => {
                  const next = current.map((message) =>
                    message.id === pendingAssistantId
                      ? {
                          ...message,
                          content: `${message.content}${event.content}`,
                          status: "streaming" as const,
                        }
                      : message,
                  );
                  messagesRef.current = next;
                  return next;
                });
                return;
              }

              if (event.type === "complete") {
                if (waitingTimer) window.clearTimeout(waitingTimer);
                const response = event.response;
                setConversationId(response.conversationId);
                setActiveConversationTitle(response.title);
                setMessages((current) => {
                  const next = current.map((message) =>
                    message.id === pendingAssistantId
                      ? {
                          ...message,
                          content: response.message.content,
                          status: "complete" as const,
                          provider: response.provider,
                          usage: response.usage,
                        }
                      : message,
                  );
                  messagesRef.current = next;
                  return next;
                });
                void refreshConversations();
              }
            },
          },
          controller.signal,
        );
        if (waitingTimer) window.clearTimeout(waitingTimer);
        void refreshEntitlement();
      } catch (err) {
        if (waitingTimer) window.clearTimeout(waitingTimer);
        if (controller.signal.aborted) {
          setMessages((current) => {
            const next = current.flatMap((message) => {
              if (message.id !== pendingAssistantId) return [message];
              return message.content.trim()
                ? [{ ...message, status: "complete" as const }]
                : [];
            });
            messagesRef.current = next;
            return next;
          });
          return;
        }
        const message =
          err instanceof Error
            ? err.message
            : "EduVerse Copilot could not answer right now.";
        setError(message);
        setMessages((current) => {
          const next = current.map((item) =>
            item.id === pendingAssistantId
              ? { ...item, content: message, status: "error" as const }
              : item,
          );
          messagesRef.current = next;
          return next;
        });
      } finally {
        if (waitingTimer) window.clearTimeout(waitingTimer);
        if (abortRef.current === controller) abortRef.current = null;
        setIsSending(false);
      }
    },
    [
      conversationId,
      entitlement,
      isSending,
      refreshConversations,
      refreshEntitlement,
      token,
      user,
    ],
  );

  const retryLast = useCallback(async () => {
    const prompt = lastPromptRef.current;
    if (!prompt) return;
    const nextMessages = messagesRef.current.filter(
      (message, index, allMessages) => {
        if (message.status === "error") return false;
        const next = allMessages[index + 1];
        return !(
          message.role === "user" &&
          message.content.trim() === prompt &&
          next?.status === "error"
        );
      },
    );
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    await sendPrompt(prompt, { retryLastUserMessage: true });
  }, [sendPrompt]);

  const deleteConversation = useCallback(
    async (targetConversationId: string) => {
      if (!token || !user) return;
      await api.ai.deleteConversation(targetConversationId, token);
      setConversations((current) =>
        current.filter((conversation) => conversation.id !== targetConversationId),
      );
      if (conversationId === targetConversationId) {
        resetConversation();
      }
    },
    [conversationId, resetConversation, token, user],
  );

  const value = useMemo<AICopilotContextValue>(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      messages,
      entitlement,
      entitlementLoading,
      isSending,
      error,
      conversationId,
      activeConversationTitle,
      conversations,
      conversationsLoading,
      suggestedQuestions,
      suggestedQuestionsLoading,
      isDocked,
      dockedWidth,
      dockHostAvailable,
      setIsDocked,
      setDockedWidth,
      sendPrompt,
      retryLast,
      cancel,
      resetConversation,
      refreshEntitlement,
      refreshConversations,
      loadConversation,
      renameConversation,
      deleteConversation,
    }),
    [
      activeConversationTitle,
      cancel,
      close,
      conversationId,
      conversations,
      conversationsLoading,
      deleteConversation,
      dockHostAvailable,
      dockedWidth,
      entitlement,
      entitlementLoading,
      error,
      isDocked,
      isOpen,
      isSending,
      loadConversation,
      messages,
      open,
      refreshConversations,
      refreshEntitlement,
      renameConversation,
      resetConversation,
      retryLast,
      sendPrompt,
      suggestedQuestions,
      suggestedQuestionsLoading,
      toggle,
    ],
  );

  const dockTarget =
    mounted && isDesktop && isDocked && dockHostAvailable
      ? document.getElementById("eduverse-ai-copilot-dock-host")
      : null;
  const portalTarget = dockTarget ?? (mounted ? document.body : null);

  return (
    <AICopilotContext.Provider value={value}>
      {children}
      {portalTarget &&
        user &&
        token &&
        createPortal(
          <>
            <AICopilotButton />
            <AICopilotPanel />
          </>,
          portalTarget,
        )}
    </AICopilotContext.Provider>
  );
}

export function useAICopilot() {
  const context = useContext(AICopilotContext);
  if (!context)
    throw new Error("useAICopilot must be used within AICopilotProvider");
  return context;
}

function makeMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
