import { UnrecognisedValue } from "@/lib/api/tolerant";

export interface LoginFailureCopy {
  title: string;
  guidance: string;
}

const COPY = new Map<string, LoginFailureCopy>([
  [
    "browser_unavailable",
    {
      title: "We couldn't start a browser",
      guidance: "Nothing was captured. Try again in a moment.",
    },
  ],
  [
    "no_session_detected",
    {
      title: "We didn't see a signed-in session",
      guidance:
        "Open the browser, sign in, and only then tell us you're done. We check for a real signed-in session; we don't just take your word for it.",
    },
  ],
  [
    "internal",
    {
      title: "Our side failed",
      guidance:
        "This was our fault, not yours. Try again; if it fails a second time, contact support.",
    },
  ],
]);

const UNRECOGNISED: LoginFailureCopy = {
  title: "The sign-in failed for a reason this app doesn't recognise",
  guidance: "The message below is what the server reported. You can try again.",
};

export function loginFailureCopy(
  kind: string | UnrecognisedValue,
): LoginFailureCopy {
  if (kind instanceof UnrecognisedValue) return UNRECOGNISED;
  return COPY.get(kind) ?? UNRECOGNISED;
}
