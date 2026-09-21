import { CreateTargetRequestSchema } from "@/lib/contract";
import type { z } from "zod";

export type TargetInput = z.infer<typeof CreateTargetRequestSchema>;
export type TargetFieldErrors = Partial<
  Record<"name" | "base_url" | "environment", string>
>;

export const MAX_NAME_LENGTH = 80;
const MAX_URL_LENGTH = 2048;

/**
 * Client-side validation for registering a target. Deliberately a
 * courtesy, not a guardrail: it catches typos before a round trip and
 * says what is wrong in plain words. The server enforces the real rules
 * (Phase B B3) - most importantly which addresses may be scanned at all -
 * and this file does NOT try to duplicate that (a private-address list
 * here would drift from the server's and give false assurance either
 * way). A target the server later refuses arrives as a `failed` scan
 * with kind `blocked_by_guardrail`, which the screen designs for.
 *
 * One rule IS ours: no credentials in the URL. `https://user:pass@host`
 * is a password field in disguise, and CLAUDE.md is unambiguous that this
 * product takes no credential for the application under test, anywhere.
 * Signing in happens in a live browser the customer drives.
 */
export function validateTarget(raw: {
  name: string;
  base_url: string;
  environment: string | null;
}):
  { ok: true; value: TargetInput } | { ok: false; errors: TargetFieldErrors } {
  const errors: TargetFieldErrors = {};

  const name = raw.name.trim();
  if (name === "") errors.name = "Give the target a name.";
  else if (name.length > MAX_NAME_LENGTH)
    errors.name = `Keep the name under ${MAX_NAME_LENGTH} characters.`;

  const urlText = raw.base_url.trim();
  if (urlText === "") {
    errors.base_url = "Enter the address of the application.";
  } else if (urlText.length > MAX_URL_LENGTH) {
    errors.base_url = "That address is too long.";
  } else if (!/^https?:\/\//i.test(urlText)) {
    errors.base_url = "Start the address with https:// (or http://).";
  } else if (/^https?:\/\/[/\\]/i.test(urlText)) {
    // new URL("https:///host") quietly "fixes" this to host - but we would
    // send the text as typed, so the two would disagree.
    errors.base_url = "That doesn't look like a valid address.";
  } else {
    let parsed: URL | null = null;
    try {
      parsed = new URL(urlText);
    } catch {
      errors.base_url = "That doesn't look like a valid address.";
    }
    if (parsed) {
      if (parsed.username !== "" || parsed.password !== "") {
        errors.base_url =
          "Remove the username and password from the address. We never take credentials in a URL - if the site needs a sign-in, you'll do that yourself in a live browser.";
      } else if (parsed.hostname === "") {
        errors.base_url = "That address has no host name.";
      }
    }
  }

  if (raw.environment === null || raw.environment === "") {
    errors.environment = "Choose which environment this is.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  // The contract has the last word on shape - the environment must be a
  // value it knows, and the URL must satisfy its URL check.
  const parsed = CreateTargetRequestSchema.safeParse({
    name,
    base_url: urlText,
    environment: raw.environment,
  });
  if (!parsed.success) {
    const fallback: TargetFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "name" || key === "base_url" || key === "environment") {
        fallback[key] ??=
          key === "environment"
            ? "Choose one of the listed environments."
            : "That value isn't valid.";
      }
    }
    return { ok: false, errors: fallback };
  }
  return { ok: true, value: parsed.data };
}
