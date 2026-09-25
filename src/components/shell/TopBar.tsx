"use client";

import { useState } from "react";
import { PlusIcon, SearchIcon } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { CommandPalette } from "./CommandPalette";
import { Breadcrumbs } from "./Breadcrumbs";
import dynamic from "next/dynamic";

// Loaded the first time "New test" is pressed, not with every console
// route: the picker brings the targets query, the command list and the
// dialog, which most pages never need.
const TargetPicker = dynamic(
  () => import("./TargetPicker").then((m) => m.TargetPicker),
  { ssr: false },
);

/**
 * The console's top bar (UI v2 V1): sidebar toggle, breadcrumbs, search
 * (the command palette, ⌘K), the theme, and the one primary action - a
 * new test. The page title itself lives in each page's PageHeader (the
 * only h1); the breadcrumbs say where that page sits.
 */
export function TopBar() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Mount (and so fetch the chunk) only once it has been asked for.
  const [pickerWanted, setPickerWanted] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
      <Tooltip>
        <TooltipTrigger render={<SidebarTrigger />} />
        <TooltipContent>
          Toggle sidebar <kbd className="ml-1 font-mono">⌘B</kbd>
        </TooltipContent>
      </Tooltip>
      <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />
      <Breadcrumbs />
      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-muted-foreground"
          onClick={() => setPaletteOpen(true)}
          aria-label="Jump to… ⌘K"
        >
          <SearchIcon aria-hidden="true" />
          <span className="hidden sm:inline">Jump to…</span>
          <kbd className="ml-1 hidden rounded border border-border px-1 font-mono text-[0.65rem] sm:inline">
            ⌘K
          </kbd>
        </Button>
        <ThemeToggle />
        <Button
          size="sm"
          onClick={() => {
            setPickerWanted(true);
            setPickerOpen(true);
          }}
        >
          <PlusIcon aria-hidden="true" />
          New test
        </Button>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      {pickerWanted && (
        <TargetPicker open={pickerOpen} onOpenChange={setPickerOpen} />
      )}
    </header>
  );
}
