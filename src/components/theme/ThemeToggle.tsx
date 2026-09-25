"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const THEME_OPTIONS = [
  { value: "system", label: "System", icon: MonitorIcon },
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
] as const;

/**
 * next-themes only knows the stored choice in the browser; on the server
 * (and the hydration pass) there is no honest answer, so render the
 * neutral "system" icon until mounted rather than guessing.
 */
const subscribeNothing = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

/** The theme choices as a radio group - shared by the top bar and the user menu. */
export function ThemeRadioItems() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Theme</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={mounted ? (theme ?? "system") : "system"}
        onValueChange={(v) => setTheme(String(v))}
      >
        {THEME_OPTIONS.map((o) => (
          <DropdownMenuRadioItem key={o.value} value={o.value}>
            <o.icon aria-hidden="true" />
            {o.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  );
}

/** The top bar's theme button: shows the current choice, opens the three options. */
export function ThemeToggle() {
  const { theme } = useTheme();
  const mounted = useMounted();
  const current =
    THEME_OPTIONS.find((o) => o.value === (mounted ? theme : "system")) ??
    THEME_OPTIONS[0];
  const Icon = current.icon;
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Theme: ${current.label}`}
                />
              }
            />
          }
        >
          <Icon aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Theme: {current.label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-44">
        <ThemeRadioItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
