"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { Popover, PopoverTrigger, PopoverContent } from "@repo/ui";

export function UserMenu() {
  const { data: session, status } = useSession();
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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center space-x-2 focus:outline-none">
          <div className="border-border relative h-9 w-9 overflow-hidden rounded-full border">
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name || "User profile"}
                fill
                className="object-cover"
              />
            ) : (
              <div className="bg-primary flex h-full w-full items-center justify-center font-medium text-white">
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
      <PopoverContent className="w-48">
        <div className="px-4 py-2 text-xs text-gray-500">
          Signed in as{" "}
          <span className="font-semibold">{session.user.email}</span>
        </div>
        <div className="border-t border-gray-100">
          {session.user.isAdmin && (
            <Link
              href="/admin/dashboard"
              className="text-text-primary hover:bg-card-hover flex items-center px-4 py-2 text-sm"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="mr-2 h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947z"
                  clipRule="evenodd"
                />
                <path d="M10 13a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
              Admin Dashboard
            </Link>
          )}
          <Link
            href="/profile"
            className="text-text-primary hover:bg-card-hover block px-4 py-2 text-sm"
          >
            Your Profile
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-text-primary hover:bg-card-hover block w-full px-4 py-2 text-left text-sm"
          >
            Sign out
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
