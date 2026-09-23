import Link from "next/link";
import { Button } from "@/components/ui/button";
import { navItems } from "@/components/shell/nav-items";

export default function OverviewPage() {
  return (
    <div className="flex max-w-lg flex-col gap-4">
      <h2 className="font-heading text-2xl font-light">Welcome back</h2>
      <p className="text-sm text-muted-foreground">
        This is the application shell &mdash; foundation only. Product screens
        (scan a target, generate a suite, watch a run) come in a later phase.
        For now, each section below only proves the shell&apos;s loading, empty,
        and error states.
      </p>
      <div className="flex flex-wrap gap-2 pt-2">
        {navItems.map((item) => (
          <Button
            key={item.href}
            variant="outline"
            render={<Link href={item.href} />}
            nativeButton={false}
          >
            <item.icon />
            {item.title}
          </Button>
        ))}
      </div>
    </div>
  );
}
