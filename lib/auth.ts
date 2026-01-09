"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type SessionUser = {
  email?: string | null;
  name?: string | null;
};

export type SessionState = {
  isAuthenticated: boolean;
  user?: SessionUser;
  wrtToken?: string | null;
};

const TOKEN_KEY = "wrt_token";

export async function getSession(): Promise<SessionState> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const sessionUser = data.session?.user ?? null;
  const wrtToken =
    typeof window !== "undefined"
      ? window.localStorage.getItem(TOKEN_KEY)
      : null;

  if (sessionUser) {
    return {
      isAuthenticated: true,
      user: {
        email: sessionUser.email,
        name: sessionUser.user_metadata?.full_name ?? null,
      },
      wrtToken,
    };
  }

  return { isAuthenticated: false, wrtToken };
}

export async function login(credentials: {
  email: string;
  password: string;
}): Promise<{ error?: string }> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (!error && typeof window !== "undefined") {
    window.localStorage.setItem(TOKEN_KEY, "signed_in");
  }

  if (error) {
    return { error: error.message };
  }

  return {};
}

export async function logout(): Promise<{ error?: string }> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TOKEN_KEY);
  }

  if (error) {
    return { error: error.message };
  }

  return {};
}
