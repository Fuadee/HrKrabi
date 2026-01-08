import type { SupabaseClient } from "@supabase/supabase-js";

export type UserRole = "team_lead" | "hr_prov";

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
): Promise<UserRole | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single<{ role: string }>();

  if (profileError || !profile || !isUserRole(profile.role)) {
    return null;
  }

  return profile.role;
}
