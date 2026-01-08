"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { getRoleDefaultRoute } from "@/lib/roleAccess";

const roleNoticeKey = "role_notice";

export default function IndexPage() {
  const router = useRouter();
  const { status, role } = useAuth();

  useEffect(() => {
    if (status === "loading") {
      return;
    }
    if (status === "authed") {
      if (role) {
        router.replace(getRoleDefaultRoute(role));
        return;
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(roleNoticeKey, "Role not assigned.");
      }
      router.replace("/my-profile");
      return;
    }
    router.replace("/login");
  }, [role, router, status]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
      {status === "loading" ? "Loading..." : "Redirecting..."}
    </div>
  );
}
