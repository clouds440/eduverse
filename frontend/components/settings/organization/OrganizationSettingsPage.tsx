"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, RefreshCw, Save, Settings, TriangleAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useGlobal } from "@/context/GlobalContext";
import { useUserSettings } from "@/context/UserSettingsContext";
import { useUrlQueryState } from "@/hooks/useUrlQueryState";
import { useUnsavedSettingsWarning } from "@/hooks/useUnsavedSettingsWarning";
import { DocsLink } from "@/components/ui/DocsLink";
import { Button } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Loading";
import { Badge } from "@/components/ui/Badge";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { isSettingsTabKey } from "@/components/settings/settings-tabs";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { AccountPreferencesSettingsTab } from "@/components/settings/account/AccountPreferencesSettingsTab";
import type { NotificationSettingKey } from "@/components/settings/account/NotificationSettingsTab";
import { AppearanceSettingsTab } from "@/components/settings/organization/AppearanceSettingsTab";
import { BrandingSettingsTab } from "@/components/settings/organization/BrandingSettingsTab";
import { FinanceSettingsTab } from "@/components/settings/organization/FinanceSettingsTab";
import { ProfileSettingsTab } from "@/components/settings/organization/ProfileSettingsTab";
import { AdmissionsSettingsTab } from "@/components/settings/organization/AdmissionsSettingsTab";
import { AccountSecuritySettings } from "@/components/settings/account/AccountSecuritySettings";
import { GpaPoliciesSettingsTab } from "@/components/settings/organization/GpaPoliciesSettingsTab";
import { AISettingsTab } from "@/components/settings/organization/AISettingsTab";
import {
  getOrganizationSettingsTabs,
  type OrganizationSettingsTabKey,
} from "@/components/settings/organization/organization-settings-tabs";
import { useOrganizationSettingsForm } from "@/components/settings/organization/hooks/useOrganizationSettingsForm";
import { useOrganizationAISettings } from "@/components/settings/organization/hooks/useOrganizationAISettings";
import { OrgStatus, ThemeMode, type UserSettings } from "@/types";

const HASH_TAB_MAP: Record<string, OrganizationSettingsTabKey> = {
  "contact-email": "profile",
  "linked-accounts": "security",
  sessions: "security",
};

const USER_PREFERENCE_KEYS = [
  "themeMode",
  "loginNotificationEmail",
  "loginNotificationPush",
  "marketingEmails",
] as const satisfies readonly (keyof UserSettings)[];

function getChangedUserSettings(
  draft: UserSettings,
  saved: UserSettings,
  keys: readonly (keyof UserSettings)[],
) {
  const changes: Partial<UserSettings> = {};
  keys.forEach((key) => {
    if (draft[key] !== saved[key]) {
      changes[key] = draft[key] as never;
    }
  });
  return changes;
}

export function OrganizationSettingsPage() {
  const { token, user } = useAuth();
  const { dispatch } = useGlobal();
  const { getStringParam, updateQueryParams } = useUrlQueryState();
  const { settings: userSettings, loading: userSettingsLoading, update: updateUserSettings } = useUserSettings();
  const [draftUserSettings, setDraftUserSettings] = useState<UserSettings>(userSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const pendingHashScrollRef = useRef<string | null>(null);

  const settingsTabs = getOrganizationSettingsTabs(user?.role);
  const tabParam = getStringParam("tab", "profile") as OrganizationSettingsTabKey;
  const activeTab = isSettingsTabKey(settingsTabs, tabParam) ? tabParam : "profile";
  const handleTabChange = (tab: OrganizationSettingsTabKey) => {
    updateQueryParams({ tab: tab === "profile" ? undefined : tab });
  };

  const orgSettings = useOrganizationSettingsForm();
  const aiSettings = useOrganizationAISettings({
    active: activeTab === "ai",
    loading: orgSettings.loading,
    currency: orgSettings.formData.currency || orgSettings.orgData?.currency || "USD",
  });

  useEffect(() => {
    if (!userSettingsLoading) {
      setDraftUserSettings(userSettings);
    }
  }, [userSettings, userSettingsLoading]);

  const userPreferenceDirtyCount = useMemo(
    () => USER_PREFERENCE_KEYS.filter((key) => draftUserSettings[key] !== userSettings[key]).length,
    [draftUserSettings, userSettings],
  );
  const themeDirtyCount = draftUserSettings.themeMode !== userSettings.themeMode ? 1 : 0;
  const preferenceNotificationDirtyCount = Math.max(userPreferenceDirtyCount - themeDirtyCount, 0);
  const hasUnsavedChanges = orgSettings.dirtyCounts.total + userPreferenceDirtyCount > 0;
  const tabCounts = useMemo(() => {
    const counts: Partial<Record<OrganizationSettingsTabKey, number>> = {};
    if (orgSettings.dirtyCounts.profile) counts.profile = orgSettings.dirtyCounts.profile;
    const appearanceCount = orgSettings.dirtyCounts.appearance + themeDirtyCount;
    if (appearanceCount) counts.appearance = appearanceCount;
    if (orgSettings.dirtyCounts.finance) counts.finance = orgSettings.dirtyCounts.finance;
    if (orgSettings.dirtyCounts.admissions) counts.admissions = orgSettings.dirtyCounts.admissions;
    if (orgSettings.dirtyCounts.branding) counts.branding = orgSettings.dirtyCounts.branding;
    if (preferenceNotificationDirtyCount) counts.preferences = preferenceNotificationDirtyCount;
    return counts;
  }, [
    orgSettings.dirtyCounts.appearance,
    orgSettings.dirtyCounts.admissions,
    orgSettings.dirtyCounts.branding,
    orgSettings.dirtyCounts.finance,
    orgSettings.dirtyCounts.profile,
    preferenceNotificationDirtyCount,
    themeDirtyCount,
  ]);

  const unsavedChangesDialog = useUnsavedSettingsWarning(hasUnsavedChanges);

  useEffect(() => {
    if (typeof window === "undefined" || orgSettings.loading) return;
    const hash = window.location.hash.replace("#", "") || pendingHashScrollRef.current || "";
    const hashTab = HASH_TAB_MAP[hash];
    if (hashTab && activeTab !== hashTab) {
      pendingHashScrollRef.current = hash;
      updateQueryParams({ tab: hashTab === "profile" ? undefined : hashTab });
      return;
    }
    if (hashTab) {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      pendingHashScrollRef.current = null;
    }
  }, [activeTab, orgSettings.loading, updateQueryParams]);

  const handlePreferenceThemeChange = (mode: ThemeMode) => {
    orgSettings.setThemeMode(mode);
    orgSettings.setFormData((current) => ({
      ...current,
      accentColor: { ...current.accentColor, mode },
    }));
    setDraftUserSettings((current) => ({ ...current, themeMode: mode }));
  };

  const handleNotificationChange = (
    key: NotificationSettingKey,
    enabled: boolean,
  ) => {
    setDraftUserSettings((current) => ({ ...current, [key]: enabled }));
  };

  const handleOnlineAdmissionsToggle = (onlineAdmissionsEnabled: boolean) => {
    orgSettings.setFormData((current) => ({
      ...current,
      onlineAdmissionsEnabled,
    }));
  };

  const handleSaveSettings = async () => {
    if (!token || savingSettings || !hasUnsavedChanges) return;
    setSavingSettings(true);
    try {
      const savedOnlyUserPreferences = userPreferenceDirtyCount > 0 && orgSettings.dirtyCounts.total === 0;
      if (userPreferenceDirtyCount > 0) {
        const savedSettings = await updateUserSettings(
          getChangedUserSettings(draftUserSettings, userSettings, USER_PREFERENCE_KEYS),
        );
        setDraftUserSettings(savedSettings);
      }
      if (orgSettings.dirtyCounts.total > 0) {
        await orgSettings.saveSettings();
      }
      if (savedOnlyUserPreferences) {
        dispatch({
          type: "TOAST_ADD",
          payload: { message: "Settings updated successfully", type: "success" },
        });
      }
    } catch (error) {
      orgSettings.setThemeMode(userSettings.themeMode);
      const message = error instanceof Error ? error.message : "Failed to save settings";
      dispatch({ type: "TOAST_ADD", payload: { message, type: "error" } });
    } finally {
      setSavingSettings(false);
    }
  };

  if (orgSettings.loading || userSettingsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loading size="md" />
      </div>
    );
  }

  return (
    <>
    <SettingsShell
      title="Organization Settings"
      description={
        <>
          Identity, contact, appearance, and account security.{" "}
          <DocsLink href="/docs/settings#organization-settings">Read settings docs</DocsLink>
        </>
      }
      icon={Settings}
      actionsDefaultOpen
      headerClassName="mb-0.5"
      className="gap-0 overflow-x-hidden overflow-y-auto pb-8 custom-scrollbar"
      tabs={settingsTabs}
      tabCounts={tabCounts}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      ariaLabel="Settings navigation"
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {orgSettings.orgData?.status && (
            <Badge
              variant={
                orgSettings.orgData.status === OrgStatus.APPROVED
                  ? "success"
                  : orgSettings.orgData.status === OrgStatus.REJECTED
                    ? "error"
                    : "warning"
              }
              size="md"
              dot
            >
              {orgSettings.orgData.status.replace("_", " ")}
            </Badge>
          )}
          <Button
            type="button"
            onClick={handleSaveSettings}
            disabled={!hasUnsavedChanges || savingSettings}
            isLoading={savingSettings}
            className="h-10 px-4 text-xs sm:h-11 sm:px-5 sm:text-sm"
            icon={Save}
          >
            Save Settings
          </Button>
        </div>
      }
      beforeTabs={
        orgSettings.orgData?.status === OrgStatus.REJECTED ? (
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
                      orgSettings.orgData.statusHistory && orgSettings.orgData.statusHistory.length > 0
                        ? orgSettings.orgData.statusHistory[orgSettings.orgData.statusHistory.length - 1].message
                        : "Please correct the details below and re-submit for review."
                    }
                    className="mt-1 text-sm font-semibold text-danger/80"
                  />
                </div>
              </div>
              <Button
                onClick={orgSettings.handleReapply}
                disabled={orgSettings.reapplying}
                icon={RefreshCw}
                variant="danger"
                className="w-full shrink-0 lg:w-auto"
              >
                Re-submit for Review
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      <form
        id="organization-settings-form"
        onSubmit={orgSettings.handleSubmit}
        className="min-w-0"
        noValidate
      >
        <div className="min-w-0">
          {activeTab === "profile" && (
            <ProfileSettingsTab
              formData={orgSettings.formData}
              formErrors={orgSettings.formErrors}
              onChange={orgSettings.handleChange}
            />
          )}

          {activeTab === "appearance" && (
            <AppearanceSettingsTab
              formData={orgSettings.formData}
              setFormData={orgSettings.setFormData}
              currentThemeMode={draftUserSettings.themeMode}
              onPrimaryColorChange={orgSettings.handlePrimaryColorChange}
              onThemeModeChange={handlePreferenceThemeChange}
            />
          )}

          {activeTab === "finance" && (
            <FinanceSettingsTab
              formData={orgSettings.formData}
              setFormData={orgSettings.setFormData}
              formErrors={orgSettings.formErrors}
              setFormErrors={orgSettings.setFormErrors}
            />
          )}

          {activeTab === "admissions" && (
            <AdmissionsSettingsTab
              formData={orgSettings.formData}
              onToggleOnlineAdmissions={handleOnlineAdmissionsToggle}
              setFormData={orgSettings.setFormData}
            />
          )}

          {activeTab === "preferences" && (
            <AccountPreferencesSettingsTab
              settings={draftUserSettings}
              onNotificationChange={handleNotificationChange}
            />
          )}

          {activeTab === "ai" && (
            <AISettingsTab
              aiLoading={aiSettings.aiLoading}
              aiSettings={aiSettings.aiSettings}
              activeAIPlan={aiSettings.activeAIPlan}
              activeAIPlanOption={aiSettings.activeAIPlanOption}
              aiRoleCreditDrafts={aiSettings.aiRoleCreditDrafts}
              setAiRoleCreditDrafts={aiSettings.setAiRoleCreditDrafts}
              onAccessToggle={aiSettings.handleAIAccessToggle}
              onRoleCreditSave={aiSettings.handleAIRoleCreditSave}
              onRefresh={aiSettings.fetchAISettings}
            />
          )}

          {activeTab === "branding" && (
            <BrandingSettingsTab
              organization={orgSettings.orgData}
              pendingLogoFile={orgSettings.pendingLogoFile}
              onLogoReady={orgSettings.handleLogoReady}
            />
          )}

          {activeTab === "security" && (
            <AccountSecuritySettings changePasswordHref="/change-password" />
          )}
        </div>

        {orgSettings.formErrors.general && (
          <div className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm font-semibold text-danger">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{orgSettings.formErrors.general}</span>
          </div>
        )}
      </form>

      {activeTab === "gpa-policies" && <GpaPoliciesSettingsTab />}
    </SettingsShell>
    {unsavedChangesDialog}
    </>
  );
}
