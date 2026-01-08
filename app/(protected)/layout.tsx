"use client";

import type { ReactNode } from "react";

import AuthProvider from "@/components/auth/AuthProvider";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import RoleGate from "@/components/auth/RoleGate";
import AppLayout from "@/components/layout/AppLayout";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  // UI shell only; business logic untouched.
  return (
    <AuthProvider>
      <ProtectedRoute>
        <RoleGate>
          <AppLayout>{children}</AppLayout>
        </RoleGate>
      </ProtectedRoute>
    </AuthProvider>
  );
}
