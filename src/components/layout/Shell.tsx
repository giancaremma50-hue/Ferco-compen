"use client";

import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-muted/30">{children}</main>
      </div>
    </div>
  );
}
