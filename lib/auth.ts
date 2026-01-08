"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type SessionUser = {
  email?: string | null;
  name?: string | null;
};

export type SessionState = {
  isAuthenticated: boolean;
  user?: SessionUser;
};

const TOKEN_KEY = "wrt_token";

export async function getSession(): Promise<SessionState> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    return {
      isAuthenticated: true,
      user: {
        email: data.user.email,
        name: data.user.user_metadata?.full_name ?? null,
      },
    };
  }

  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (token) {
      return { isAuthenticated: true, user: { email: "Authenticated User" } };
    }
  }

  return { isAuthenticated: false };
}

export async function login(credentials: {
  email: string;
  password: string;
}): Promise<{ ok: boolean; userId?: string; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword(credentials);

  if (!error && typeof window !== "undefined") {
    window.localStorage.setItem(TOKEN_KEY, "signed_in");
  }

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, userId: data.user?.id };
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
