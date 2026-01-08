"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import {
  getRoleDefaultRoute,
  isPathAllowedForRole,
  isUserRole,
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
  const redirectRef = useRef<{ target: string | null }>({ target: null });

  useEffect(() => {
    redirectRef.current.target = null;
  }, [pathname]);

  useEffect(() => {
    if (status !== "authed") {
      return;
    }

    if (!role || role === "unknown") {
      if (pathname !== "/my-profile" && pathname !== "/me") {
        setRoleNotice("Role not assigned.");
        if (redirectRef.current.target !== "/my-profile") {
          redirectRef.current.target = "/my-profile";
          router.replace("/my-profile");
        }
      }
      return;
    }

    if (!isUserRole(role)) {
      return;
    }

    if (!isPathAllowedForRole(role, pathname)) {
      const redirectTarget = getRoleDefaultRoute(role);
      if (
        redirectTarget !== pathname &&
        redirectRef.current.target !== redirectTarget
      ) {
        setRoleNotice("Access restricted to your role.");
        redirectRef.current.target = redirectTarget;
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
