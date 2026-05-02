import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { apiKey, workspace } = await req.json();
  const cookieStore = await cookies();
  cookieStore.set('pm-api-key', apiKey, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
  cookieStore.set('pm-workspace', workspace || 'default', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
  return NextResponse.json({ ok: true });
}
