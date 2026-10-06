import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, AUTH_COOKIE } from "@/lib/server-config";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const username = req.nextUrl.searchParams.get("username");
  const ourToken = cookies().get(AUTH_COOKIE)?.value;

  if (!token || !username || !ourToken) {
    return NextResponse.redirect(new URL("/dashboard/settings?github=failed", req.url));
  }

  const qs = new URLSearchParams({ access_token: token, github_username: username });
  await fetch(`${API_BASE_URL}/github/connect/save?${qs}`, {
    method: "POST",
    headers: { authorization: `Bearer ${ourToken}` },
    cache: "no-store",
  });

  return NextResponse.redirect(new URL("/dashboard/settings?github=connected", req.url));
}
