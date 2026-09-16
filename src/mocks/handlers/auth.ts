import { http } from "msw";
import {
  MeResponseSchema,
  MagicLinkResponseSchema,
  VerifyResponseSchema,
} from "@/lib/contract";
import { json, errorResponse } from "../respond";

const SESSION_COOKIE = "session=demo_user";

const demoUser = {
  id: "user_demo",
  email: "demo@testbytoken.example",
  created_at: "2026-01-01T00:00:00Z",
};

export const authHandlers = [
  http.post("*/auth/magic-link", async () => {
    return json(MagicLinkResponseSchema, { sent: true });
  }),

  http.post("*/auth/verify", async () => {
    return json(
      VerifyResponseSchema,
      { ok: true },
      {
        headers: {
          "Set-Cookie": `${SESSION_COOKIE}; Path=/; HttpOnly; SameSite=Lax`,
        },
      },
    );
  }),

  http.get("*/auth/me", async ({ request }) => {
    const cookie = request.headers.get("cookie") ?? "";
    if (!cookie.includes(SESSION_COOKIE)) {
      return errorResponse(401, "unauthenticated", "No session.");
    }
    return json(MeResponseSchema, demoUser);
  }),

  http.post("*/auth/logout", async () => {
    return new Response(null, {
      status: 200,
      headers: { "Set-Cookie": "session=; Path=/; HttpOnly; Max-Age=0" },
    });
  }),
];
