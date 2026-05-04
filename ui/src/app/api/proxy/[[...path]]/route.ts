import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session-store";

const API_BASE = process.env.API_BASE_URL || "http://localhost:3000";
const SESSION_COOKIE = "pm-session";

async function proxy(req: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  const pathname = path.join("/");
  const url = new URL(req.url);
  const search = url.search;

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = getSession(sessionId);
  if (!session) {
    cookieStore.delete(SESSION_COOKIE);
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    const csrfToken = req.headers.get("X-CSRF-Token");
    if (!csrfToken || csrfToken !== session.csrfToken) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }
  }

  const target = `${API_BASE}/${pathname}${search}`;
  const res = await fetch(target, {
    method: req.method,
    headers: {
      "Content-Type": req.headers.get("content-type") || "application/json",
      "X-API-Key": session.apiKey,
      "X-Workspace-Id": session.workspaceId,
    },
    body: req.method !== "GET" && req.method !== "HEAD" ? await req.blob() : undefined,
  });

  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
    },
  });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
