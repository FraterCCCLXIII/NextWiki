"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function WidgetHeader() {
  return (
    <header className="border-border-default flex h-12 items-center border-b px-4">
      <Link
        href="/widget/ai/messenger"
        className="inline-flex items-center gap-2 text-sm font-medium"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to chat
      </Link>
    </header>
  );
}
