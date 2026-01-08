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
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("AUTH_STATUS_BEFORE", statusRef.current);
    }
    setStatus("unauthed");
    setUser(null);
    setRole(null);
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("AUTH_STATUS_AFTER", "unauthed");
    }
  }, []);

  const setAuthed = useCallback((nextUser: AuthUser, nextRole: AuthRole) => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("AUTH_STATUS_BEFORE", statusRef.current);
    }
    setUser(nextUser);
    setRole(nextRole);
    setStatus("authed");
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("AUTH_STATUS_AFTER", "authed");
    }
  }, []);

  const loadUserRole = useCallback(
    async (supabase: ReturnType<typeof getSupabaseBrowserClient>, userId: string) => {
      try {
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.debug("ROLE_FETCH_START");
        }
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
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.debug("ROLE_FETCH_ERROR", roleError.message);
          }
          setRole(null);
          return;
        }
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.debug("ROLE_FETCH_OK", profileRole ?? "missing");
        }
        setRole(profileRole ?? null);
      } catch (error) {
        debugLog("[auth] role fetch exception", {
          pathname,
          error:
            error instanceof Error ? error.message : JSON.stringify(error ?? null),
        });
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.debug(
            "ROLE_FETCH_ERROR",
            error instanceof Error ? error.message : "unknown",
          );
        }
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
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.debug(
          "SIGNIN_ERROR",
          error instanceof Error ? error.message : "unknown",
        );
      }
      clearLocalToken();
      setUnauthed();
      safeReplace("/login");
    },
    [clearLocalToken, debugLog, pathname, safeReplace, setUnauthed],
  );

  const resolveAuth = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    try {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.debug("SIGNIN_START");
      }
      setStatus("loading");
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError) {
        throw sessionError;
      }
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.debug("[auth] session", {
          hasSession: Boolean(sessionData.session),
          hasAccessToken: Boolean(sessionData.session?.access_token),
        });
      }
      if (!sessionData.session?.user) {
        setUnauthed();
        return;
      }

      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.debug("SIGNIN_OK", sessionData.session.user.id);
      }
      setAuthed(
        {
          id: sessionData.session.user.id,
          email: sessionData.session.user.email ?? null,
        },
        null,
      );
      await loadUserRole(supabase, sessionData.session.user.id);
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

    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) {
        return;
      }
      try {
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.debug("[auth] event", {
            event,
            hasSession: Boolean(session),
            hasAccessToken: Boolean(session?.access_token),
          });
        }
        if (session?.user) {
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.debug("SIGNIN_START");
            // eslint-disable-next-line no-console
            console.debug("SIGNIN_OK", session.user.id);
          }
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
