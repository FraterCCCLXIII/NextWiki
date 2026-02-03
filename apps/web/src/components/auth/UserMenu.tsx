"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@repo/ui";
import { PlusIcon, UserCircle, LogOut, Settings } from "lucide-react";
import { PageLocationEditor } from "~/components/wiki/PageLocationEditor";
import { usePermissions } from "~/components/auth/permission/client";

type UserMenuProps = {
  adminLinkOverride?: {
    href: string;
    label: string;
  };
};

export function UserMenu({ adminLinkOverride }: UserMenuProps) {
  const { data: session, status } = useSession();
  const { hasPermission } = usePermissions();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  if (isLoading) {
    return <div className="bg-card h-9 w-9 animate-pulse rounded-full"></div>;
  }

  if (!isAuthenticated) {
    return (
      <Link
        href="/login"
        className="border-border hover:bg-card-hover text-text-primary rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
      >
        Sign in
      </Link>
    );
  }

  const canCreatePage = hasPermission("wiki:page:create");

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center space-x-2 rounded-md px-3 py-2 hover:bg-background-level1 transition-colors focus:outline-none">
            <div className="border-border relative h-7 w-7 overflow-hidden rounded-full border">
              {session.user.image ? (
                <Image
                  src={session.user.image}
                  alt={session.user.name || "User profile"}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="bg-primary flex h-full w-full items-center justify-center text-xs font-medium text-white">
                  {session.user.name?.charAt(0) ||
                    session.user.email?.charAt(0) ||
                    "U"}
                </div>
              )}
            </div>
            <span className="text-text-primary text-sm font-medium">
              {session.user.name || session.user.email?.split("@")[0] || "User"}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1 bg-background-paper border-border-default">
          <div className="px-3 py-2 text-xs text-text-secondary border-b border-border-default mb-1">
            Signed in as{" "}
            <span className="font-semibold text-text-primary">{session.user.email}</span>
          </div>
          <div className="space-y-0.5">
            {canCreatePage && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="text-text-primary hover:bg-background-level1 flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors"
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                Add Page
              </button>
            )}
            {session.user.isAdmin && (
              <Link
                href={adminLinkOverride?.href ?? "/admin/dashboard"}
                className="text-text-primary hover:bg-background-level1 flex items-center rounded-md px-3 py-2 text-sm transition-colors"
              >
                <Settings className="mr-2 h-4 w-4 flex-shrink-0" />
                {adminLinkOverride?.label ?? "Admin Dashboard"}
              </Link>
            )}
            <Link
              href="/profile"
              className="text-text-primary hover:bg-background-level1 flex items-center rounded-md px-3 py-2 text-sm transition-colors"
            >
              <UserCircle className="mr-2 h-4 w-4 flex-shrink-0" />
              Your Profile
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-text-primary hover:bg-background-level1 flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors"
            >
              <LogOut className="mr-2 h-4 w-4 flex-shrink-0" />
              Sign out
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Page Location Editor Modal */}
      <PageLocationEditor
        mode="create"
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </>
  );
}
