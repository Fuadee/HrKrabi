import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Workforce Replacement Tracker',
  description: 'Track replacements and SLA compliance.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>
          <header>
            <h1>Workforce Replacement Tracker</h1>
            <nav>
              <a href="/team/report">Team Lead</a>
              <a href="/hr/dashboard">HR Prov</a>
              <a href="/recruitment/cases">Recruitment</a>
            </nav>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
