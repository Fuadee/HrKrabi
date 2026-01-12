"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getSession, login } from "@/lib/auth";
import { getDefaultRouteForRole, getProfileRole } from "@/lib/roleRedirect";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const waitForSession = async (timeoutMs = 1000, intervalMs = 100) => {
  const supabase = getSupabaseBrowserClient();
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      return data.session;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return null;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      const session = await getSession();
      if (session.isAuthenticated) {
        const role = await getProfileRole();
        const target = getDefaultRouteForRole(role);
        router.replace(target);
        return;
      }

      if (isMounted) {
        setCheckingSession(false);
      }
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleSignIn = async () => {
    if (!email || !password) {
      setError("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }
    setLoading(true);
    setError(null);
    setStatus(null);
    const { error: signInError } = await login({ email, password });
    if (signInError) {
      setError(signInError);
      setLoading(false);
      return;
    }

    const session = await waitForSession();
    if (!session?.user) {
      setError("ไม่สามารถยืนยันเซสชันได้ กรุณาลองใหม่อีกครั้ง");
      setLoading(false);
      return;
    }

    const role = await getProfileRole(session.user.id);
    const target = getDefaultRouteForRole(role);
    router.replace(target);
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError(null);
    setStatus(null);
    const supabase = getSupabaseBrowserClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    const confirmedSession = data.session ?? (await waitForSession());
    if (confirmedSession?.user) {
      const role = await getProfileRole(confirmedSession.user.id);
      const target = getDefaultRouteForRole(role);
      router.replace(target);
      return;
    }

    setStatus("กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี");
    setLoading(false);
  };

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        กำลังตรวจสอบเซสชัน...
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center text-[#E7EEF8]">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/5 bg-[#0B1220]/80 p-6 shadow-[0_20px_60px_rgba(5,8,20,0.45)]">
        <div>
          <h1 className="text-2xl font-semibold">เข้าสู่ระบบ</h1>
          <p className="text-sm text-slate-400">
            ใช้อีเมลและรหัสผ่านเพื่อเข้าถึงโปรไฟล์ของคุณ
          </p>
        </div>
        <div className="space-y-3 text-left">
          <label className="block text-sm font-medium text-slate-200">
            อีเมล
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input-premium mt-1"
              placeholder="you@example.com"
            />
          </label>
          <label className="block text-sm font-medium text-slate-200">
            รหัสผ่าน
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-premium mt-1"
              placeholder="••••••••"
            />
          </label>
        </div>
        {error ? (
          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}
        {status ? (
          <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {status}
          </p>
        ) : null}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            className="btn-gold w-full text-sm"
          >
            เข้าสู่ระบบ
          </button>
          <button
            type="button"
            onClick={handleSignUp}
            disabled={loading}
            className="btn-secondary w-full text-sm"
          >
            ลงทะเบียน
          </button>
        </div>
      </div>
    </main>
  );
}
