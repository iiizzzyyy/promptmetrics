import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/session-store";

const API_BASE = process.env.API_BASE_URL || "http://localhost:3000";
const SESSION_COOKIE = "pm-session";
const MAX_AGE = 30 * 60; // 30 minutes

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: MAX_AGE,
  };
}

export async function POST(req: Request) {
  const { apiKey } = await req.json();

  if (!apiKey || typeof apiKey !== "string") {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  const validationRes = await fetch(`${API_BASE}/v1/api-keys/me`, {
    headers: { "X-API-Key": apiKey },
  });

  if (!validationRes.ok) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const { sessionId, csrfToken } = createSession(apiKey, "default");

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, getCookieOptions());

  return NextResponse.json({ ok: true, csrfToken });
}
