"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { fetchUserRole, type UserRole } from "@/lib/roleAccess";

type AuthStatus = "loading" | "authed" | "unauthed";
type AuthRole = UserRole | "unknown" | null;

type AuthContextValue = {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  name: string | null;
  role: AuthRole;
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
  const [role, setRole] = useState<AuthRole>(null);
  const statusRef = useRef<AuthStatus>(status);
  const redirectRef = useRef<{ target: string | null }>({ target: null });

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    redirectRef.current.target = null;
  }, [pathname]);

  const debugLog = useCallback(
    (message: string, payload: Record<string, unknown>) => {
      if (process.env.NODE_ENV === "production") {
        return;
      }
      // eslint-disable-next-line no-console
      console.debug(message, payload);
    },
    [],
  );

  const clearLocalToken = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("wrt_token");
    }
  }, []);

  const safeReplace = useCallback(
    (target: string) => {
      if (redirectRef.current.target === target || pathname === target) {
        return;
      }
      redirectRef.current.target = target;
      router.replace(target);
    },
    [pathname, router],
  );

  const setUnauthed = useCallback(() => {
    setStatus("unauthed");
    setUserId(null);
    setEmail(null);
    setName(null);
    setRole(null);
  }, []);

  const handleAuthError = useCallback(
    (context: string, error: unknown) => {
      debugLog("[auth] error", {
        context,
        pathname,
        error:
          error instanceof Error ? error.message : JSON.stringify(error ?? null),
      });
      clearLocalToken();
      setUnauthed();
      safeReplace("/login");
    },
    [clearLocalToken, debugLog, pathname, safeReplace, setUnauthed],
  );

  const resolveAuth = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    setStatus("loading");
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        handleAuthError("resolveAuth.getUser", error);
        return;
      }
      if (!data.user) {
        setUnauthed();
        return;
      }

      setUserId(data.user.id);
      setEmail(data.user.email ?? null);
      setName(getDisplayName(data.user));
      const { role: profileRole, error: roleError } = await fetchUserRole(
        supabase,
        data.user.id,
      );
      debugLog("[auth] role fetch", {
        pathname,
        role: profileRole,
        error: roleError ? roleError.message : null,
      });
      if (roleError) {
        setRole("unknown");
      } else {
        setRole(profileRole ?? "unknown");
      }
      setStatus("authed");
    } catch (error) {
      handleAuthError("resolveAuth", error);
    }
  }, [debugLog, handleAuthError, pathname, setUnauthed]);

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
      try {
        if (session?.user) {
          setStatus("loading");
          setUserId(session.user.id);
          setEmail(session.user.email ?? null);
          setName(getDisplayName(session.user));
          const { role: profileRole, error: roleError } = await fetchUserRole(
            supabase,
            session.user.id,
          );
          debugLog("[auth] role fetch", {
            pathname,
            role: profileRole,
            error: roleError ? roleError.message : null,
          });
          if (!isMounted) {
            return;
          }
          if (roleError) {
            setRole("unknown");
          } else {
            setRole(profileRole ?? "unknown");
          }
          setStatus("authed");
        } else {
          setUnauthed();
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
        handleAuthError("authStateChange", error);
      }
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [debugLog, handleAuthError, pathname, resolveAuth, setUnauthed]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }
    // eslint-disable-next-line no-console
    console.debug("[auth] status", { status, pathname });
  }, [pathname, status]);

  useEffect(() => {
    if (status !== "loading") {
      return;
    }
    const timeout = window.setTimeout(() => {
      if (statusRef.current !== "loading") {
        return;
      }
      debugLog("[auth] timeout", { pathname });
      clearLocalToken();
      setUnauthed();
      safeReplace("/login");
    }, 5000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [clearLocalToken, debugLog, pathname, safeReplace, setUnauthed, status]);

  const logout = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("[auth] logout", { status, pathname });
    }
    await supabase.auth.signOut();
    clearLocalToken();
    setUnauthed();
    safeReplace("/login");
  }, [clearLocalToken, pathname, safeReplace, setUnauthed, status]);

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
