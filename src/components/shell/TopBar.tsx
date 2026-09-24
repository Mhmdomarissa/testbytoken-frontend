"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "./CommandPalette";
import { navItems } from "./nav-items";

function titleForPathname(pathname: string): string {
  const match = navItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.title ?? "Overview";
}

export function TopBar() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="flex h-12 items-center gap-2 border-b border-border px-3">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-4" />
      {/* Plain text, not a heading: each page's PageHeader owns its only h1. */}
      <p className="text-sm font-medium">{titleForPathname(pathname)}</p>
      <Button
        variant="outline"
        size="sm"
        className="ml-auto gap-2 text-muted-foreground"
        onClick={() => setPaletteOpen(true)}
      >
        <SearchIcon />
        Jump to…
        <kbd className="ml-2 rounded-sm border border-border px-1 font-mono text-[0.65rem]">
          ⌘K
        </kbd>
      </Button>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
