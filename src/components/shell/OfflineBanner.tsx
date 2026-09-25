"use client";

import { useSyncExternalStore } from "react";
import { WifiOffIcon } from "lucide-react";

function subscribe(callback: () => void) {
  window.addEventListener("offline", callback);
  window.addEventListener("online", callback);
  return () => {
    window.removeEventListener("offline", callback);
    window.removeEventListener("online", callback);
  };
}

function useIsOffline() {
  return useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false, // server snapshot: assume online, corrected on the client
  );
}

export function OfflineBanner() {
  const offline = useIsOffline();

  if (!offline) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-(--status-warning-tint) px-4 py-1.5 text-xs font-medium text-(--status-warning-fg)">
      <WifiOffIcon className="size-3.5" aria-hidden="true" />
      You&apos;re offline. Reconnecting…
    </div>
  );
}
