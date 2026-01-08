"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export type ProfileRole = string | null;

type ProfileRoleRow = {
  role: string | null;
};

export async function getProfileRole(
  userId?: string | null,
): Promise<ProfileRole> {
  const supabase = getSupabaseBrowserClient();
  let resolvedUserId = userId ?? null;

  if (!resolvedUserId) {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return null;
    }
    resolvedUserId = data.user.id;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", resolvedUserId)
    .single<ProfileRoleRow>();

  if (profileError || !profile) {
    return null;
  }

  return profile.role ?? null;
}

export function getDefaultRouteForRole(role?: string | null): string {
  if (role === "hr_prov") {
    return "/hr/dashboard";
  }

  if (role === "team_lead") {
    return "/team-dashboard";
  }

  return "/my-profile";
}
