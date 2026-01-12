import "./globals.css";
import type { ReactNode } from "react";
import { IBM_Plex_Sans_Thai } from "next/font/google";

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  fallback: [
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Roboto",
    "Noto Sans Thai",
    "sans-serif",
  ],
});

export const metadata = {
  title: "ระบบติดตามการทดแทนกำลังคน",
  description: "แดชบอร์ดติดตามการทดแทนกำลังคนจังหวัดกระบี่",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" className={ibmPlexSansThai.className}>
      <body className="min-h-screen bg-[#050814] text-[#E7EEF8] antialiased">
        {children}
      </body>
    </html>
  );
}
