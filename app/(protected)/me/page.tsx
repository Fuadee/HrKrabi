"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { logout } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Profile = {
  role: string;
};

const roleLabels: Record<string, string> = {
  hr_prov: "HR จังหวัด",
  team_lead: "หัวหน้าทีม",
};

const formatRoleLabel = (value: string | null) =>
  value ? roleLabels[value] ?? value : "-";

export default function MePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error: userError } = await supabase.auth.getUser();

      if (userError || !data.user) {
        if (isMounted) {
          setError(userError?.message ?? "ไม่สามารถโหลดผู้ใช้ได้");
          setLoading(false);
        }
        return;
      }

      if (isMounted) {
        setEmail(data.user.email ?? null);
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single<Profile>();

      if (isMounted) {
        if (profileError) {
          setError(profileError.message);
        } else {
          setRole(profile?.role ?? null);
        }
        setLoading(false);
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center text-[#E7EEF8]">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/5 bg-[#0B1220]/80 p-6 shadow-[0_20px_60px_rgba(5,8,20,0.45)]">
        <div>
          <h1 className="text-2xl font-semibold">โปรไฟล์ของฉัน</h1>
          <p className="text-sm text-slate-400">
            ข้อมูลอีเมลและบทบาทจาก Supabase
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-slate-300">กำลังโหลดโปรไฟล์...</p>
        ) : (
          <div className="space-y-2 text-left text-sm text-slate-200">
            <p>
              <span className="text-slate-400">อีเมล:</span> {email ?? "-"}
            </p>
            <p>
              <span className="text-slate-400">บทบาท:</span>{" "}
              {formatRoleLabel(role)}
            </p>
          </div>
        )}
        {error ? (
          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleLogout}
          className="btn-secondary w-full text-sm"
        >
          ออกจากระบบ
        </button>
      </div>
    </main>
  );
}
