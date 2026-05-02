import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

async function proxy(req: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  const pathname = path.join('/');
  const url = new URL(req.url);
  const search = url.search;

  const cookieStore = await cookies();
  const apiKey = cookieStore.get('pm-api-key')?.value || '';
  const workspaceId = cookieStore.get('pm-workspace')?.value || 'default';

  const target = `${API_BASE}/${pathname}${search}`;
  const res = await fetch(target, {
    method: req.method,
    headers: {
      'Content-Type': req.headers.get('content-type') || 'application/json',
      ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      ...(workspaceId ? { 'X-Workspace-Id': workspaceId } : {}),
    },
    body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.blob() : undefined,
  });

  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: {
      'content-type': res.headers.get('content-type') || 'application/json',
    },
  });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
