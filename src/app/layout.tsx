import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FirstPR — Open-Source Contribution Readiness',
  description:
    'Helping first-time contributors understand issues, inspect contribution guidelines, plan changes, and draft pull requests.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
