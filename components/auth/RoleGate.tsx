"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import {
  getRoleDefaultRoute,
  isPathAllowedForRole,
} from "@/lib/roleAccess";

const ROLE_NOTICE_KEY = "role_notice";

function setRoleNotice(message: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(ROLE_NOTICE_KEY, message);
}

export default function RoleGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { role, status } = useAuth();

  useEffect(() => {
    if (status !== "authed") {
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
  }, [pathname, role, router, status]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading...
      </div>
    );
  }

  if (status === "unauthed") {
    return null;
  }

  return <>{children}</>;
}
