"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loading } from "@/components/ui/Loading";
import { useAuth } from "@/context/AuthContext";
import { settingsPath } from "@/lib/routes";

export default function SettingsIndexPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (loading) return;
        if (user?.id) {
            const query = searchParams.toString();
            const path = settingsPath(user.id);
            router.replace(query ? `${path}?${query}` : path);
        } else {
            router.replace("/login");
        }
    }, [loading, router, searchParams, user?.id]);

    return <Loading size="xl" fullScreen={true} />;
}
