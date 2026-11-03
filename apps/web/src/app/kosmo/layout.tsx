import type { ReactNode } from "react";
import { MainLayout } from "~/components/layout/MainLayout";
import { AtlasNav } from "~/components/kosmo/atlas-nav";
import { OracleRail } from "~/components/kosmo/oracle-rail";

export default function KosmoLayout({ children }: { children: ReactNode }) {
  return (
    <MainLayout>
      <div className="flex min-h-full flex-col bg-kosmo-bg text-kosmo-text md:flex-row">
        <AtlasNav />
        <OracleRail />
        <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
      </div>
    </MainLayout>
  );
}
