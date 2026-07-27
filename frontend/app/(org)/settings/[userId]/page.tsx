"use client";

import { useParams } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Role } from "@/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { AccountSettingsShell } from "@/components/settings/account/AccountSettingsShell";
import { AdminProfileSettingsTab } from "@/components/settings/account/AdminProfileSettingsTab";
import { UserAccountProfileSettingsTab } from "@/components/settings/account/UserAccountProfileSettingsTab";
import { OrganizationSettingsPage } from "@/components/settings/organization/OrganizationSettingsPage";

function getAccountChangePasswordHref(role?: Role | null) {
  return role === Role.SUPER_ADMIN || role === Role.PLATFORM_ADMIN
    ? "/admin/change-password"
    : "/change-password";
}

export default function UniversalSettingsPage() {
  const { user } = useAuth();
  const params = useParams();
  const routeUserId = params.userId as string | undefined;

  if (user && routeUserId !== user.id) {
    return (
      <PageShell className="gap-3 overflow-y-auto pb-8 custom-scrollbar">
        <PageHeader
          title="Settings Unavailable"
          description="You can only manage settings for your own account."
          icon={ShieldOff}
        />
        <EmptyState
          icon={ShieldOff}
          title="No access to these settings"
          description="Open your own settings page from the sidebar."
        />
      </PageShell>
    );
  }

  if (!user) return null;

  if (user.role === Role.ORG_ADMIN) {
    return <OrganizationSettingsPage />;
  }

  return (
    <AccountSettingsShell
      title="Account Settings"
      description="Profile, preferences, sign-in methods, and account security."
      changePasswordHref={getAccountChangePasswordHref(user.role)}
      profileContent={
        user.role === Role.SUPER_ADMIN || user.role === Role.PLATFORM_ADMIN
          ? <AdminProfileSettingsTab />
          : <UserAccountProfileSettingsTab />
      }
      adminOnly={user.role === Role.SUPER_ADMIN || user.role === Role.PLATFORM_ADMIN}
    />
  );
}
