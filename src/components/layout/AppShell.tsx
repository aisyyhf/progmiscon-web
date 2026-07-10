import type { ReactNode } from "react";
import { TopNav } from "./TopNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-bg">
      <TopNav />
      <main className="mx-auto max-w-[1240px] px-6 py-10 md:px-8">{children}</main>
    </div>
  );
}
