"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getSession } from "@/lib/auth";
import { getDefaultRouteForRole, getProfileRole } from "@/lib/roleRedirect";

export default function IndexPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const redirect = async () => {
      const session = await getSession();
      if (session.isAuthenticated) {
        const role = await getProfileRole();
        const target = getDefaultRouteForRole(role);
        router.replace(target);
        return;
      }

      router.replace("/login");

      if (isMounted) {
        setCheckingSession(false);
      }
    };

    redirect();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
      {checkingSession ? "Checking session..." : "Redirecting..."}
    </div>
  );
}
