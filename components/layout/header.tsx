"use client";

import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/documents": "Documents",
  "/chat": "Chat with Knowledge Base",
};

export function Header() {
  const pathname = usePathname();
  const title = Object.entries(pageTitles).find(([path]) => pathname.startsWith(path))?.[1] || "Knowledge Base";

  return (
    <header className="flex h-14 items-center border-b border-border bg-card px-6">
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  );
}
