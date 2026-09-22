import { useEffect, useRef } from "react";

/**
 * Moves focus onto a region whenever `key` changes - including on first
 * mount (see ShellMain.tsx's file comment for why the first render isn't
 * special-cased away). For the same reason ShellMain exists: a button
 * that triggers an in-place content swap (a form replaced by its result,
 * one panel state replaced by another) commonly gets unmounted as part of
 * that swap, and the browser's default when a focused element is removed
 * is to drop focus to <body> - a keyboard/screen-reader user loses their
 * place with no signal anything happened, even though the URL never
 * changed. Attach the returned ref to a `tabIndex={-1}` container around
 * the new content; `key` should change exactly when that content does
 * (e.g. a status string), not on every render.
 */
export function useFocusRegionOnChange<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null);

  useEffect(() => {
    ref.current?.focus();
  }, [key]);

  return ref;
}
