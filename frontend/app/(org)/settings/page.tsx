"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  RefreshCw,
  Save,
  Settings,
  TriangleAlert,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  AIOrgSettingsResponse,
  AIOrgUsageResponse,
  AISubscriptionOwnerType,
  AISubscriptionPlan,
  LinkedAccount,
  Organization,
  Role,
  ThemeMode,
} from "@/types";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { useGlobal } from "@/context/GlobalContext";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/context/ThemeContext";
import { Loading } from "@/components/ui/Loading";
import { getSafePrimaryColor } from "@/lib/themeColor";
import { Badge } from "@/components/ui/Badge";
import { PageHeader, PageShell, PageTabs } from "@/components/ui/PageShell";
import { DocsLink } from "@/components/ui/DocsLink";
import { useUrlQueryState } from "@/hooks/useUrlQueryState";
import { isSettingsTabKey } from "@/components/settings/settings-tabs";
import { AppearanceSettingsTab } from "@/components/settings/organization/AppearanceSettingsTab";
import { BrandingSettingsTab } from "@/components/settings/organization/BrandingSettingsTab";
import { FinanceSettingsTab } from "@/components/settings/organization/FinanceSettingsTab";
import { ProfileSettingsTab } from "@/components/settings/organization/ProfileSettingsTab";
import { SecuritySettingsTab } from "@/components/settings/organization/SecuritySettingsTab";
import type {
  OrganizationSettingsFormData,
  OrganizationSettingsFormErrors,
} from "@/components/settings/organization/types";
import {
  getOrganizationSettingsTabs,
  type OrganizationSettingsTabKey as SettingsTabKey,
} from "@/components/settings/organization/organization-settings-tabs";
import { GpaPoliciesSettingsTab } from "@/components/settings/organization/GpaPoliciesSettingsTab";
import { AISettingsTab } from "@/components/settings/organization/AISettingsTab";

type AIOrgAccessField =
  | "allowSubAdmins"
  | "allowManagers"
  | "allowFinanceManagers"
  | "allowTeachers"
  | "allowStudents"
  | "allowGuardians";

const HASH_TAB_MAP: Record<string, SettingsTabKey> = {
  "contact-email": "profile",
  "linked-accounts": "security",
  sessions: "security",
};

function getAIUsagePercent(used: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

export default function SettingsPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getStringParam, updateQueryParams } = useUrlQueryState();
  const { dispatch } = useGlobal();
  const { setPrimaryColor, setThemeMode, themeMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [reapplying, setReapplying] = useState(false);
  const [orgData, setOrgData] = useState<Organization | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [linkedAccountsLoading, setLinkedAccountsLoading] = useState(false);
  const [aiSettings, setAiSettings] = useState<AIOrgSettingsResponse | null>(
    null,
  );
  const [aiUsage, setAiUsage] = useState<AIOrgUsageResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRoleCreditDrafts, setAiRoleCreditDrafts] = useState<
    Partial<Record<Role, string>>
  >({});
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [redirecting, setRedirecting] = useState(
    user?.role === Role.ORG_ADMIN ? false : true,
  );
  const [formErrors, setFormErrors] = useState<OrganizationSettingsFormErrors>(
    {},
  );
  const pendingHashScrollRef = useRef<string | null>(null);

  const [formData, setFormData] = useState<OrganizationSettingsFormData>({
    name: "",
    location: "",
    contactEmail: "",
    phone: "",
    currency: "USD",
    accentColor: {
      primary: "#4f46e5",
      mode: ThemeMode.SYSTEM,
    },
  });
  const googleAccount = linkedAccounts.find(
    (account) => account.provider === "google",
  );
  const settingsTabs = getOrganizationSettingsTabs(user?.role);
  const tabParam = getStringParam("tab", "profile") as SettingsTabKey;
  const activeTab = isSettingsTabKey(settingsTabs, tabParam)
    ? tabParam
    : "profile";

  const handleTabChange = (tab: SettingsTabKey) => {
    updateQueryParams({ tab: tab === "profile" ? undefined : tab });
  };

  const fetchLinkedAccounts = useCallback(async () => {
    if (!token) return;
    setLinkedAccountsLoading(true);
    try {
      const accounts = await api.auth.getLinkedAccounts(token);
      setLinkedAccounts(accounts);
    } catch (error) {
      console.error("Failed to load linked accounts", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load linked accounts";
      dispatch({ type: "TOAST_ADD", payload: { message, type: "error" } });
    } finally {
      setLinkedAccountsLoading(false);
    }
  }, [dispatch, token]);

  const fetchAISettings = useCallback(async () => {
    if (!token) return;
    setAiLoading(true);
    try {
      const settings = await api.ai.getOrgSettings(token);
      setAiSettings(settings);
      setAiRoleCreditDrafts(
        Object.fromEntries(
          settings.roleCreditPolicies.map((policy) => [
            policy.role,
            String(policy.monthlyCredits),
          ]),
        ) as Partial<Record<Role, string>>,
      );
    } catch (error) {
      console.error("Failed to load EduVerse Copilot settings", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load EduVerse Copilot settings";
      dispatch({ type: "TOAST_ADD", payload: { message, type: "error" } });
    } finally {
      setAiLoading(false);
    }
  }, [dispatch, token]);

  useEffect(() => {
    if (typeof window === "undefined" || redirecting || loading) return;
    const hash =
      window.location.hash.replace("#", "") ||
      pendingHashScrollRef.current ||
      "";
    const hashTab = HASH_TAB_MAP[hash];
    if (hashTab && activeTab !== hashTab) {
      pendingHashScrollRef.current = hash;
      updateQueryParams({ tab: hashTab === "profile" ? undefined : hashTab });
      return;
    }

    if (hashTab) {
      const element = document.getElementById(hash);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        pendingHashScrollRef.current = null;
      }
    }
  }, [activeTab, redirecting, loading, updateQueryParams]);

  useEffect(() => {
    const linkStatus = searchParams.get("googleLink");
    if (!linkStatus) return;

    if (linkStatus === "success") {
      dispatch({
        type: "TOAST_ADD",
        payload: {
          message: "Google account linked successfully.",
          type: "success",
        },
      });
      updateQueryParams({ tab: "security", googleLink: undefined });
      void fetchLinkedAccounts();
    }
  }, [dispatch, fetchLinkedAccounts, searchParams, updateQueryParams]);

  useEffect(() => {
    if (!token || !user) return;

    const hash = typeof window !== "undefined" ? window.location.hash : "";

    if (user.role === Role.SUPER_ADMIN || user.role === Role.PLATFORM_ADMIN) {
      router.push(`/admin/settings${hash}`);
      return;
    }
    if (user.role === Role.ORG_MANAGER || user.role === Role.TEACHER) {
      router.push(`/teacher/${user.id}/profile${hash}`);
      return;
    }
    if (user.role === Role.SUB_ADMIN) {
      router.push(`/sub-admin/${user.id}/profile${hash}`);
      return;
    }
    if (user.role === Role.FINANCE_MANAGER) {
      router.push(`/finance-manager/${user.id}/profile${hash}`);
      return;
    }
    if (user.role === Role.STUDENT) {
      router.push(`/student/${user.id}?tab=profile${hash}`);
      return;
    }

    if (user.role !== Role.ORG_ADMIN) return;

    setLoading(true);
    api.org
      .getOrgData(token)
      .then(async (data: Organization) => {
        const userSettings = await api.auth.getSettings(token);
        setOrgData(data);
        setFormData({
          name: data.name || "",
          location: data.location || "",
          contactEmail: data.contactEmail || "",
          phone: data.phone || "",
          currency: data.currency || "USD",
          accentColor: {
            primary: getSafePrimaryColor(
              data.accentColor?.primary || "#4f46e5",
            ),
            mode: userSettings.themeMode,
          },
        });
        void fetchLinkedAccounts();
      })
      .catch((err) => {
        console.error("Failed to load settings", err);
        const message =
          err instanceof Error ? err.message : "Failed to load settings";
        dispatch({ type: "TOAST_ADD", payload: { message, type: "error" } });
      })
      .finally(() => {
        setLoading(false);
        setRedirecting(false);
      });
  }, [token, dispatch, user, router, fetchLinkedAccounts]);

  useEffect(() => {
    if (!redirecting && formData.accentColor.primary) {
      setPrimaryColor(formData.accentColor.primary);
    }
  }, [formData.accentColor.primary, setPrimaryColor, redirecting]);

  useEffect(() => {
    if (activeTab !== "ai" || redirecting || loading || aiSettings) return;
    void fetchAISettings();
  }, [activeTab, aiSettings, fetchAISettings, loading, redirecting]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleLogoReady = useCallback((file: File) => {
    setPendingLogoFile(file);
  }, []);

  const handlePrimaryColorChange = (newPrimary: string) => {
    setFormErrors((current) => ({ ...current, accentColor: undefined }));
    setFormData((current) => ({
      ...current,
      accentColor: {
        ...current.accentColor,
        primary: getSafePrimaryColor(newPrimary),
      },
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setFormErrors({});

    let hasError = false;
    const newErrors: typeof formErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Organization name is required";
      hasError = true;
    }
    if (!formData.location.trim()) {
      newErrors.location = "Location is required";
      hasError = true;
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
      hasError = true;
    }
    if (!formData.contactEmail.trim()) {
      newErrors.contactEmail = "Contact email is required";
      hasError = true;
    }

    if (hasError) {
      setFormErrors(newErrors);
      return;
    }

    dispatch({ type: "UI_START_PROCESSING", payload: "settings-submit" });
    try {
      const payload = {
        ...formData,
        accentColor: {
          primary: getSafePrimaryColor(formData.accentColor.primary),
        },
      };

      const updatedSettings = (await api.org.updateSettings(
        payload,
        token,
      )) as Organization;
      setOrgData((current) =>
        current ? { ...current, ...updatedSettings } : updatedSettings,
      );
      dispatch({ type: "STATS_SET_ORG_DATA", payload: updatedSettings });

      try {
        await api.auth.updateSettings(
          { themeMode: formData.accentColor.mode },
          token,
        );
      } catch (error) {
        console.warn("Failed to save user themeMode", error);
      }

      if (pendingLogoFile) {
        const logoRes = await api.org.uploadLogo(pendingLogoFile, token);
        setOrgData((current) =>
          current
            ? {
                ...current,
                logoUrl: logoRes.logoUrl,
                avatarUpdatedAt: logoRes.avatarUpdatedAt,
              }
            : current,
        );
        setPendingLogoFile(null);
      }

      dispatch({
        type: "TOAST_ADD",
        payload: { message: "Settings updated successfully!", type: "success" },
      });
      if (updatedSettings.contactEmailVerifiedAt === null) {
        dispatch({
          type: "TOAST_ADD",
          payload: {
            message:
              "Contact email changed. A new verification code has been sent.",
            type: "info",
          },
        });
      }
    } catch (error: unknown) {
      const errorWithResponse = error as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const message =
        errorWithResponse.response?.data?.message ||
        errorWithResponse.message ||
        "Failed to update settings. Please try again.";
      const nextErrors: typeof formErrors = {};

      if (Array.isArray(message)) {
        message.forEach((item: string) => {
          const msg = item.toLowerCase();
          if (msg.includes("name")) nextErrors.name = item;
          else if (msg.includes("location")) nextErrors.location = item;
          else if (msg.includes("email")) nextErrors.contactEmail = item;
          else if (msg.includes("phone")) nextErrors.phone = item;
          else if (msg.includes("currency")) nextErrors.currency = item;
          else nextErrors.general = item;
        });
      } else {
        const msg = message.toLowerCase();
        if (msg.includes("name")) nextErrors.name = message;
        else if (msg.includes("location")) nextErrors.location = message;
        else if (msg.includes("email")) nextErrors.contactEmail = message;
        else if (msg.includes("phone")) nextErrors.phone = message;
        else if (msg.includes("currency")) nextErrors.currency = message;
        else nextErrors.general = message;
      }
      setFormErrors(nextErrors);
      console.error("Failed to update settings", error);
    } finally {
      dispatch({ type: "UI_STOP_PROCESSING", payload: "settings-submit" });
    }
  };

  const handleReapply = async () => {
    if (!token) return;
    setReapplying(true);
    try {
      await api.org.reapply(token);
      dispatch({
        type: "TOAST_ADD",
        payload: {
          message: "Your re-application has been submitted!",
          type: "success",
        },
      });
      const data = await api.org.getOrgData(token);
      setOrgData(data);
    } catch (error) {
      dispatch({
        type: "TOAST_ADD",
        payload: { message: "Failed to re-apply", type: "error" },
      });
      console.error("Failed to re-apply", error);
    } finally {
      setReapplying(false);
    }
  };

  const handleStartGoogleLink = () => {
    window.location.href = api.auth.getGoogleLinkUrl();
  };

  const handleUnlinkGoogle = async () => {
    if (!token) return;
    dispatch({ type: "UI_START_PROCESSING", payload: "unlink-google" });
    try {
      await api.auth.unlinkGoogle(token);
      dispatch({
        type: "TOAST_ADD",
        payload: {
          message: "Google account unlinked successfully.",
          type: "success",
        },
      });
      await fetchLinkedAccounts();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to unlink Google account";
      dispatch({ type: "TOAST_ADD", payload: { message, type: "error" } });
    } finally {
      dispatch({ type: "UI_STOP_PROCESSING", payload: "unlink-google" });
    }
  };

  const refreshAIUsage = async () => {
    if (!token) return;
    const usage = await api.ai.getOrgUsage(token);
    setAiUsage(usage);
  };

  const handleAIPlanChange = async (plan: AISubscriptionPlan) => {
    if (!token) return;
    dispatch({ type: "UI_START_PROCESSING", payload: "ai-plan-update" });
    try {
      if (plan !== AISubscriptionPlan.NONE) {
        const checkout = await api.ai.createOrgBillingCheckout(plan, token);
        if (checkout.checkoutUrl) {
          window.location.assign(checkout.checkoutUrl);
          return;
        }
        throw new Error(
          "Lemon Squeezy checkout did not return a redirect URL.",
        );
      }

      const settings = await api.ai.updateOrgSubscription(plan, token);
      setAiSettings(settings);
      setAiRoleCreditDrafts(
        Object.fromEntries(
          settings.roleCreditPolicies.map((policy) => [
            policy.role,
            String(policy.monthlyCredits),
          ]),
        ) as Partial<Record<Role, string>>,
      );
      await refreshAIUsage();
      dispatch({
        type: "TOAST_ADD",
        payload: {
          message: "EduVerse Copilot subscription updated.",
          type: "success",
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update EduVerse Copilot subscription";
      dispatch({ type: "TOAST_ADD", payload: { message, type: "error" } });
    } finally {
      dispatch({ type: "UI_STOP_PROCESSING", payload: "ai-plan-update" });
    }
  };

  const handleAIBillingPortal = async () => {
    if (!token) return;
    dispatch({ type: "UI_START_PROCESSING", payload: "ai-billing-portal" });
    try {
      const portal = await api.ai.createBillingPortal(
        AISubscriptionOwnerType.ORGANIZATION,
        token,
        "/settings?tab=ai",
      );
      window.location.assign(portal.portalUrl);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to open AI billing portal";
      dispatch({ type: "TOAST_ADD", payload: { message, type: "error" } });
    } finally {
      dispatch({ type: "UI_STOP_PROCESSING", payload: "ai-billing-portal" });
    }
  };

  const handleAIAccessToggle = async (
    field: AIOrgAccessField,
    enabled: boolean,
  ) => {
    if (!token) return;
    dispatch({ type: "UI_START_PROCESSING", payload: `ai-access-${field}` });
    try {
      const settings = await api.ai.updateOrgAccessPolicy(
        { [field]: enabled } as Partial<AIOrgSettingsResponse["accessPolicy"]>,
        token,
      );
      setAiSettings(settings);
      dispatch({
        type: "TOAST_ADD",
        payload: {
          message: "EduVerse Copilot role access updated.",
          type: "success",
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update EduVerse Copilot role access";
      dispatch({ type: "TOAST_ADD", payload: { message, type: "error" } });
    } finally {
      dispatch({ type: "UI_STOP_PROCESSING", payload: `ai-access-${field}` });
    }
  };

  const handleAIRoleCreditSave = async (role: Role) => {
    if (!token) return;
    const draftValue = aiRoleCreditDrafts[role] ?? "0";
    const monthlyCredits = Math.max(0, Math.round(Number(draftValue) || 0));
    dispatch({
      type: "UI_START_PROCESSING",
      payload: `ai-role-credit-${role}`,
    });
    try {
      const settings = await api.ai.updateRoleCreditPolicy(
        role,
        monthlyCredits,
        token,
      );
      setAiSettings(settings);
      setAiRoleCreditDrafts(
        Object.fromEntries(
          settings.roleCreditPolicies.map((policy) => [
            policy.role,
            String(policy.monthlyCredits),
          ]),
        ) as Partial<Record<Role, string>>,
      );
      await refreshAIUsage();
      dispatch({
        type: "TOAST_ADD",
        payload: { message: "Monthly AI Credits updated.", type: "success" },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update monthly AI Credits";
      dispatch({ type: "TOAST_ADD", payload: { message, type: "error" } });
    } finally {
      dispatch({
        type: "UI_STOP_PROCESSING",
        payload: `ai-role-credit-${role}`,
      });
    }
  };

  const aiBalance = aiUsage?.usage ?? aiSettings?.usage ?? null;
  const activeAIPlan = aiSettings?.subscription.plan ?? AISubscriptionPlan.NONE;
  const activeAIPlanOption = aiSettings?.plans.find(
    (plan) => plan.plan === activeAIPlan,
  );
  const aiUsagePercent = aiBalance
    ? getAIUsagePercent(aiBalance.usedCredits, aiBalance.monthlyCredits)
    : 0;
  const maxAITrendCredits = Math.max(
    1,
    ...(aiUsage?.trends ?? []).map((point) => point.creditsUsed),
  );
  const aiCurrency = formData.currency || orgData?.currency || "USD";

  if (loading || redirecting) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loading size="md" />
      </div>
    );
  }

  return (
    <PageShell className="gap-0 overflow-x-hidden overflow-y-auto pb-8 custom-scrollbar">
      <PageHeader
        title="Organization Settings"
        description={
          <>
            Identity, contact, appearance, and account security.{" "}
            <DocsLink href="/docs/settings#organization-settings">
              Read settings docs
            </DocsLink>
          </>
        }
        icon={Settings}
        actionsDefaultOpen
        className="mb-0.5"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {orgData?.status && (
              <Badge
                variant={
                  orgData.status === "APPROVED"
                    ? "success"
                    : orgData.status === "REJECTED"
                      ? "error"
                      : "warning"
                }
                size="md"
                dot
              >
                {orgData.status.replace("_", " ")}
              </Badge>
            )}
            {activeTab !== "ai" && activeTab !== "gpa-policies" && (
              <Button
                type="submit"
                form="organization-settings-form"
                loadingId="settings-submit"
                className="h-10 px-4 text-xs sm:h-11 sm:px-5 sm:text-sm"
                icon={Save}
              >
                Save Settings
              </Button>
            )}
          </div>
        }
      />

      {orgData?.status === "REJECTED" && (
        <div className="mb-0.5 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-danger sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/10">
                <TriangleAlert className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-black">Application rejected</h2>
                <MarkdownRenderer
                  content={
                    orgData?.statusHistory && orgData.statusHistory.length > 0
                      ? orgData.statusHistory[orgData.statusHistory.length - 1]
                          .message
                      : "Please correct the details below and re-submit for review."
                  }
                  className="mt-1 text-sm font-semibold text-danger/80"
                />
              </div>
            </div>
            <Button
              onClick={handleReapply}
              disabled={reapplying}
              icon={RefreshCw}
              variant="danger"
              className="w-full shrink-0 lg:w-auto"
            >
              Re-submit for Review
            </Button>
          </div>
        </div>
      )}
      <PageTabs
        ariaLabel="Settings navigation"
        items={settingsTabs.map(({ key, label, icon }) => ({
          value: key,
          label,
          icon,
        }))}
        activeValue={activeTab}
        onValueChange={handleTabChange}
        hideOnScroll
      />

      <form
        id="organization-settings-form"
        onSubmit={handleSubmit}
        className="min-w-0"
        noValidate
      >
        <div className="min-w-0">
          {activeTab === "profile" && (
            <ProfileSettingsTab
              formData={formData}
              formErrors={formErrors}
              onChange={handleChange}
            />
          )}

          {activeTab === "appearance" && (
            <AppearanceSettingsTab
              formData={formData}
              setFormData={setFormData}
              currentThemeMode={themeMode}
              onPrimaryColorChange={handlePrimaryColorChange}
              onThemeModeChange={setThemeMode}
            />
          )}

          {activeTab === "finance" && (
            <FinanceSettingsTab
              formData={formData}
              setFormData={setFormData}
              formErrors={formErrors}
              setFormErrors={setFormErrors}
            />
          )}

          {activeTab === "ai" && (
            <AISettingsTab
              aiLoading={aiLoading}
              aiSettings={aiSettings}
              activeAIPlan={activeAIPlan}
              activeAIPlanOption={activeAIPlanOption}
              aiBalance={aiBalance}
              aiUsagePercent={aiUsagePercent}
              aiRoleCreditDrafts={aiRoleCreditDrafts}
              setAiRoleCreditDrafts={setAiRoleCreditDrafts}
              aiUsage={aiUsage}
              aiCurrency={aiCurrency}
              maxAITrendCredits={maxAITrendCredits}
              onPlanChange={handleAIPlanChange}
              onBillingPortal={handleAIBillingPortal}
              onAccessToggle={handleAIAccessToggle}
              onRoleCreditSave={handleAIRoleCreditSave}
              onRefresh={fetchAISettings}
            />
          )}
          {activeTab === "branding" && (
            <BrandingSettingsTab
              organization={orgData}
              pendingLogoFile={pendingLogoFile}
              onLogoReady={handleLogoReady}
            />
          )}

          {activeTab === "security" && (
            <SecuritySettingsTab
              organization={orgData}
              contactEmail={formData.contactEmail}
              googleAccount={googleAccount}
              linkedAccountsLoading={linkedAccountsLoading}
              onStartGoogleLink={handleStartGoogleLink}
              onUnlinkGoogle={handleUnlinkGoogle}
            />
          )}
        </div>

        {formErrors.general && (
          <div className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm font-semibold text-danger">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{formErrors.general}</span>
          </div>
        )}
      </form>

      {activeTab === "gpa-policies" && <GpaPoliciesSettingsTab />}
    </PageShell>
  );
}
