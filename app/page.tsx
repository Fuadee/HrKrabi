"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { getRoleDefaultRoute, isUserRole } from "@/lib/roleAccess";

const roleNoticeKey = "role_notice";

export default function IndexPage() {
  const router = useRouter();
  const { status, role } = useAuth();
  const redirectRef = useRef<{ target: string | null }>({ target: null });

  useEffect(() => {
    if (status === "loading") {
      return;
    }
    if (status === "authed") {
      if (isUserRole(role)) {
        const target = getRoleDefaultRoute(role);
        if (redirectRef.current.target !== target) {
          redirectRef.current.target = target;
          router.replace(target);
        }
        return;
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(roleNoticeKey, "Role not assigned.");
      }
      if (redirectRef.current.target !== "/my-profile") {
        redirectRef.current.target = "/my-profile";
        router.replace("/my-profile");
      }
      return;
    }
    if (redirectRef.current.target !== "/login") {
      redirectRef.current.target = "/login";
      router.replace("/login");
    }
  }, [role, router, status]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
      {status === "loading" ? "Loading..." : "Redirecting..."}
    </div>
  );
}
