"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { getSession, logout } from "@/lib/auth";
import { getDefaultRouteForRole, getProfileRole } from "@/lib/roleRedirect";

type NavItem = {
  label: string;
  href: string;
  match?: string[];
};

const devHealthItem: NavItem = {
  label: "Dev health",
  href: "/dev-health",
  match: ["/dev-health", "/dev/health"],
};

const myProfileItem: NavItem = {
  label: "My profile",
  href: "/my-profile",
  match: ["/my-profile", "/me"],
};

const teamLeadNavItems: NavItem[] = [
  devHealthItem,
  {
    label: "Team dashboard",
    href: "/team-dashboard",
    match: ["/team-dashboard", "/team/dashboard"],
  },
  {
    label: "Report absence",
    href: "/report-absence",
    match: ["/report-absence", "/team/report"],
  },
  {
    label: "Team cases",
    href: "/team-cases",
    match: ["/team-cases", "/team/cases"],
  },
  myProfileItem,
];

const hrNavItems: NavItem[] = [
  devHealthItem,
  { label: "HR dashboard", href: "/hr/dashboard", match: ["/hr/dashboard"] },
  myProfileItem,
];

const defaultNavItems: NavItem[] = [devHealthItem, myProfileItem];

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userLabel, setUserLabel] = useState("User");
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const session = await getSession();
      if (isMounted && session.user) {
        setUserLabel(session.user.name || session.user.email || "User");
      }

      const profileRole = await getProfileRole();
      if (isMounted) {
        setRole(profileRole);
      }
    };

    loadSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const userInitial = useMemo(() => {
    const trimmed = userLabel.trim();
    if (!trimmed) {
      return "U";
    }
    return trimmed[0].toUpperCase();
  }, [userLabel]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const navItems = useMemo(() => {
    if (role === "team_lead") {
      return teamLeadNavItems;
    }

    if (role === "hr_prov") {
      return hrNavItems;
    }

    return defaultNavItems;
  }, [role]);

  const homeHref = getDefaultRouteForRole(role);

  return (
    // UI shell only; business logic untouched.
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <header className="flex items-center justify-between border-b border-border/70 bg-white/70 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className="inline-flex items-center justify-center rounded-md border border-border/70 bg-white/70 p-2 text-text-muted transition duration-200 ease-out hover:border-accent-purple/50 hover:bg-accent-soft/60 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
            aria-label="Toggle navigation"
          >
            <span className="text-lg">☰</span>
          </button>
          <Link href={homeHref} className="text-lg font-semibold">
            Workforce Replacement Tracker
          </Link>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-2 rounded-full border border-border/70 bg-white/70 px-3 py-1 text-sm text-text-muted transition duration-200 ease-out hover:border-accent-purple/50 hover:bg-accent-soft/60 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-purple">
              {userInitial}
            </span>
            <span className="hidden sm:block">{userLabel}</span>
          </button>
          {menuOpen ? (
            <div className="glass-surface absolute right-0 mt-2 w-44 rounded-md shadow-[0_18px_30px_-24px_rgba(124,58,237,0.35)]">
              <Link
                href="/my-profile"
                className="block px-4 py-2 text-sm text-text-muted transition duration-200 ease-out hover:bg-accent-soft/50 hover:text-text"
                onClick={() => setMenuOpen(false)}
              >
                My profile
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="block w-full px-4 py-2 text-left text-sm text-text-muted transition duration-200 ease-out hover:bg-accent-soft/50 hover:text-text"
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex flex-1">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-border/70 bg-white/80 px-4 py-6 backdrop-blur transition duration-200 md:static md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <nav className="space-y-2">
            {navItems.map((item) => {
              const matches = item.match ?? [item.href];
              const isActive = matches.some((matchPath) => pathname === matchPath);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`relative flex items-center justify-between rounded-full px-4 py-2 text-sm transition duration-200 ease-out before:absolute before:left-2 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-accent-purple before:opacity-0 ${
                    isActive
                      ? "bg-accent-soft text-accent-purple before:opacity-100"
                      : "text-text-muted hover:bg-accent-soft/60 hover:text-text"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-text-muted">›</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex flex-1 flex-col md:ml-0">
          <div className="flex-1 px-4 py-6 md:px-8">{children}</div>
          <footer className="border-t border-border px-4 py-4 text-center text-sm text-text-muted">
            จัดทำโดย Chalintorn Chusukon PEA KRABI
          </footer>
        </main>
      </div>
    </div>
  );
}
