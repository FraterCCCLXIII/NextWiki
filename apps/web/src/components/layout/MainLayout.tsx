import { Suspense } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { SiteFooter } from "./SiteFooter";
import { ScrollFeather } from "./ScrollFeather";
import { getSetting } from "~/lib/services/settings";
import { KamijiSprite } from "~/components/kamiji/KamijiSprite";
import { LogoLoader } from "~/components/ui/LogoLoader";

export interface PageMetadata {
  title?: string;
  path?: string;
  id?: number;
  isLocked?: boolean;
  lockedBy?: { id: number; name: string } | null;
  lockExpiresAt?: string | null;
  isCurrentUserLockOwner?: boolean;
}

interface MainLayoutProps {
  children: React.ReactNode;
  pageMetadata?: PageMetadata;
}

export async function MainLayout({ children, pageMetadata }: MainLayoutProps) {
  const aiEnabled = await getSetting("ai.enabled").catch(() => false);
  return (
    <div className="flex h-screen">
      {/* Sidebar hidden - kept for potential later use */}
      {/* <Suspense
        fallback={
          <div className="h-screen w-64 animate-pulse bg-gray-100 dark:bg-gray-800"></div>
        }
      >
        <Sidebar />
      </Suspense> */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <Header pageMetadata={pageMetadata} />
        <ScrollFeather />
        <Suspense fallback={<LogoLoader />}>
          <main className="flex-1 overflow-auto">{children}</main>
        </Suspense>
        <Suspense fallback={null}>
          <SiteFooter />
        </Suspense>
        {/* Kamiji, bottom-right: opens the AI assistant (the Header holds the drawer); explains itself when the assistant is off */}
        <KamijiSprite enabled={Boolean(aiEnabled)} />
      </div>
    </div>
  );
}
