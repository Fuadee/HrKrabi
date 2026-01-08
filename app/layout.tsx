import "./globals.css";
import type { ReactNode } from "react";

import AuthProvider from "@/components/auth/AuthProvider";

export const metadata = {
  title: "Workforce Replacement Tracker",
  description: "Step-by-step rebuild"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
