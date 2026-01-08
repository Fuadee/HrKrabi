import type { SupabaseClient } from "@supabase/supabase-js";

export type UserRole = "team_lead" | "hr_prov";

export type RoleFetchResult = {
  role: UserRole | null;
  error: Error | null;
};

export const ROLE_DEFAULT_ROUTE: Record<UserRole, string> = {
  team_lead: "/team-dashboard",
  hr_prov: "/hr/dashboard",
};

export const ROLE_ALLOWED_PATH_PREFIXES: Record<UserRole, string[]> = {
  team_lead: [
    "/team-dashboard",
    "/report-absence",
    "/team-cases",
    "/team/",
    "/me",
    "/my-profile",
    "/dev-health",
    "/dev/",
  ],
  hr_prov: ["/hr/dashboard", "/hr/", "/me", "/my-profile"],
};

export function isUserRole(role: string | null | undefined): role is UserRole {
  return role === "team_lead" || role === "hr_prov";
}

export function getRoleDefaultRoute(role: UserRole | null | undefined): string {
  if (role && ROLE_DEFAULT_ROUTE[role]) {
    return ROLE_DEFAULT_ROUTE[role];
  }
  return "/my-profile";
}

export function isPathAllowedForRole(role: UserRole, pathname: string): boolean {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return ROLE_ALLOWED_PATH_PREFIXES[role].some((prefix) =>
    normalized.startsWith(prefix),
  );
}

export async function fetchUserRole(
  supabase: SupabaseClient,
  userId?: string,
): Promise<RoleFetchResult> {
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      return { role: null, error: new Error(userError.message) };
    }
    if (!userData.user) {
      return { role: null, error: null };
    }
    resolvedUserId = userData.user.id;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", resolvedUserId)
    .single<{ role: string }>();

  if (profileError) {
    return { role: null, error: new Error(profileError.message) };
  }

  if (!profile || !isUserRole(profile.role)) {
    return { role: null, error: null };
  }

  return { role: profile.role, error: null };
}
