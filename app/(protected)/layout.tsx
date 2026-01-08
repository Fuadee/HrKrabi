"use client";

import type { ReactNode } from "react";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  // UI shell only; business logic untouched.
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}
