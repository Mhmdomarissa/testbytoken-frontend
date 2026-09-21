"use client";

import { z } from "zod";

export function ZodMessages() {
  const wrongType = z.string().safeParse(1);
  const missing = z.object({ name: z.string() }).safeParse({});
  const tooSmall = z.array(z.string()).min(2).safeParse(["a"]);
  const first = (r: { success: boolean; error?: z.ZodError }) =>
    r.error?.issues[0]?.message ?? "(no error)";

  return (
    <dl className="flex flex-col gap-2 p-6 font-mono text-sm">
      <dt>wrong type</dt>
      <dd data-testid="wrong-type">{first(wrongType)}</dd>
      <dt>missing field</dt>
      <dd data-testid="missing-field">{first(missing)}</dd>
      <dt>too small</dt>
      <dd data-testid="too-small">{first(tooSmall)}</dd>
      <dt>z.locales in the bundle</dt>
      <dd data-testid="locales">{typeof z.locales}</dd>
    </dl>
  );
}
