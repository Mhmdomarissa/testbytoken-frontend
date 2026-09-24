"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { MagicLinkResponseSchema, VerifyResponseSchema } from "@/lib/contract";
import { setMockSessionCookie } from "@/mocks/session-cookie-workaround";

type Step = "request" | "sent" | "verifying";

/**
 * The sign-in form itself - moved here unchanged so the page around it can
 * be a server component (see page.tsx).
 */
export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Could not send the link. Try again.");
      MagicLinkResponseSchema.parse(await res.json());
      setStep("sent");
    } catch {
      setError("Could not send the link. Try again.");
    }
  }

  // Dev convenience: there is no real inbox to click a link from, and no
  // backend to issue a real token. The mock accepts any token
  // unconditionally, so this stands in for "the user clicked the email
  // link" without inventing a fake email UI.
  async function continueDev() {
    setStep("verifying");
    setError(null);
    try {
      const res = await fetch("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "dev" }),
      });
      if (!res.ok) throw new Error("Link expired or invalid.");
      VerifyResponseSchema.parse(await res.json());
      // See src/mocks/session-cookie-workaround.ts - the mock's own
      // Set-Cookie header (correct, and what a real backend would rely
      // on) is silently dropped because MSW serves this via a Service
      // Worker, which cannot set cookies that way.
      setMockSessionCookie();
      router.push(searchParams.get("from") ?? "/overview");
      router.refresh();
    } catch {
      setError("Link expired or invalid.");
      setStep("sent");
    }
  }

  return (
    <>
      {step === "request" && (
        <form onSubmit={requestLink} className="mt-8">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              {error && (
                <FieldDescription className="text-destructive">
                  {error}
                </FieldDescription>
              )}
            </Field>
            <Button type="submit" disabled={!email}>
              Send magic link
            </Button>
          </FieldGroup>
        </form>
      )}

      {(step === "sent" || step === "verifying") && (
        <div className="mt-8 flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Check <span className="text-foreground">{email}</span> for a sign-in
            link.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            variant="outline"
            onClick={continueDev}
            disabled={step === "verifying"}
          >
            {step === "verifying" ? (
              <>
                <Spinner /> Verifying…
              </>
            ) : (
              "Continue (dev - no backend yet)"
            )}
          </Button>
        </div>
      )}
    </>
  );
}
