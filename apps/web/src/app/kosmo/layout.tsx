import type { ReactNode } from "react";
import { AtlasNav } from "~/components/kosmo/atlas-nav";

export default function KosmoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-kosmo-bg text-kosmo-text md:flex-row">
      <AtlasNav />
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
