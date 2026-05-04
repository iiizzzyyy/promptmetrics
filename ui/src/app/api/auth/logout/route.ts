import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/session-store";

const SESSION_COOKIE = "pm-session";

export async function DELETE() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionId) {
    deleteSession(sessionId);
  }

  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete("pm-api-key");
  cookieStore.delete("pm-workspace");

  return NextResponse.json({ ok: true });
}
