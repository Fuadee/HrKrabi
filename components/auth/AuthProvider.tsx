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
type AuthRole = UserRole | null;
type AuthUser = { id: string; email: string | null } | null;

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser;
  role: AuthRole;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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
  const [role, setRole] = useState<AuthRole>(null);
  const [user, setUser] = useState<AuthUser>(null);
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
    setUser(null);
    setRole(null);
  }, []);

  const setAuthed = useCallback((nextUser: AuthUser, nextRole: AuthRole) => {
    setUser(nextUser);
    setRole(nextRole);
    setStatus("authed");
  }, []);

  const loadUserRole = useCallback(
    async (supabase: ReturnType<typeof getSupabaseBrowserClient>, userId: string) => {
      try {
        const { role: profileRole, error: roleError } = await fetchUserRole(
          supabase,
          userId,
        );
        debugLog("[auth] role fetch", {
          pathname,
          role: profileRole,
          error: roleError ? roleError.message : null,
        });
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.debug("ROLE_RESULT", profileRole ?? "missing");
        }
        if (roleError) {
          setRole(null);
          return;
        }
        setRole(profileRole ?? null);
      } catch (error) {
        debugLog("[auth] role fetch exception", {
          pathname,
          error:
            error instanceof Error ? error.message : JSON.stringify(error ?? null),
        });
        setRole(null);
      }
    },
    [debugLog, pathname],
  );

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
    try {
      setStatus("loading");
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        throw error;
      }
      if (!data.user) {
        setUnauthed();
        return;
      }

      setAuthed(
        { id: data.user.id, email: data.user.email ?? null },
        null,
      );
      await loadUserRole(supabase, data.user.id);
    } catch (error) {
      handleAuthError("resolveAuth", error);
    }
  }, [handleAuthError, loadUserRole, setAuthed, setUnauthed]);

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
          setAuthed(
            { id: session.user.id, email: session.user.email ?? null },
            null,
          );
          if (!isMounted) {
            return;
          }
          await loadUserRole(supabase, session.user.id);
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
  }, [handleAuthError, loadUserRole, resolveAuth, setAuthed, setUnauthed]);

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
      user,
      role,
      logout,
    }),
    [logout, role, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
