import type { ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeftIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/brand/Eyebrow";

/**
 * The one page header every console screen uses, carrying the landing's
 * language into the app: a gold-rule eyebrow (or, one level down, a back
 * link in the same place), a Cormorant display title, a supporting line,
 * and actions on the right.
 *
 * It owns the page's only `h1`. The top bar shows the section name as
 * plain text, so a screen reader hears one page title, not two.
 */
export function PageHeader({
  eyebrow,
  back,
  title,
  titleHint,
  description,
  actions,
  className,
}: {
  /** Short category label above the title. Ignored when `back` is set - the back link takes its place. */
  eyebrow?: ReactNode;
  back?: { href: Route; label: string };
  title: ReactNode;
  /** Full text for a title that may truncate (hostile-length target names). */
  titleHint?: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-8",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-3">
        {back ? (
          <Link
            href={back.href}
            className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-(--duration-fast) hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
            {back.label}
          </Link>
        ) : (
          eyebrow && <Eyebrow>{eyebrow}</Eyebrow>
        )}
        <h1
          className="truncate font-heading text-3xl leading-tight font-light sm:text-4xl"
          title={titleHint}
        >
          {title}
        </h1>
        {description && (
          <div className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </div>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}
