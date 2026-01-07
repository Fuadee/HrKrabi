"use client";

import { useEffect, useState } from "react";

export default function HealthPage() {
  const [timestamp, setTimestamp] = useState<string>("");

  useEffect(() => {
    setTimestamp(new Date().toLocaleString());
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="rounded-full bg-emerald-500/10 px-4 py-1 text-sm font-medium text-emerald-300">
        OK
      </span>
      <p className="text-slate-300">{timestamp || "Loading timestamp..."}</p>
    </main>
  );
}
