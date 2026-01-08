"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import {
  fetchUserRole,
  getRoleDefaultRoute,
  isPathAllowedForRole,
  type UserRole,
} from "@/lib/roleAccess";

type RoleContextValue = {
  role: UserRole | null;
  loading: boolean;
};

const RoleContext = createContext<RoleContextValue>({
  role: null,
  loading: true,
});

const ROLE_NOTICE_KEY = "role_notice";

function setRoleNotice(message: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(ROLE_NOTICE_KEY, message);
}

export function useRole() {
  return useContext(RoleContext);
}

export default function RoleGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadRole = async () => {
      const supabase = getSupabaseBrowserClient();
      const profileRole = await fetchUserRole(supabase);
      if (!isMounted) {
        return;
      }
      setRole(profileRole);
      setLoading(false);
    };

    loadRole();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!role) {
      if (pathname !== "/my-profile" && pathname !== "/me") {
        setRoleNotice("Role not assigned.");
        router.replace("/my-profile");
      }
      return;
    }

    if (!isPathAllowedForRole(role, pathname)) {
      const redirectTarget = getRoleDefaultRoute(role);
      if (redirectTarget !== pathname) {
        setRoleNotice("Access restricted to your role.");
        router.replace(redirectTarget);
      }
    }
  }, [loading, pathname, role, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading...
      </div>
    );
  }

  return (
    <RoleContext.Provider value={{ role, loading: false }}>
      {children}
    </RoleContext.Provider>
  );
}
