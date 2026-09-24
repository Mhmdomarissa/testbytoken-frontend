import type { ReactNode } from "react";
import { cn } from "cn";

/**
 * The landing page's recurring device: a short gold rule and a tracked-out
 * uppercase label (Montserrat), doubled either side when centred. The rule
 * is decorative, so it's hidden from assistive tech; the label is ordinary
 * text.
 */
export function Eyebrow({
  children,
  centered = false,
  onImage = false,
  className,
}: {
  children: ReactNode;
  centered?: boolean;
  /** Gold label for use over the hero photograph, as the source does. */
  onImage?: boolean;
  className?: string;
}) {
  const rule = (
    <span aria-hidden="true" className="h-[3px] w-9 shrink-0 bg-primary" />
  );
  return (
    <p
      className={cn(
        "flex items-center gap-4",
        centered && "justify-center",
        className,
      )}
    >
      {rule}
      <span
        className={cn(
          "text-[0.6875rem] font-bold tracking-[0.24em] uppercase",
          onImage ? "text-primary" : "text-foreground",
        )}
      >
        {children}
      </span>
      {centered && rule}
    </p>
  );
}
