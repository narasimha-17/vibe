import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, AUTH_COOKIE } from "@/lib/server-config";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Registration failed" }));
    return NextResponse.json(err, { status: res.status });
  }

  const { access_token } = await res.json();
  cookies().set(AUTH_COOKIE, access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return NextResponse.json({ ok: true });
}
