"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getSession } from "@/lib/auth";

export default function IndexPage() {
  const router = useRouter();

  useEffect(() => {
    const redirect = async () => {
      const session = await getSession();
      if (session.isAuthenticated) {
        router.replace("/team-dashboard");
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
