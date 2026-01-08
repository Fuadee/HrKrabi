"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getSession } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { fetchUserRole, getRoleDefaultRoute } from "@/lib/roleAccess";

const roleNoticeKey = "role_notice";

export default function IndexPage() {
  const router = useRouter();

  useEffect(() => {
    const redirect = async () => {
      const session = await getSession();
      if (session.isAuthenticated) {
        const supabase = getSupabaseBrowserClient();
        const role = await fetchUserRole(supabase);
        if (role) {
          router.replace(getRoleDefaultRoute(role));
          return;
        }
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(roleNoticeKey, "Role not assigned.");
        }
        router.replace("/my-profile");
      } else {
        router.replace("/login");
      }
    };

    redirect();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
      Redirecting...
    </div>
  );
}
