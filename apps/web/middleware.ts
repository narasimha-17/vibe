import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/server-config";

const PROTECTED_PREFIXES = ["/dashboard", "/builder", "/design"];

export function middleware(req: NextRequest) {
  const isProtected = PROTECTED_PREFIXES.some((p) => req.nextUrl.pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/builder/:path*", "/design/:path*"],
};
