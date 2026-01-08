"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { fetchUserRole, type UserRole } from "@/lib/roleAccess";

type AuthStatus = "loading" | "authed" | "unauthed";

type AuthContextValue = {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  name: string | null;
  role: UserRole | null;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getDisplayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string | null {
  if (user.user_metadata) {
    const metadata = user.user_metadata as Record<string, unknown>;
    const fullName = metadata.full_name;
    if (typeof fullName === "string" && fullName.trim()) {
      return fullName;
    }
    const name = metadata.name;
    if (typeof name === "string" && name.trim()) {
      return name;
    }
  }
  return user.email ?? null;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);

  const setUnauthed = useCallback(() => {
    setStatus("unauthed");
    setUserId(null);
    setEmail(null);
    setName(null);
    setRole(null);
  }, []);

  const resolveAuth = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    setStatus("loading");
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setUnauthed();
      return;
    }

    setUserId(data.user.id);
    setEmail(data.user.email ?? null);
    setName(getDisplayName(data.user));
    const profileRole = await fetchUserRole(supabase);
    setRole(profileRole);
    setStatus("authed");
  }, [setUnauthed]);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowserClient();

    const bootstrap = async () => {
      await resolveAuth();
    };

    bootstrap();

    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) {
        return;
      }
      if (session?.user) {
        setStatus("loading");
        setUserId(session.user.id);
        setEmail(session.user.email ?? null);
        setName(getDisplayName(session.user));
        const profileRole = await fetchUserRole(supabase);
        if (!isMounted) {
          return;
        }
        setRole(profileRole);
        setStatus("authed");
      } else {
        setUnauthed();
      }
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [resolveAuth, setUnauthed]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }
    // eslint-disable-next-line no-console
    console.info("[auth] status", { status, pathname });
  }, [pathname, status]);

  const logout = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.info("[auth] logout", { status, pathname });
    }
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("wrt_token");
    }
    setUnauthed();
    router.replace("/login");
  }, [pathname, router, setUnauthed, status]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      userId,
      email,
      name,
      role,
      logout,
    }),
    [email, logout, name, role, status, userId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
