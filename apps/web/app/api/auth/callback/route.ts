import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/server-config";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", req.url));
  }
  cookies().set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
