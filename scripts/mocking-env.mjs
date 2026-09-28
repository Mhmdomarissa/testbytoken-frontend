/**
 * The mocking flag's one validation, run by next.config.ts so a
 * misconfigured build fails before it compiles anything.
 * docs/PHASE_DEPLOY.md D1; docs/DEPLOYMENT.md explains the flag.
 *
 *   NEXT_PUBLIC_API_MOCKING = "on"          mock-backed demo build
 *   NEXT_PUBLIC_API_MOCKING unset or "off"  real build (the default)
 *
 * Anything else fails: a typo like "true" must not silently build a demo
 * with no mocks, or a real build with them.
 *
 * Mocking on together with a real NEXT_PUBLIC_API_BASE_URL fails too. The
 * two are mutually exclusive: the mocks answer every request in the
 * browser, so the configured API would never be called, and a deploy
 * that looks connected to a backend would be serving fiction.
 */
export function resolveMocking(env) {
  const flag = env.NEXT_PUBLIC_API_MOCKING;
  if (flag !== undefined && flag !== "" && flag !== "on" && flag !== "off") {
    throw new Error(
      `NEXT_PUBLIC_API_MOCKING must be "on" or "off" (or unset, which means off); got ${JSON.stringify(flag)}.`,
    );
  }
  const mocking = flag === "on";
  const apiBaseUrl = env.NEXT_PUBLIC_API_BASE_URL ?? "";
  if (mocking && apiBaseUrl !== "") {
    throw new Error(
      `NEXT_PUBLIC_API_MOCKING=on and NEXT_PUBLIC_API_BASE_URL=${JSON.stringify(apiBaseUrl)} are both set. ` +
        "A mock-backed demo never calls a real API, and a build that looks connected to one must not ship mocks. Unset one of them.",
    );
  }
  return mocking;
}
