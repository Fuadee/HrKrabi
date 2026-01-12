"use client";

import type { ReactNode } from "react";

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  accent?: "gold" | "gradient";
};

export function SectionHeader({
  title,
  subtitle,
  action,
  className,
  accent = "gold",
}: SectionHeaderProps) {
  const accentClasses =
    accent === "gradient"
      ? "relative overflow-hidden border-l-0"
      : "border-l-4 border-[#D4AF37]";

  return (
    <div className={["section-header", accentClasses, className].join(" ")}>
      {accent === "gradient" ? (
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-[#F58529] via-[#DD2A7B] to-[#515BD4]"
        />
      ) : null}
      <div className="space-y-1">
        <p className="section-header-title">{title}</p>
        {subtitle ? <p className="section-header-subtitle">{subtitle}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
