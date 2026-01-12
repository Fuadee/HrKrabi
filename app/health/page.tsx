"use client";

import { useEffect, useState } from "react";

export default function HealthPage() {
  const [timestamp, setTimestamp] = useState<string>("");

  useEffect(() => {
    setTimestamp(new Date().toLocaleString());
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="badge border-emerald-400/30 bg-emerald-500/10 text-emerald-200">
        พร้อมใช้งาน
      </span>
      <p className="text-slate-300">
        {timestamp || "กำลังโหลดเวลา..."}
      </p>
    </main>
  );
}
