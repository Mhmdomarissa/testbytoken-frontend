"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * A step's screenshot, per docs/API_CONTRACT.md: a resolved, ready-to-fetch
 * URL, never a bearer token in the URL itself. This IS a plain <img>, not a
 * link or an iframe - a screenshot is a picture, not executable content,
 * so it needs none of the HTML-report's sandboxing. Clicking it opens a
 * larger view in a dialog; nothing here is clickable-through to the
 * scraped site itself (CLAUDE.md: a URL from scraped content is never made
 * clickable without an explicit allowlist check - a screenshot URL is OUR
 * OWN API's URL, not one from the tested page, so this rule doesn't apply
 * to the image source itself, but the image is still never wrapped in an
 * anchor to anywhere).
 */
export function Screenshot({
  url,
  alt,
  size = "thumbnail",
}: {
  url: string;
  alt: string;
  size?: "thumbnail" | "full";
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <p
        className="text-xs text-muted-foreground"
        data-testid="screenshot-failed"
      >
        Screenshot could not be loaded.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        data-testid="screenshot-thumb"
        onClick={() => setOpen(true)}
        className="block border border-border focus-visible:outline-2 focus-visible:outline-ring"
      >
        <img
          src={url}
          alt={alt}
          onError={() => setFailed(true)}
          className={
            size === "thumbnail"
              ? "h-20 w-32 object-cover"
              : "max-h-64 w-full object-contain"
          }
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogTitle className="font-heading">{alt}</DialogTitle>
          <img src={url} alt={alt} className="w-full" />
        </DialogContent>
      </Dialog>
    </>
  );
}
