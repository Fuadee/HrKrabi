"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";

type ProtectedRouteProps = {
  children: ReactNode;
};

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuth();
  const redirectRef = useRef<{ target: string | null }>({ target: null });

  useEffect(() => {
    redirectRef.current.target = null;
  }, [pathname]);

  useEffect(() => {
    if (status === "unauthed") {
      if (pathname !== "/login" && redirectRef.current.target !== "/login") {
        redirectRef.current.target = "/login";
        router.replace("/login");
      }
    }
  }, [pathname, router, status]);

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
