"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { getSession } from "@/lib/auth";

type ProtectedRouteProps = {
  children: ReactNode;
};

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const check = async () => {
      const session = await getSession();
      if (!session.isAuthenticated) {
        router.replace("/login");
        return;
      }

      if (isMounted) {
        setReady(true);
      }
    };

    check();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        กำลังโหลด...
      </div>
    );
  }

  return <>{children}</>;
}
