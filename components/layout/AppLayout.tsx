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
  label: "สถานะระบบ",
  href: "/dev-health",
  match: ["/dev-health", "/dev/health"],
};

const myProfileItem: NavItem = {
  label: "โปรไฟล์ของฉัน",
  href: "/my-profile",
  match: ["/my-profile", "/me"],
};

const teamLeadNavItems: NavItem[] = [
  devHealthItem,
  {
    label: "แดชบอร์ดทีม",
    href: "/team-dashboard",
    match: ["/team-dashboard", "/team/dashboard"],
  },
  {
    label: "รายงานขาดงาน",
    href: "/report-absence",
    match: ["/report-absence", "/team/report"],
  },
  {
    label: "เคสของทีม",
    href: "/team-cases",
    match: ["/team-cases", "/team/cases"],
  },
  myProfileItem,
];

const hrNavItems: NavItem[] = [
  devHealthItem,
  { label: "แดชบอร์ด HR", href: "/hr/dashboard", match: ["/hr/dashboard"] },
  { label: "อัตรากำลัง", href: "/hr/workforce", match: ["/hr/workforce"] },
  myProfileItem,
];

const defaultNavItems: NavItem[] = [devHealthItem, myProfileItem];

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userLabel, setUserLabel] = useState("ผู้ใช้");
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const session = await getSession();
      if (isMounted && session.user) {
        setUserLabel(session.user.name || session.user.email || "ผู้ใช้");
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
      return "ผ";
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
    <div className="flex min-h-screen flex-col bg-[#050814] text-[#E7EEF8]">
      <header className="flex items-center justify-between border-b border-white/5 bg-[#050814]/90 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className="inline-flex items-center justify-center rounded-md border border-white/10 bg-[#0B1220] p-2 text-slate-200 md:hidden"
            aria-label="สลับการนำทาง"
          >
            <span className="text-lg">☰</span>
          </button>
          <Link href={homeHref} className="text-lg font-semibold text-[#E7EEF8]">
            ระบบติดตามการทดแทนกำลังคน
          </Link>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-[#0B1220] px-3 py-1 text-sm"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#101A33] text-xs font-semibold text-[#E7EEF8]">
              {userInitial}
            </span>
            <span className="hidden sm:block">{userLabel}</span>
          </button>
          {menuOpen ? (
            <div className="absolute right-0 mt-2 w-44 rounded-md border border-white/5 bg-[#0B1220] shadow-lg">
              <Link
                href="/my-profile"
                className="block px-4 py-2 text-sm text-slate-200 hover:bg-[#101A33]"
                onClick={() => setMenuOpen(false)}
              >
                โปรไฟล์ของฉัน
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="block w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-[#101A33]"
              >
                ออกจากระบบ
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex flex-1">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-white/5 bg-[#050814]/95 px-4 py-6 backdrop-blur transition duration-200 md:static md:translate-x-0 ${
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
                  className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition ${
                    isActive
                      ? "border-l-4 border-[#D4AF37] bg-[#0B1220] text-[#D4AF37]"
                      : "text-slate-300 hover:bg-[#0B1220] hover:text-[#E7EEF8]"
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`text-xs ${
                      isActive ? "text-[#D4AF37]/70" : "text-slate-500"
                    }`}
                  >
                    ›
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex flex-1 flex-col md:ml-0">
          <div className="flex-1 px-4 py-6 md:px-8">{children}</div>
          <footer className="border-t border-white/5 px-4 py-4 text-center text-sm text-slate-400">
            จัดทำโดย Chalintorn Chusukon PEA KRABI
          </footer>
        </main>
      </div>
    </div>
  );
}
